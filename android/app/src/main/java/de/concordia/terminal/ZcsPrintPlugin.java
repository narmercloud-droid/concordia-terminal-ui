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

    private static final String MARK_XL = "@@XL@@";
    private static final String MARK_LARGE = "@@LARGE@@";
    private static final String MARK_CENTER = "@@CENTER@@";

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

        if (line.startsWith(MARK_XL)) {
            line = line.substring(MARK_XL.length());
            size = 44;
            center = true;
        } else if (line.startsWith(MARK_LARGE)) {
            line = line.substring(MARK_LARGE.length());
            size = 36;
            center = true;
        } else if (line.startsWith(MARK_CENTER)) {
            line = line.substring(MARK_CENTER.length());
            center = true;
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
                forwardPaper(6);
                continue;
            }

            LineStyle style = parseLine(rawLine);
            Layout.Alignment align = style.center
                ? Layout.Alignment.ALIGN_CENTER
                : Layout.Alignment.ALIGN_NORMAL;
            Object format = buildFormat(style.size, align);
            applyLineSpacing(format);
            printLine.invoke(printer, style.text + "\n", format);
            if (style.size >= 36) {
                forwardPaper(10);
            }
        }

        flushPrinter();
    }

    private static final int RECEIPT_HEADER_LINES = 6;

    private String skipHeaderLines(String text) {
        String[] lines = text.replace("\r\n", "\n").split("\n", -1);
        StringBuilder body = new StringBuilder();
        int skipped = 0;
        for (String line : lines) {
            if (line.isEmpty()) continue;
            if (skipped < RECEIPT_HEADER_LINES) {
                skipped++;
                continue;
            }
            body.append(line).append('\n');
        }
        return body.toString();
    }

    private void printBitmapViaEscPos(Bitmap bitmap) throws Exception {
        byte[] payload = EscPosBitmapEncoder.encode(bitmap, ReceiptBitmapRenderer.PAPER_WIDTH);
        printRawBytes(payload, false);
        forwardPaper(30);
        Log.i(TAG, "Printed raster bitmap " + bitmap.getWidth() + "x" + bitmap.getHeight());
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

    private boolean printReceiptBitmap(Bitmap bitmap) throws Exception {
        try {
            if (tryPrintBitmap(bitmap)) {
                return true;
            }
        } catch (Exception sdkError) {
            Log.w(TAG, "ZCS SDK bitmap unavailable, trying ESC/POS raster", sdkError);
        }

        try {
            printBitmapViaEscPos(bitmap);
            return true;
        } catch (Exception rasterError) {
            Log.w(TAG, "ESC/POS raster bitmap failed", rasterError);
            return false;
        }
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
                flushPrinter();
                Log.i(TAG, "Bitmap via " + method.getName() + "(Bitmap)");
                return true;
            }
            if (params.length == 2 && Bitmap.class.isAssignableFrom(params[0])
                && params[1].isAssignableFrom(formatClass)) {
                Object format = buildFormat(30, Layout.Alignment.ALIGN_CENTER);
                method.invoke(printer, bitmap, format);
                flushPrinter();
                Log.i(TAG, "Bitmap via " + method.getName() + "(Bitmap,Format)");
                return true;
            }
        }
        return false;
    }

    private void printQrCode(String qrUrl) throws Exception {
        Bitmap qr = ReceiptBitmapRenderer.createQrBitmap(qrUrl, 200);
        if (printReceiptBitmap(qr)) {
            forwardPaper(20);
            return;
        }
        Log.w(TAG, "QR print unavailable — skipping QR");
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

    private void printReceiptInternal(String text, String qrUrl, String footerText) throws Exception {
        prepareForPrint();
        forwardPaper(24);

        String trimmedQr = qrUrl != null ? qrUrl.trim() : "";
        String trimmedFooter = footerText != null ? footerText.trim() : "";

        Bitmap header = ReceiptBitmapRenderer.renderHeaderBlock(text, RECEIPT_HEADER_LINES);
        if (!printReceiptBitmap(header)) {
            Log.w(TAG, "Header raster failed, printing header via line buffer");
            printViaBitmapBuffer(extractHeaderLines(text));
        }

        String body = skipHeaderLines(text);
        if (!body.trim().isEmpty()) {
            printViaBitmapBuffer(body);
        }

        if (!trimmedQr.isEmpty()) {
            forwardPaper(10);
            try {
                printQrCode(trimmedQr);
            } catch (Exception qrError) {
                Log.w(TAG, "QR print failed", qrError);
            }
        }

        if (!trimmedFooter.isEmpty()) {
            printViaBitmapBuffer(trimmedFooter);
        }

        forwardPaper(100);
    }

    private String extractHeaderLines(String text) {
        String[] lines = text.replace("\r\n", "\n").split("\n", -1);
        StringBuilder header = new StringBuilder();
        int count = 0;
        for (String line : lines) {
            if (line.isEmpty()) continue;
            header.append(line).append('\n');
            count++;
            if (count >= RECEIPT_HEADER_LINES) break;
        }
        return header.toString();
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
