package de.concordia.terminal;

import android.content.Context;
import android.graphics.Bitmap;
import android.text.Layout;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.util.Arrays;
/**
 * Kingtop Z91 built-in printer via ZCS SDK (same stack as com.szzcs.smartpos on device).
 */
@CapacitorPlugin(name = "ZcsPrint")
public class ZcsPrintPlugin extends Plugin {
    private static final String TAG = "ZcsPrint";
    private static final String SMART_POS_PACKAGE = "com.szzcs.smartpos";
    private static final String ZCS_PRINT_PACKAGE = "com.zcs.printer";
    private static final Charset PRINT_CHARSET = Charset.forName("GBK");

    static {
        try {
            System.loadLibrary("SmartPosJni");
            Log.i(TAG, "Loaded bundled libSmartPosJni");
        } catch (UnsatisfiedLinkError e) {
            Log.w(TAG, "Bundled libSmartPosJni unavailable", e);
        }
    }

    private final Object printLock = new Object();

    private String lastError = "SDK not initialized";
    private ClassLoader sdkLoader;
    private Object printer;
    private Class<?> formatClass;
    private boolean printerSessionReady = false;

    private ClassLoader resolveSdkLoader() throws Exception {
        if (sdkLoader != null) return sdkLoader;

        try {
            Class.forName("com.zcs.sdk.DriverManager");
            sdkLoader = getClass().getClassLoader();
            Log.i(TAG, "ZCS SDK on app classpath");
            return sdkLoader;
        } catch (ClassNotFoundException ignored) {
            // expected — SDK ships in vendor APKs on device
        }

        for (String pkg : new String[] { ZCS_PRINT_PACKAGE, SMART_POS_PACKAGE }) {
            try {
                Context pkgContext = getContext().createPackageContext(
                    pkg,
                    Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
                );
                Class.forName("com.zcs.sdk.DriverManager", true, pkgContext.getClassLoader());
                sdkLoader = pkgContext.getClassLoader();
                Log.i(TAG, "ZCS SDK loaded from " + pkg);
                return sdkLoader;
            } catch (Exception e) {
                Log.w(TAG, "Could not load ZCS SDK from " + pkg, e);
            }
        }

        throw new ClassNotFoundException("ZCS DriverManager not found in app or vendor packages");
    }

    private Class<?> loadSdkClass(String name) throws Exception {
        return Class.forName(name, true, resolveSdkLoader());
    }

    private void ensureSysInit() throws Exception {
        Class<?> printerClass = loadSdkClass("com.zcs.sdk.g");
        Field jniField = printerClass.getDeclaredField("g");
        jniField.setAccessible(true);
        Object jni = jniField.get(null);
        if (jni == null) {
            throw new IllegalStateException("SmartPosJni not ready");
        }

        try {
            Method setUart = jni.getClass().getMethod("sdkSetUartSpeed", int.class);
            int uartCode = (Integer) setUart.invoke(jni, 460800);
            Log.i(TAG, "sdkSetUartSpeed(460800) => " + uartCode);
        } catch (NoSuchMethodException ignored) {
            // optional on older firmware
        }

        try {
            Method sysInitialize = jni.getClass().getMethod("sdkSysInitialize");
            int initCode = (Integer) sysInitialize.invoke(jni);
            Log.i(TAG, "sdkSysInitialize => " + initCode);
        } catch (NoSuchMethodException ignored) {
            // optional on older firmware
        }

        Method sysInit = jni.getClass().getMethod("sdkSysInit");
        int code = (Integer) sysInit.invoke(jni);
        Log.i(TAG, "sdkSysInit => " + code);
        if (code != 0) {
            Log.w(TAG, "sdkSysInit returned non-zero status: " + code);
        }
    }

    private synchronized void resetPrinterSession() {
        printer = null;
        formatClass = null;
        printerSessionReady = false;
        lastError = "SDK not initialized";
    }

