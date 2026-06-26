package de.concordia.terminal;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.os.RemoteException;
import android.util.Log;

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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "SunmiPrint")
public class SunmiPrintPlugin extends Plugin {
    private static final String TAG = "SunmiPrint";
    private SunmiPrinterService sunmiPrinterService;
    private boolean bindRequested = false;
    private final List<PendingPrint> pendingPrints = new ArrayList<>();
    private final List<PluginCall> pendingAvailability = new ArrayList<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private static class PendingPrint {
        final PluginCall call;
        final Runnable action;

        PendingPrint(PluginCall call, Runnable action) {
            this.call = call;
            this.action = action;
        }
    }

    private final InnerPrinterCallback innerPrinterCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            sunmiPrinterService = service;
            Log.i(TAG, "Sunmi printer service connected");
            flushPending();
        }

        @Override
        protected void onDisconnected() {
            Log.w(TAG, "Sunmi printer service disconnected");
            sunmiPrinterService = null;
            bindRequested = false;
        }
    };

    private void bindPrinterService() {
        if (bindRequested) return;
        bindRequested = true;
        try {
            InnerPrinterManager.getInstance().bindService(getContext(), innerPrinterCallback);
            Log.i(TAG, "Binding Sunmi printer service");
        } catch (InnerPrinterException e) {
            Log.w(TAG, "Failed to bind Sunmi printer service", e);
            bindRequested = false;
        }
    }

    @Override
    public void load() {
        bindPrinterService();
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
            pending.action.run();
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
        runWhenReady(call, () -> executePrintText(call, text));
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        String text = call.getString("text", "");
        String qrUrl = call.getString("qrUrl", "");
        String footerText = call.getString("footerText", "");
        runWhenReady(call, () -> executePrintReceipt(call, text, qrUrl, footerText));
    }

    private void runWhenReady(PluginCall call, Runnable action) {
        bindPrinterService();
        if (sunmiPrinterService != null) {
            action.run();
            return;
        }
        pendingPrints.add(new PendingPrint(call, action));
        waitForPrinter(call, action, 0);
    }

    private void waitForPrinter(PluginCall call, Runnable action, int attempt) {
        if (sunmiPrinterService != null) {
            pendingPrints.removeIf((p) -> p.call == call);
            action.run();
            return;
        }
        if (attempt >= 40) {
            pendingPrints.removeIf((p) -> p.call == call);
            call.reject("Sunmi printer service not available. Check paper and restart the device.");
            return;
        }
        mainHandler.postDelayed(() -> waitForPrinter(call, action, attempt + 1), 250);
    }

    private void executePrintText(PluginCall call, String text) {
        try {
            sunmiPrinterService.printerInit(null);
            sunmiPrinterService.setAlignment(0, null);
            String printable = stripMarkers(text);
            if (!printable.endsWith("\n")) {
                printable += "\n";
            }
            if (!awaitPrintText(printable)) {
                if (!call.isReleased()) {
                    call.reject("Sunmi text print failed");
                }
                return;
            }
            sunmiPrinterService.lineWrap(4, null);
            sunmiPrinterService.cutPaper(null);
            if (!call.isReleased()) {
                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            }
        } catch (RemoteException e) {
            if (!call.isReleased()) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Printer communication failed");
            }
        }
    }

    private void executePrintReceipt(PluginCall call, String text, String qrUrl, String footerText) {
        try {
            sunmiPrinterService.printerInit(null);
            boolean printed = false;
            boolean bitmapAttempted = false;

            try {
                Bitmap bitmap = ReceiptBitmapRenderer.render(
                    text != null ? text : "",
                    qrUrl != null ? qrUrl.trim() : "",
                    footerText != null ? footerText : ""
                );
                bitmapAttempted = true;
                printed = awaitPrintBitmap(bitmap);
                Log.i(TAG, "Receipt bitmap print => " + printed);
            } catch (Exception bitmapError) {
                Log.w(TAG, "Receipt bitmap render failed, using text fallback", bitmapError);
            }

            // Only fall back to plain text when bitmap rendering failed — never when
            // printBitmap was already submitted (avoids double bon on callback race).
            if (!bitmapAttempted) {
                StringBuilder fallback = new StringBuilder(stripMarkers(text != null ? text : ""));
                if (footerText != null && !footerText.trim().isEmpty()) {
                    fallback.append('\n').append(stripMarkers(footerText));
                }
                printed = awaitPrintText(fallback.toString());
                Log.i(TAG, "Receipt text fallback => " + printed);
            }

            sunmiPrinterService.lineWrap(3, null);
            sunmiPrinterService.cutPaper(null);

            boolean needsQr = qrUrl != null && !qrUrl.trim().isEmpty();
            if (!printed) {
                call.reject("Sunmi receipt print failed");
                return;
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("qrPrinted", !needsQr || printed);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Sunmi receipt print failed", e);
            call.reject(e.getMessage() != null ? e.getMessage() : "Sunmi receipt print failed");
        }
    }

    private boolean awaitPrintBitmap(Bitmap bitmap) throws RemoteException, InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean success = new AtomicBoolean(false);
        AtomicBoolean finished = new AtomicBoolean(false);

        Runnable complete = () -> {
            if (finished.compareAndSet(false, true)) {
                latch.countDown();
            }
        };

        sunmiPrinterService.printBitmap(bitmap, new InnerResultCallback() {
            @Override
            public void onRunResult(boolean isSuccess) {
                // Ignore — onPrintResult is authoritative; early onRunResult(false)
                // previously triggered text fallback while bitmap was still printing.
            }

            @Override
            public void onReturnString(String result) {}

            @Override
            public void onRaiseException(int code, String msg) {
                Log.w(TAG, "printBitmap exception " + code + ": " + msg);
                success.set(false);
                complete.run();
            }

            @Override
            public void onPrintResult(int code, String msg) {
                Log.i(TAG, "printBitmap result " + code + ": " + msg);
                success.set(code == 0);
                complete.run();
            }
        });

        boolean completed = latch.await(12, TimeUnit.SECONDS);
        if (!completed) {
            Log.w(TAG, "printBitmap timed out waiting for callback");
        }
        return success.get();
    }

    private boolean awaitPrintText(String printable) throws RemoteException {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean success = new AtomicBoolean(false);
        AtomicBoolean finished = new AtomicBoolean(false);

        Runnable complete = () -> {
            if (finished.compareAndSet(false, true)) {
                latch.countDown();
            }
        };

        sunmiPrinterService.printText(printable, new InnerResultCallback() {
            @Override
            public void onRunResult(boolean isSuccess) {
                // Ignore — wait for onPrintResult.
            }

            @Override
            public void onReturnString(String result) {}

            @Override
            public void onRaiseException(int printCode, String msg) {
                Log.w(TAG, "printText exception " + printCode + ": " + msg);
                success.set(false);
                complete.run();
            }

            @Override
            public void onPrintResult(int printCode, String msg) {
                Log.i(TAG, "printText result " + printCode + ": " + msg);
                success.set(printCode == 0);
                complete.run();
            }
        });

        try {
            boolean completed = latch.await(12, TimeUnit.SECONDS);
            if (!completed) {
                Log.w(TAG, "printText timed out waiting for callback");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
        return success.get();
    }

    private static String stripMarkers(String text) {
        if (text == null) return "";
        return text
            .replace("@@TIGHT@@", "")
            .replace("@@BOLD_CENTER@@", "")
            .replace("@@XL@@", "")
            .replace("@@LARGE@@", "")
            .replace("@@CENTER@@", "")
            .replace("@@BOLD@@", "");
    }
}
