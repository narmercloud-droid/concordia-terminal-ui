package de.concordia.terminal;

import android.os.Handler;
import android.os.Looper;
import android.os.RemoteException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.InnerResultCallback;
import com.sunmi.peripheral.printer.SunmiPrinterService;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "SunmiPrint")
public class SunmiPrintPlugin extends Plugin {
    private SunmiPrinterService sunmiPrinterService;
    private boolean bindRequested = false;
    private final List<PendingPrint> pendingPrints = new ArrayList<>();
    private final List<PluginCall> pendingAvailability = new ArrayList<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private static class PendingPrint {
        final PluginCall call;
        final String text;

        PendingPrint(PluginCall call, String text) {
            this.call = call;
            this.text = text;
        }
    }

    private final InnerPrinterCallback innerPrinterCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            sunmiPrinterService = service;
            flushPending();
        }

        @Override
        protected void onDisconnected() {
            sunmiPrinterService = null;
            bindRequested = false;
        }
    };

    private void bindPrinterService() {
        if (bindRequested) return;
        bindRequested = true;
        try {
            InnerPrinterManager.getInstance().bindService(getContext(), innerPrinterCallback);
        } catch (InnerPrinterException ignored) {
            bindRequested = false;
        }
    }

    private void flushPending() {
        List<PluginCall> availability = new ArrayList<>(pendingAvailability);
        pendingAvailability.clear();
        for (PluginCall call : availability) {
            resolveAvailable(call);
        }

        List<PendingPrint> prints = new ArrayList<>(pendingPrints);
        pendingPrints.clear();
        for (PendingPrint pending : prints) {
            executePrint(pending.call, pending.text);
        }
    }

    private void resolveAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", sunmiPrinterService != null);
        call.resolve(result);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        bindPrinterService();
        if (sunmiPrinterService != null) {
            resolveAvailable(call);
            return;
        }
        pendingAvailability.add(call);
        mainHandler.postDelayed(() -> {
            if (!call.isReleased()) {
                pendingAvailability.remove(call);
                resolveAvailable(call);
            }
        }, 5000);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        bindPrinterService();
        if (sunmiPrinterService != null) {
            executePrint(call, text);
            return;
        }
        pendingPrints.add(new PendingPrint(call, text));
        waitForPrinter(call, text, 0);
    }

    private void waitForPrinter(PluginCall call, String text, int attempt) {
        if (sunmiPrinterService != null) {
            pendingPrints.removeIf((p) -> p.call == call);
            executePrint(call, text);
            return;
        }
        if (attempt >= 40) {
            pendingPrints.removeIf((p) -> p.call == call);
            call.reject("Sunmi printer service not available. Check paper and restart the device.");
            return;
        }
        mainHandler.postDelayed(() -> waitForPrinter(call, text, attempt + 1), 250);
    }

    private void executePrint(PluginCall call, String text) {
        try {
            sunmiPrinterService.printerInit(null);
            sunmiPrinterService.setAlignment(0, null);
            String printable = text.endsWith("\n") ? text : text + "\n";
            final boolean[] finished = {false};

            sunmiPrinterService.printText(printable, new InnerResultCallback() {
                @Override
                public void onRunResult(boolean isSuccess) {}

                @Override
                public void onReturnString(String result) {}

                @Override
                public void onRaiseException(int code, String msg) {
                    if (!finished[0]) {
                        finished[0] = true;
                        call.reject("Printer error " + code + ": " + msg);
                    }
                }

                @Override
                public void onPrintResult(int code, String msg) {
                    if (!finished[0]) {
                        finished[0] = true;
                        if (code == 0) {
                            JSObject result = new JSObject();
                            result.put("ok", true);
                            call.resolve(result);
                        } else {
                            call.reject("Print failed (" + code + "): " + msg);
                        }
                    }
                }
            });
            sunmiPrinterService.lineWrap(4, null);
            sunmiPrinterService.cutPaper(null);

            mainHandler.postDelayed(() -> {
                if (!finished[0]) {
                    finished[0] = true;
                    JSObject result = new JSObject();
                    result.put("ok", true);
                    call.resolve(result);
                }
            }, 4000);
        } catch (RemoteException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Printer communication failed");
        }
    }
}
