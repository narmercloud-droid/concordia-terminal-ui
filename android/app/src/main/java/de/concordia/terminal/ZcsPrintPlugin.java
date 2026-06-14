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

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
/**
 * Kingtop Z91 built-in printer via ZCS SDK (same stack as com.szzcs.smartpos on device).
 */
@CapacitorPlugin(name = "ZcsPrint")
public class ZcsPrintPlugin extends Plugin {
    private static final String TAG = "ZcsPrint";
    private static final String SMART_POS_PACKAGE = "com.szzcs.smartpos";
    private static final Charset PRINT_CHARSET = Charset.forName("GBK");

    private String lastError = "SDK not initialized";
    private ClassLoader sdkLoader;
    private Object printer;
    private Class<?> formatClass;

    private ClassLoader resolveSdkLoader() throws Exception {
        if (sdkLoader != null) return sdkLoader;

        try {
            Class.forName("com.zcs.sdk.DriverManager");
            sdkLoader = getClass().getClassLoader();
            Log.i(TAG, "ZCS SDK on app classpath");
            return sdkLoader;
        } catch (ClassNotFoundException ignored) {
            // expected — SDK ships in vendor demo app
        }

        Context pkgContext = getContext().createPackageContext(
            SMART_POS_PACKAGE,
            Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
        );
        sdkLoader = pkgContext.getClassLoader();
        Log.i(TAG, "ZCS SDK loaded from " + SMART_POS_PACKAGE);
        return sdkLoader;
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
        lastError = "SDK not initialized";
    }

