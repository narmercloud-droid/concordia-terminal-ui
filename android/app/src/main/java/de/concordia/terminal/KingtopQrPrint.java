package de.concordia.terminal;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.Log;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * Prints a driver QR on Kingtop devices by reusing the ZCS SDK raw-byte printer when present.
 */
final class KingtopQrPrint {
    private static final String TAG = "KingtopQrPrint";
    private static final String SMART_POS_PACKAGE = "com.szzcs.smartpos";

    private KingtopQrPrint() {}

    static boolean print(Context context, String qrUrl, String footerText) {
        try {
            Object printer = resolvePrinter(context);
            if (printer == null) {
                Log.w(TAG, "ZCS printer unavailable for Kingtop QR fallback");
                return false;
            }
            forwardPaper(printer, 8);
            Bitmap qrFooter = ReceiptBitmapRenderer.render("", qrUrl, footerText != null ? footerText : "");
            byte[] payload = EscPosBitmapEncoder.encode(qrFooter, ReceiptBitmapRenderer.PAPER_WIDTH);
            printRawBytes(printer, payload);
            forwardPaper(printer, 32);
            Log.i(TAG, "Kingtop QR printed via ZCS raw bytes");
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Kingtop QR print failed", e);
            return false;
        }
    }

    private static Object resolvePrinter(Context context) throws Exception {
        ClassLoader loader;
        try {
            Class.forName("com.zcs.sdk.DriverManager");
            loader = KingtopQrPrint.class.getClassLoader();
        } catch (ClassNotFoundException e) {
            Context pkgContext = context.createPackageContext(
                SMART_POS_PACKAGE,
                Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
            );
            loader = pkgContext.getClassLoader();
        }

        Class<?> driverManagerClass = Class.forName("com.zcs.sdk.DriverManager", true, loader);
        Object driverManager = driverManagerClass.getMethod("getInstance").invoke(null);
        return driverManagerClass.getMethod("getPrinter").invoke(driverManager);
    }

    private static void printRawBytes(Object printer, byte[] payload) throws Exception {
        Method printBytes = printer.getClass().getMethod("c", byte[].class);
        printBytes.invoke(printer, (Object) payload);
    }

    private static void forwardPaper(Object printer, int dots) throws Exception {
        Class<?> printerClass = Class.forName("com.zcs.sdk.g");
        Field jniField = printerClass.getDeclaredField("g");
        jniField.setAccessible(true);
        Object jni = jniField.get(null);
        if (jni == null) return;
        Method paperForward = jni.getClass().getMethod("sdkPrnPaperForward", int.class);
        paperForward.invoke(jni, dots);
    }
}
