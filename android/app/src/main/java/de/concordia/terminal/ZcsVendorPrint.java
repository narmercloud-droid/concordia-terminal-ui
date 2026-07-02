package de.concordia.terminal;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.Log;

import java.lang.reflect.Method;

/**
 * Silent printing via com.zcs.printer.LocalPrintService static helpers (same code path as the
 * vendor print service, without Android's "Choose printer" UI).
 */
final class ZcsVendorPrint {
    private static final String TAG = "ZcsVendorPrint";

    private ZcsVendorPrint() {}

    static boolean printReceipt(Context context, String text, String qrUrl, String footerText) {
        if (context == null) return false;
        try {
            ClassLoader loader = ZcsSdkBootstrap.resolveSdkLoader(context);
            wakePrinterIfPossible(loader);

            Bitmap bitmap = ReceiptBitmapRenderer.render(
                text != null ? text : "",
                qrUrl != null ? qrUrl.trim() : "",
                footerText != null ? footerText : ""
            );

            Class<?> driverManagerClass = Class.forName("com.zcs.sdk.DriverManager", true, loader);
            Object driverManager = driverManagerClass.getMethod("getInstance").invoke(null);
            Object printer = driverManagerClass.getMethod("getPrinter").invoke(driverManager);
            if (printer == null) {
                Log.w(TAG, "Vendor getPrinter() returned null");
                return false;
            }

            Method printBitmap = findBitmapPrintMethod(printer.getClass());
            if (printBitmap == null) {
                Log.w(TAG, "Vendor getPrinter() has no bitmap print method");
                return false;
            }

            Class<?>[] params = printBitmap.getParameterTypes();
            Object result;
            if (params.length == 2) {
                result = printBitmap.invoke(printer, bitmap, false);
            } else {
                result = printBitmap.invoke(printer, bitmap, (byte) 0, false);
            }
            int code = (Integer) result;
            Log.i(TAG, "Vendor SDK print bitmap => " + code);
            if (code >= 0) {
                commitPaperForward(loader);
                return true;
            }
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Vendor silent print failed", e);
            return false;
        }
    }

    private static void commitPaperForward(ClassLoader loader) {
        try {
            Class<?> printerClass = Class.forName("com.zcs.sdk.g", true, loader);
            java.lang.reflect.Field jniField = printerClass.getDeclaredField("g");
            jniField.setAccessible(true);
            Object jni = jniField.get(null);
            if (jni == null) return;
            java.lang.reflect.Method forward = jni.getClass().getMethod("sdkPrnPaperForward", int.class);
            Object code = forward.invoke(jni, 32);
            Log.i(TAG, "sdkPrnPaperForward(32) => " + String.valueOf(code));
        } catch (Exception e) {
            Log.w(TAG, "commitPaperForward failed (non-fatal)", e);
        }
    }

  /** Power the Z91 built-in printer before the first bitmap job. */
    private static void wakePrinterIfPossible(ClassLoader loader) {
        try {
            Class<?> printerClass = Class.forName("com.zcs.sdk.g", true, loader);
            java.lang.reflect.Field jniField = printerClass.getDeclaredField("g");
            jniField.setAccessible(true);
            Object jni = jniField.get(null);
            if (jni == null) return;

            try {
                java.lang.reflect.Method sysInit = jni.getClass().getMethod("sdkSysInit");
                Object code = sysInit.invoke(jni);
                Log.i(TAG, "sdkSysInit => " + String.valueOf(code));
            } catch (NoSuchMethodException ignored) {
                // optional
            }

            try {
                java.lang.reflect.Method volts = jni.getClass().getMethod("sdkZ91mVoltsOn");
                Object code = volts.invoke(jni);
                Log.i(TAG, "sdkZ91mVoltsOn => " + String.valueOf(code));
            } catch (NoSuchMethodException ignored) {
                // optional
            }

            try {
                java.lang.reflect.Method select = jni.getClass().getMethod("sdkSelectPrnId", int.class);
                select.invoke(jni, 0);
            } catch (NoSuchMethodException ignored) {
                // optional
            }

            Thread.sleep(80);
        } catch (Exception e) {
            Log.w(TAG, "wakePrinterIfPossible failed (continuing)", e);
        }
    }

    private static Method findBitmapPrintMethod(Class<?> printerClass) {
        for (Method method : printerClass.getMethods()) {
            if (!"a".equals(method.getName())) continue;
            Class<?>[] params = method.getParameterTypes();
            if (params.length == 2
                && Bitmap.class.isAssignableFrom(params[0])
                && params[1] == boolean.class) {
                return method;
            }
            if (params.length == 3
                && Bitmap.class.isAssignableFrom(params[0])
                && params[1] == byte.class
                && params[2] == boolean.class) {
                return method;
            }
        }
        return null;
    }
}