    private synchronized boolean ensureReady() {
        if (printer != null && formatClass != null) {
            try {
                ensureSysInit();
                return true;
            } catch (Exception e) {
                Log.w(TAG, "Re-init before print failed, rebuilding printer session", e);
                resetPrinterSession();
            }
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

        flushPrinter();
    }

    /** Send raster data; Z91 needs heavy paper feed — flush after raw bytes crashes. */
    private boolean printBitmapViaEscPos(Bitmap bitmap) {
        try {
            byte[] payload = EscPosBitmapEncoder.encode(bitmap, ReceiptBitmapRenderer.PAPER_WIDTH);
            printRawBytes(payload, false);
            forwardPaper(120);
            Log.i(TAG, "Sent raster bitmap " + bitmap.getWidth() + "x" + bitmap.getHeight());
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Raster bitmap send failed", e);
            return false;
        }
    }

    private void printViaRawBytes(String text) throws Exception {
        Class<?> printerClass = loadSdkClass("com.zcs.sdk.g");
        Field jniField = printerClass.getDeclaredField("g");
        jniField.setAccessible(true);
        Object jni = jniField.get(null);
        if (jni == null) {
            throw new IllegalStateException("SmartPosJni not initialized");
        }

        Method printBytes = printer.getClass().getMethod("c", byte[].class);
        byte[] payload = text.getBytes(PRINT_CHARSET);
        byte[] withNull = Arrays.copyOf(payload, payload.length + 1);
        Object prnResult = printBytes.invoke(printer, (Object) withNull);
        Log.i(TAG, "ZCS c([B]) => " + String.valueOf(prnResult));

        Method paperForward = jni.getClass().getMethod("sdkPrnPaperForward", int.class);
        Object feedResult = paperForward.invoke(jni, 120);
        Log.i(TAG, "sdkPrnPaperForward => " + String.valueOf(feedResult));
    }

    private void prepareForPrint() throws Exception {
        if (!ensureReady()) {
            throw new IllegalStateException(lastError);
        }
        ensureSysInit();
    }

    /** Simple ASCII test strings — raw bytes first (works on Z91). */
    private void printTextInternal(String text) throws Exception {
        prepareForPrint();

        Exception rawError = null;
        try {
            printViaRawBytes(text);
            return;
        } catch (Exception e) {
            rawError = e;
            Log.w(TAG, "Raw byte print failed, trying bitmap buffer", e);
        }

        try {
            printViaBitmapBuffer(text);
        } catch (Exception bitmapError) {
            if (rawError != null) {
                bitmapError.addSuppressed(rawError);
            }
            throw bitmapError;
        }
    }

    private boolean printReceiptBitmap(Bitmap bitmap) {
        return printBitmapViaEscPos(bitmap);
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

    private byte[] buildEscPosQrPayload(String data) throws Exception {
        byte[] content = data.getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        // Center alignment
        buf.write(new byte[]{0x1B, 0x61, 0x01});
        // QR model 2
        buf.write(new byte[]{0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00});
        // Module size
        buf.write(new byte[]{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06});
        // Error correction M
        buf.write(new byte[]{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31});
        // Store data
        int storeLen = content.length + 3;
        buf.write(0x1D);
        buf.write(0x28);
        buf.write(0x6B);
        buf.write(storeLen & 0xFF);
        buf.write((storeLen >> 8) & 0xFF);
        buf.write(new byte[]{0x31, 0x50, 0x30});
        buf.write(content);
        // Print QR
        buf.write(new byte[]{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30});
        // Left align + feed
        buf.write(new byte[]{0x1B, 0x61, 0x00});
        buf.write(new byte[]{0x1B, 0x64, 0x03});
        return buf.toByteArray();
    }

    private boolean tryPrintBitmap(Bitmap bitmap) throws Exception {
        for (Method method : printer.getClass().getMethods()) {
            Class<?>[] params = method.getParameterTypes();
            if (params.length == 1 && Bitmap.class.isAssignableFrom(params[0])) {
                method.invoke(printer, bitmap);
                commitPrintBuffer("SDK Bitmap " + method.getName());
                return true;
            }
            if (params.length == 2 && Bitmap.class.isAssignableFrom(params[0])
                && params[1].isAssignableFrom(formatClass)) {
                Object format = buildFormat(30, Layout.Alignment.ALIGN_CENTER);
                method.invoke(printer, bitmap, format);
                commitPrintBuffer("SDK Bitmap " + method.getName() + "+Format");
                return true;
            }
        }
        return false;
    }

    /** Flush line-buffer jobs; after raw bytes on Z91 flush throws — feed paper instead. */
    private void commitPrintBuffer(String context) throws Exception {
        try {
            flushPrinter();
            Log.i(TAG, "Committed print buffer: " + context);
        } catch (Exception e) {
            Log.w(TAG, "flush failed for " + context + ", feeding paper", e);
            forwardPaper(120);
        }
    }

    /** Rough pixel height — unused on Z91; line buffer is used for receipt body. */
    private static int estimateBodyHeightPx(String text) {
        if (text == null || text.isEmpty()) return 0;
        int lines = text.replace("\r\n", "\n").split("\n", -1).length;
        return lines * 34 + 80;
    }

    /**
     * Print driver QR + footer after the receipt body.
     * Z91: never call flushPrinter() after raw ESC/POS bytes — it throws and aborts QR.
     */
    private boolean printQrBlock(String qrUrl, String footerText) {
        if (qrUrl == null || qrUrl.trim().isEmpty()) {
            Log.w(TAG, "QR skipped — empty URL");
            return false;
        }
        String url = qrUrl.trim();
        String footer = footerText != null ? footerText.trim() : "";
        Log.i(TAG, "Printing QR block, urlLen=" + url.length() + " footerLen=" + footer.length());

        try {
            forwardPaper(8);
        } catch (Exception feedError) {
            Log.w(TAG, "Paper forward before QR failed", feedError);
        }

        try {
            Bitmap qr = ReceiptBitmapRenderer.createQrBitmap(url, 200);
            if (tryPrintBitmap(qr)) {
                if (!footer.isEmpty()) {
                    printViaBitmapBuffer(footer);
                }
                Log.i(TAG, "QR printed via SDK Bitmap API");
                return true;
            }
        } catch (Exception sdkError) {
            Log.w(TAG, "SDK Bitmap QR failed", sdkError);
        }

        try {
            printEscPosQr(url);
            if (!footer.isEmpty()) {
                printViaBitmapBuffer(footer);
            }
            Log.i(TAG, "QR printed via ESC/POS command");
            return true;
        } catch (Exception escPosError) {
            Log.w(TAG, "ESC/POS QR command failed, trying raster", escPosError);
        }

        try {
            Bitmap qrFooter = ReceiptBitmapRenderer.render("", url, footer);
            if (printBitmapViaEscPos(qrFooter)) {
                Log.i(TAG, "QR printed via ESC/POS raster (QR + footer)");
                return true;
            }
        } catch (Exception rasterError) {
            Log.w(TAG, "Raster QR+footer failed", rasterError);
        }

        try {
            Bitmap qrOnly = ReceiptBitmapRenderer.createQrBitmap(url, 200);
            if (printBitmapViaEscPos(qrOnly)) {
                if (!footer.isEmpty()) {
                    printViaBitmapBuffer(footer);
                }
                Log.i(TAG, "QR printed via ESC/POS raster (QR only)");
                return true;
            }
        } catch (Exception qrOnlyError) {
            Log.e(TAG, "All QR print methods failed", qrOnlyError);
        }
        return false;
    }

    private void printReceiptInternal(String text, String qrUrl, String footerText) throws Exception {
        prepareForPrint();

        String trimmedQr = qrUrl != null ? qrUrl.trim() : "";
        String trimmedFooter = footerText != null ? footerText.trim() : "";
        boolean hasQr = !trimmedQr.isEmpty();

        Log.i(TAG, "printReceipt qrPresent=" + hasQr + " footerLen=" + trimmedFooter.length());

        // Z91: line-by-line SDK buffer is the only reliable path for the receipt body.
        // ESC/POS raster reports success but does not eject without flush (which crashes).
        printViaBitmapBuffer(text);

        if (hasQr) {
            printQrBlock(trimmedQr, trimmedFooter);
        } else if (!trimmedFooter.isEmpty()) {
            printViaBitmapBuffer(trimmedFooter);
        }

        forwardPaper(48);
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

    private void printRawBytes(byte[] payload, boolean nullTerminated) throws Exception {
        Method printBytes = printer.getClass().getMethod("c", byte[].class);
        byte[] data = nullTerminated
            ? Arrays.copyOf(payload, payload.length + 1)
            : payload;
        Object prnResult = printBytes.invoke(printer, (Object) data);
        Log.i(TAG, "ZCS c([B]) len=" + payload.length + " => " + String.valueOf(prnResult));
    }

    private void printEscPosQr(String qrUrl) throws Exception {
        byte[] payload = buildEscPosQrPayload(qrUrl);
        printRawBytes(payload, false);
        forwardPaper(120);
        Log.i(TAG, "Sent ESC/POS QR payload, len=" + payload.length);
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
                printReceiptInternal(text, qrUrl, footerText);
                JSObject result = new JSObject();
                result.put("ok", true);
                resolveOnMain(call, result);
            } catch (Exception e) {
                Log.e(TAG, "ZCS receipt print failed", e);
                rejectOnMain(call, "ZCS receipt print failed: " + e.getMessage());
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
