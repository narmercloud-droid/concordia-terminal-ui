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
    private static final String ZCS_PRINT_PACKAGE = "com.zcs.printer";

    private ZcsVendorPrint() {}

    static boolean printReceipt(Context context, String text, String qrUrl, String footerText) {
        if (context == null) return false;
        try {
            ClassLoader loader = resolveLoader(context);
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
            return code >= 0;
        } catch (Exception e) {
            Log.e(TAG, "Vendor silent print failed", e);
            return false;
        }
    }

    private static ClassLoader resolveLoader(Context context) throws Exception {
        for (String pkg : new String[] { ZCS_PRINT_PACKAGE, "com.szzcs.smartpos" }) {
            try {
                Context pkgContext = context.createPackageContext(
                    pkg,
                    Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
                );
                Class.forName("com.zcs.sdk.DriverManager", true, pkgContext.getClassLoader());
                return pkgContext.getClassLoader();
            } catch (Exception ignored) {
                // try next package
            }
        }
        throw new ClassNotFoundException("ZCS DriverManager not found in vendor packages");
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