    private synchronized boolean ensureReady() {
        if (printer != null && formatClass != null) {
            return true;
        }

        try {
            Class<?> driverManagerClass = loadSdkClass("com.zcs.sdk.DriverManager");
            Method getInstance = driverManagerClass.getMethod("getInstance");
            Object driverManager = getInstance.invoke(null);

            Method getPrinter = driverManagerClass.getMethod("getPrinter");
            printer = getPrinter.invoke(driverManager);
            if (printer == null) {
                lastError = "getPrinter() returned null";
                return false;
            }

            formatClass = loadSdkClass("com.zcs.sdk.q.b");
            ensureSysInit();
            printerSessionReady = false;
            lastError = "";
            Log.i(TAG, "ZCS printer ready via " + printer.getClass().getName());
            return true;
        } catch (Exception e) {
            lastError = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            Log.w(TAG, "ZCS init failed", e);
            printer = null;
            formatClass = null;
            return false;
        }
    }

    private static final String MARK_TIGHT = "@@TIGHT@@";
    private static final String MARK_BOLD_CENTER = "@@BOLD_CENTER@@";
    private static final String MARK_XL = "@@XL@@";
    private static final String MARK_LARGE = "@@LARGE@@";
    private static final String MARK_CENTER = "@@CENTER@@";
    private static final String MARK_BOLD = "@@BOLD@@";

    private Object buildFormat(int size, Layout.Alignment align) throws Exception {
        Object format = formatClass.getConstructor().newInstance();
        Method setSize = formatClass.getMethod("a", int.class);
        setSize.invoke(format, size);
        Method setAlign = formatClass.getMethod("a", Layout.Alignment.class);
        setAlign.invoke(format, align);
        return format;
    }

    private static class LineStyle {
        final String text;
        final int size;
        final boolean center;

        LineStyle(String text, int size, boolean center) {
            this.text = text;
            this.size = size;
            this.center = center;
        }
    }

    private LineStyle parseLine(String rawLine) {
        String line = rawLine;
        int size = 30;
        boolean center = false;

        while (true) {
            if (line.startsWith(MARK_TIGHT)) {
                line = line.substring(MARK_TIGHT.length());
                continue;
            }
            if (line.startsWith(MARK_BOLD_CENTER)) {
                line = line.substring(MARK_BOLD_CENTER.length());
                size = 32;
                center = true;
                break;
            }
            if (line.startsWith(MARK_XL)) {
                line = line.substring(MARK_XL.length());
                size = 44;
                center = true;
                break;
            }
            if (line.startsWith(MARK_CENTER)) {
                line = line.substring(MARK_CENTER.length());
                center = true;
                continue;
            }
            if (line.startsWith(MARK_LARGE)) {
                line = line.substring(MARK_LARGE.length());
                size = 34;
                center = true;
                break;
            }
            if (line.startsWith(MARK_BOLD)) {
                line = line.substring(MARK_BOLD.length());
                size = 30;
                break;
            }
            break;
        }

        if (line.startsWith("   *") || line.startsWith("* ") || line.startsWith("   »")) {
            size = 26;
        }

        return new LineStyle(line, size, center);
    }

    private void applyLineSpacing(Object format) {
        try {
            Method setSpacing = formatClass.getMethod("b", int.class);
            setSpacing.invoke(format, 1);
        } catch (Exception ignored) {
            // optional on this SDK build
        }
    }

    private void printViaBitmapBuffer(String text) throws Exception {
        printViaBitmapBuffer(text, true);
    }

    /**
     * @param finalize when false (QR follows), skip SDK flush — it throws on Z91 and blocks the QR job.
     */
    private void printViaBitmapBuffer(String text, boolean finalize) throws Exception {
        Method printLine = printer.getClass().getMethod("a", String.class, formatClass);
        String normalized = text.replace("\r\n", "\n");

        for (String rawLine : normalized.split("\n", -1)) {
            if (rawLine.trim().isEmpty()) {
                forwardPaper(3);
                continue;
            }

            LineStyle style = parseLine(rawLine);
            Layout.Alignment align = style.center
                ? Layout.Alignment.ALIGN_CENTER
                : Layout.Alignment.ALIGN_NORMAL;
            Object format = buildFormat(style.size, align);
            applyLineSpacing(format);
            printLine.invoke(printer, style.text + "\n", format);
            if (style.size >= 34) {
                forwardPaper(4);
            }
        }

        if (finalize) {
            safeFlushPrinter();
        } else {
            forwardPaperSafe(16);
        }
    }

