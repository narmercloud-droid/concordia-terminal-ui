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

@CapacitorPlugin(name = "SunmiPrint")
public class SunmiPrintPlugin extends Plugin {
    private SunmiPrinterService sunmiPrinterService;
    private boolean binding = false;

    private final InnerPrinterCallback innerPrinterCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            sunmiPrinterService = service;
            binding = true;
        }

        @Override
        protected void onDisconnected() {
            sunmiPrinterService = null;
            binding = false;
        }
    };

    private void bindPrinterService() {
        if (binding || sunmiPrinterService != null) {
            return;
        }
        try {
            InnerPrinterManager.getInstance().bindService(getContext(), innerPrinterCallback);
        } catch (InnerPrinterException ignored) {
            // Sunmi service unavailable on emulator / non-Sunmi devices
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        bindPrinterService();
        JSObject result = new JSObject();
        result.put("available", sunmiPrinterService != null);
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        bindPrinterService();
        printWhenReady(call, text, 0);
    }

    private void printWhenReady(PluginCall call, String text, int attempt) {
        if (sunmiPrinterService != null) {
            try {
                String printable = text.endsWith("\n") ? text : text + "\n";
                sunmiPrinterService.setAlignment(1, null);
                sunmiPrinterService.printText(printable, new InnerResultCallback() {
                    @Override
                    public void onRunResult(boolean isSuccess) {
                        // no-op
                    }

                    @Override
                    public void onReturnString(String result) {
                        // no-op
                    }

                    @Override
                    public void onRaiseException(int code, String msg) {
                        // no-op
                    }

                    @Override
                    public void onPrintResult(int code, String msg) {
                        // no-op
                    }
                });
                sunmiPrinterService.lineWrap(4, null);
                sunmiPrinterService.cutPaper(null);
                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            } catch (RemoteException e) {
                call.reject(e.getMessage());
            }
            return;
        }

        if (attempt >= 24) {
            call.reject("Sunmi printer service not available");
            return;
        }

        new Handler(Looper.getMainLooper()).postDelayed(
            () -> printWhenReady(call, text, attempt + 1),
            250
        );
    }
}