    private static int parseResultCode(Object result) {
        if (result instanceof Integer) return (Integer) result;
        if (result instanceof Number) return ((Number) result).intValue();
        try {
            return Integer.parseInt(String.valueOf(result));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static boolean isSuccessCode(int code) {
        return code >= 0;
    }

    private int invokeJni(String methodName, Class<?>[] paramTypes, Object... args) throws Exception {
        Object jni = getJni();
        if (jni == null) {
            throw new IllegalStateException("SmartPosJni not initialized");
        }
        Method method = jni.getClass().getMethod(methodName, paramTypes);
        return parseResultCode(method.invoke(jni, args));
    }

    /** Z91 built-in printer must be powered before any print API accepts jobs. */
    private void wakePrinter() throws Exception {
        ensureSysInit();
        try {
            int volts = invokeJni("sdkZ91mVoltsOn", new Class<?>[0]);
            Log.i(TAG, "sdkZ91mVoltsOn => " + volts);
        } catch (NoSuchMethodException ignored) {
            // not a Z91-class device
        }
        try {
            int selected = invokeJni("sdkSelectPrnId", new Class<?>[]{int.class}, 0);
            Log.i(TAG, "sdkSelectPrnId(0) => " + selected);
        } catch (NoSuchMethodException ignored) {
            // optional on this firmware
        }
        for (int prnType : new int[] { 0, 1, 2 }) {
            try {
                int setType = invokeJni("sdkSetPrnType", new Class<?>[]{int.class}, prnType);
                Log.i(TAG, "sdkSetPrnType(" + prnType + ") => " + setType);
                if (isSuccessCode(setType)) {
                    break;
                }
            } catch (NoSuchMethodException ignored) {
                break;
            }
        }
        try {
            int status = invokeJni("sdkPrnStatus", new Class<?>[0]);
            Log.i(TAG, "sdkPrnStatus => " + status);
        } catch (NoSuchMethodException ignored) {
            // optional on this firmware
        }
        if (!printerSessionReady) {
            Thread.sleep(80);
            printerSessionReady = true;
        }
    }

    private void beginPrintJob() throws Exception {
        prepareForPrint();
        wakePrinter();
        applyPrintSettings();
    }

    private int invokePrinterBytes(byte[] payload, boolean nullTerminated) throws Exception {
        Method printBytes = printer.getClass().getMethod("c", byte[].class);
        byte[] data = nullTerminated
            ? Arrays.copyOf(payload, payload.length + 1)
            : payload;
        int code = parseResultCode(printBytes.invoke(printer, (Object) data));
        Log.i(TAG, "ZCS c([B]) len=" + payload.length + " => " + code);
        return code;
    }

    private int invokeJniPrnStr(String text) throws Exception {
        Object jni = getJni();
        Method prnStr = jni.getClass().getMethod("sdkPrnStr", byte[].class);
        byte[] payload = text.getBytes(PRINT_CHARSET);
        byte[] withNull = Arrays.copyOf(payload, payload.length + 1);
        int code = parseResultCode(prnStr.invoke(jni, (Object) withNull));
        Log.i(TAG, "sdkPrnStr len=" + payload.length + " => " + code);
        return code;
    }

    private void feedPaperSafe(int dots) {
        try {
            feedPaper(dots);
        } catch (Exception e) {
            Log.w(TAG, "Paper feed after print failed (non-fatal)", e);
        }
    }

    private void forwardPaperSafe(int dots) {
        try {
            forwardPaper(dots);
        } catch (Exception e) {
            Log.w(TAG, "forwardPaper failed (non-fatal)", e);
        }
    }

    /** Bitmap/QR jobs queue until paper moves — retry when the head returns -1406 (busy). */
    private boolean commitPrintedOutput() {
        for (int attempt = 0; attempt < 4; attempt++) {
            try {
                int code = invokeJni("sdkPrnPaperForward", new Class<?>[]{int.class}, 28);
                Log.i(TAG, "commitPrintedOutput attempt " + attempt + " => " + code);
                if (isSuccessCode(code)) {
                    return true;
                }
            } catch (Exception e) {
                Log.w(TAG, "commitPrintedOutput attempt " + attempt + " failed", e);
            }
            try {
                Thread.sleep(90L * (attempt + 1));
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    private void feedPaper(int dots) throws Exception {
        int code = invokeJni("sdkPrnPaperForward", new Class<?>[]{int.class}, dots);
        Log.i(TAG, "sdkPrnPaperForward(" + dots + ") => " + code);
        if (!isSuccessCode(code)) {
            throw new IllegalStateException("Paper feed failed with code " + code);
        }
    }

    private void printViaRawBytes(String text) throws Exception {
        applyPrintSettings();

        int code = invokeJniPrnStr(text);
        if (!isSuccessCode(code)) {
            code = invokePrinterBytes(text.getBytes(PRINT_CHARSET), true);
        }
        if (!isSuccessCode(code)) {
            throw new IllegalStateException("ZCS raw print failed with code " + code);
        }

        // sdkPrnStr queues text — flush when possible, but always feed paper.
        commitPrintBuffer("sdkPrnStr");
        feedPaperSafe(32);
    }

    private void prepareForPrint() throws Exception {
        if (!ensureReady()) {
            throw new IllegalStateException(lastError);
        }
    }

    /** Simple text — SDK line buffer first (fast, correct layout). */
    private void printTextInternal(String text) throws Exception {
        synchronized (printLock) {
            beginPrintJob();
            try {
                printViaBitmapBuffer(text);
            } catch (Exception lineError) {
                Log.w(TAG, "Line buffer failed, using raw text", lineError);
                printViaRawBytes(text);
            }
            feedPaperSafe(32);
        }
    }

    private void applyPrintSettings() throws Exception {
        try {
            int gray = invokeJni("sdkPrnSetGray", new Class<?>[]{int.class}, 6);
            Log.i(TAG, "sdkPrnSetGray(6) => " + gray);
        } catch (NoSuchMethodException ignored) {
            // optional on this firmware
        }
        try {
            int align = invokeJni("sdkPrnSetAlign", new Class<?>[]{int.class}, 1);
            Log.i(TAG, "sdkPrnSetAlign(1) => " + align);
        } catch (NoSuchMethodException ignored) {
            // optional on this firmware
        }
    }

    private Method findDeclaredMethod(Class<?> cls, String name, Class<?>... paramTypes) throws Exception {
        Method method = cls.getDeclaredMethod(name, paramTypes);
        method.setAccessible(true);
        return method;
    }

    private boolean printSdkBitmap(Bitmap bitmap) throws Exception {
        if (bitmap == null || bitmap.getWidth() <= 0 || bitmap.getHeight() <= 0) {
            return false;
        }
        Class<?> printerClass = printer.getClass();

        try {
            Method single = findDeclaredMethod(printerClass, "a", Bitmap.class);
            int code = parseResultCode(single.invoke(printer, bitmap));
            Log.i(TAG, "SDK a(Bitmap) => " + code);
            if (isSuccessCode(code) && commitPrintedOutput()) {
                return true;
            }
        } catch (NoSuchMethodException ignored) {
            // try other overloads
        }

        for (Method method : printerClass.getDeclaredMethods()) {
            if (!"a".equals(method.getName())) continue;
            Class<?>[] params = method.getParameterTypes();
            Object result;
            if (params.length == 2
                && Bitmap.class.isAssignableFrom(params[0])
                && params[1] == boolean.class) {
                method.setAccessible(true);
                result = method.invoke(printer, bitmap, false);
            } else if (params.length == 3
                && Bitmap.class.isAssignableFrom(params[0])
                && params[1] == byte.class
                && params[2] == boolean.class) {
                method.setAccessible(true);
                result = method.invoke(printer, bitmap, (byte) 0, false);
            } else {
                continue;
            }
            int code = parseResultCode(result);
            Log.i(TAG, "SDK bitmap print => " + code + " (" + bitmap.getWidth() + "x" + bitmap.getHeight() + ")");
            if (!isSuccessCode(code)) {
                continue;
            }
            if (commitPrintedOutput()) {
                return true;
            }
        }
        return false;
    }

    private byte[] encodeVendorBitmap(Bitmap bitmap) throws Exception {
        Method encode = findDeclaredMethod(printer.getClass(), "b", Bitmap.class, boolean.class);
        byte[] payload = (byte[]) encode.invoke(printer, bitmap, false);
        if (payload == null || payload.length == 0) {
            throw new IllegalStateException("Vendor bitmap encoder returned empty payload");
        }
        Log.i(TAG, "Vendor bitmap encoded, len=" + payload.length);
        return payload;
    }

    private boolean printVendorBytePayload(byte[] payload) throws Exception {
        Method printBytes = findDeclaredMethod(printer.getClass(), "a", byte[].class);
        int code = parseResultCode(printBytes.invoke(printer, payload));
        Log.i(TAG, "SDK a([B]) len=" + payload.length + " => " + code);
        return isSuccessCode(code);
    }

    private boolean printJniBitmapPayload(Bitmap bitmap) throws Exception {
        byte[] payload = encodeVendorBitmap(bitmap);
        Object jni = getJni();
        Method method = jni.getClass().getMethod("sdkPrnBitmap", byte[].class, int.class);
        int jniCode = parseResultCode(method.invoke(jni, payload, payload.length));
        Log.i(TAG, "sdkPrnBitmap payload=" + payload.length + " => " + jniCode);
        if (isSuccessCode(jniCode) && commitPrintedOutput()) {
            return true;
        }
        if (printVendorBytePayload(payload) && commitPrintedOutput()) {
            return true;
        }
        return false;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        boolean available = ensureReady();
        result.put("available", available);
        if (!available) {
            result.put("reason", lastError);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject result = new JSObject();
        boolean driverManagerFound = false;
        try {
            loadSdkClass("com.zcs.sdk.DriverManager");
            driverManagerFound = true;
        } catch (Exception e) {
            lastError = e.getMessage();
        }
        result.put("driverManagerFound", driverManagerFound);
        result.put("smartPosPackage", SMART_POS_PACKAGE);
        result.put("available", ensureReady());
        result.put("lastError", lastError);
        call.resolve(result);
    }

    /** Flush line-buffer jobs; after raw bytes on Z91 flush throws — feed paper instead. */
    private boolean commitPrintBuffer(String context) {
        try {
            flushPrinter();
            Log.i(TAG, "Committed print buffer: " + context);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "flush failed for " + context + ", feeding paper", e);
            try {
                forwardPaper(24);
            } catch (Exception feedError) {
                Log.w(TAG, "forwardPaper after flush failure also failed", feedError);
            }
            return false;
        }
    }

    private void printFooterSafe(String footer) throws Exception {
        if (footer == null || footer.trim().isEmpty()) return;
        printViaBitmapBuffer(footer);
    }

  /**
   * Z91 driver QR: SDK a(Bitmap) then vendor raster + sdkPrnBitmap, with paper-feed commit retries.
   * Do not flush here — flush after the text body breaks the following bitmap job on Z91.
   */
    private boolean printQrBlock(String qrUrl, String footerText) {
        if (qrUrl == null || qrUrl.trim().isEmpty()) {
            Log.w(TAG, "QR skipped — empty URL");
            return false;
        }
        String url = qrUrl.trim();
        String footer = footerText != null ? footerText.trim() : "";
        Log.i(TAG, "Printing QR block, urlLen=" + url.length() + " footerLen=" + footer.length());

        forwardPaperSafe(12);

        Bitmap qr;
        try {
            qr = ReceiptBitmapRenderer.createQrBitmap(url, 200);
        } catch (Exception encodeError) {
            Log.e(TAG, "QR bitmap encode failed", encodeError);
            return false;
        }

        try {
            if (printSdkBitmap(qr)) {
                Log.i(TAG, "QR via SDK a(Bitmap)");
                printFooterIfNeeded(footer);
                return true;
            }
        } catch (Exception sdkError) {
            Log.w(TAG, "SDK QR bitmap failed", sdkError);
        }

        try {
            if (printJniBitmapPayload(qr)) {
                Log.i(TAG, "QR via vendor raster");
                printFooterIfNeeded(footer);
                return true;
            }
        } catch (Exception vendorError) {
            Log.w(TAG, "Vendor QR raster failed", vendorError);
        }

        Log.e(TAG, "QR print failed — SDK and vendor bitmap paths exhausted");
        return false;
    }

    private void printFooterIfNeeded(String footer) {
        if (footer.isEmpty()) return;
        try {
            printFooterSafe(footer);
        } catch (Exception footerError) {
            Log.w(TAG, "QR footer print failed", footerError);
        }
    }

    private static class ReceiptPrintResult {
        final boolean bodyPrinted;
        final boolean qrPrinted;

        ReceiptPrintResult(boolean bodyPrinted, boolean qrPrinted) {
            this.bodyPrinted = bodyPrinted;
            this.qrPrinted = qrPrinted;
        }
    }

    private ReceiptPrintResult printReceiptInternal(String text, String qrUrl, String footerText) throws Exception {
        synchronized (printLock) {
            String trimmedQr = qrUrl != null ? qrUrl.trim() : "";
            String trimmedFooter = footerText != null ? footerText.trim() : "";
            boolean hasQr = !trimmedQr.isEmpty();

            Log.i(TAG, "printReceipt qrPresent=" + hasQr + " footerLen=" + trimmedFooter.length());

            beginPrintJob();

            boolean bodyPrinted;
            try {
                printViaBitmapBuffer(text, !hasQr);
                bodyPrinted = true;
            } catch (Exception lineError) {
                Log.w(TAG, "Line buffer failed, trying raw text", lineError);
                printViaRawBytes(text);
                bodyPrinted = true;
            }

            boolean qrPrinted = true;
            if (hasQr) {
                qrPrinted = printQrBlock(trimmedQr, trimmedFooter);
            } else if (!trimmedFooter.isEmpty()) {
                printFooterSafe(trimmedFooter);
            }

            feedPaperSafe(32);
            return new ReceiptPrintResult(bodyPrinted, qrPrinted);
        }
    }

    private Object getJni() throws Exception {
        Class<?> printerClass = loadSdkClass("com.zcs.sdk.g");
        Field jniField = printerClass.getDeclaredField("g");
        jniField.setAccessible(true);
        return jniField.get(null);
    }

    private void flushPrinter() throws Exception {
        Method flush = printer.getClass().getMethod("e");
        flush.invoke(printer);
    }

    /** Line-buffer printing needs flush; raw-byte ESC/POS must not call this on Z91. */
    private void safeFlushPrinter() {
        try {
            flushPrinter();
        } catch (Exception e) {
            Log.w(TAG, "flushPrinter failed, using paper forward", e);
            try {
                forwardPaper(12);
            } catch (Exception feedError) {
                Log.w(TAG, "forwardPaper after flush failure also failed", feedError);
            }
        }
    }

    private void forwardPaper(int dots) throws Exception {
        Object jni = getJni();
        if (jni == null) return;
        Method paperForward = jni.getClass().getMethod("sdkPrnPaperForward", int.class);
        paperForward.invoke(jni, dots);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (!ensureReady()) {
            call.reject("ZCS printer not available: " + lastError);
            return;
        }

        new Thread(() -> {
            try {
                printTextInternal(text);
                JSObject result = new JSObject();
                result.put("ok", true);
                resolveOnMain(call, result);
            } catch (Exception e) {
                Log.e(TAG, "ZCS print failed", e);
                rejectOnMain(call, "ZCS print failed: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        String text = call.getString("text", "");
        String qrUrl = call.getString("qrUrl");
        String footerText = call.getString("footerText", "");
        if (!ensureReady()) {
            call.reject("ZCS printer not available: " + lastError);
            return;
        }

        new Thread(() -> {
            try {
                ReceiptPrintResult printed = printReceiptInternal(text, qrUrl, footerText);
                String trimmedQr = qrUrl != null ? qrUrl.trim() : "";
                boolean needsQr = !trimmedQr.isEmpty();
                JSObject result = new JSObject();
                result.put("ok", printed.bodyPrinted);
                result.put("qrPrinted", !needsQr || printed.qrPrinted);
                resolveOnMain(call, result);
            } catch (Exception e) {
                Log.e(TAG, "ZCS receipt print failed", e);
                String msg = e.getMessage() != null ? e.getMessage() : "Print failed";
                if (msg.contains("-1403")) {
                    msg = "Printer not ready (check paper roll and cover closed)";
                }
                rejectOnMain(call, "ZCS receipt print failed: " + msg);
            }
        }).start();
    }

    private void resolveOnMain(PluginCall call, JSObject result) {
        getActivity().runOnUiThread(() -> {
            if (!call.isReleased()) call.resolve(result);
        });
    }

    private void rejectOnMain(PluginCall call, String message) {
        getActivity().runOnUiThread(() -> {
            if (!call.isReleased()) call.reject(message);
        });
    }
}
