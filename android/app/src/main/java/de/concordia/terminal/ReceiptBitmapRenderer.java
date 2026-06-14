package de.concordia.terminal;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Renders a Lieferando-style receipt as one monochrome bitmap (384px = 58mm). */
final class ReceiptBitmapRenderer {
    static final int PAPER_WIDTH = 384;
    private static final int PADDING_X = 6;
    private static final int PADDING_TOP = 2;
    private static final int GAP_SECTION = 0;
    private static final int GAP_LINE = 0;

    private static final String MARK_TIGHT = "@@TIGHT@@";
    private static final String MARK_BOLD_CENTER = "@@BOLD_CENTER@@";
    private static final String MARK_XL = "@@XL@@";
    private static final String MARK_LARGE = "@@LARGE@@";
    private static final String MARK_CENTER = "@@CENTER@@";
    private static final String MARK_BOLD = "@@BOLD@@";

    private static class Row {
        final String text;
        final float size;
        final boolean center;
        final boolean bold;
        final int gapBefore;

        Row(String text, float size, boolean center, boolean bold, int gapBefore) {
            this.text = text;
            this.size = size;
            this.center = center;
            this.bold = bold;
            this.gapBefore = gapBefore;
        }
    }

    /** Header block only (branch, type, due time, order id) — avoids ZCS line-buffer clipping. */
    static Bitmap renderHeaderBlock(String body, int maxLines) {
        String[] lines = body.replace("\r\n", "\n").split("\n", -1);
        StringBuilder header = new StringBuilder();
        int count = 0;
        for (String line : lines) {
            if (line.isEmpty()) continue;
            header.append(line).append('\n');
            count++;
            if (count >= maxLines) break;
        }
        return renderSection(header.toString());
    }

    static Bitmap renderSection(String text) {
        List<Row> rows = parseRows(text);
        float totalHeight = PADDING_TOP + measureRowsHeight(rows) + 12;
        int height = Math.max(1, (int) Math.ceil(totalHeight));
        Bitmap out = Bitmap.createBitmap(PAPER_WIDTH, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        canvas.drawColor(Color.WHITE);
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        drawRows(canvas, paint, rows, PADDING_TOP);
        return out;
    }

    static Bitmap render(String body, String qrUrl, String footerText) {
        List<Row> bodyRows = parseRows(body);
        List<Row> footerRows = footerText != null && !footerText.trim().isEmpty()
            ? parseRows(footerText)
            : new ArrayList<>();

        Bitmap qrBitmap = null;
        int qrSize = 0;
        if (qrUrl != null && !qrUrl.trim().isEmpty()) {
            try {
                qrSize = 200;
                qrBitmap = createQrBitmap(qrUrl.trim(), qrSize);
            } catch (Exception ignored) {
                qrBitmap = null;
            }
        }

        float totalHeight = PADDING_TOP + measureRowsHeight(bodyRows);
        if (qrBitmap != null) {
            totalHeight += GAP_SECTION + qrSize + GAP_SECTION;
        }
        totalHeight += measureRowsHeight(footerRows) + 12;

        int height = Math.max(1, (int) Math.ceil(totalHeight));
        Bitmap out = Bitmap.createBitmap(PAPER_WIDTH, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        canvas.drawColor(Color.WHITE);

        float y = PADDING_TOP;
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);

        y = drawRows(canvas, paint, bodyRows, y);

        if (qrBitmap != null) {
            y += GAP_SECTION;
            float qrLeft = (PAPER_WIDTH - qrSize) / 2f;
            canvas.drawBitmap(qrBitmap, qrLeft, y, null);
            y += qrSize + GAP_SECTION;
        }

        drawRows(canvas, paint, footerRows, y);
        return out;
    }

    private static float measureRowsHeight(List<Row> rows) {
        float total = 0;
        TextPaint measurePaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        for (Row row : rows) {
            total += row.gapBefore;
            measurePaint.setTypeface(row.bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            measurePaint.setTextSize(row.size);
            total += measureTextHeight(measurePaint, row.text, PAPER_WIDTH - PADDING_X * 2, row.center) + GAP_LINE;
        }
        return total;
    }

    private static float drawRows(Canvas canvas, TextPaint paint, List<Row> rows, float y) {
        for (Row row : rows) {
            y += row.gapBefore;
            paint.setTypeface(row.bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            paint.setTextSize(row.size);
            y += drawTextBlock(canvas, paint, row.text, row.center, y) + GAP_LINE;
        }
        return y;
    }

    private static List<Row> parseRows(String text) {
        List<Row> rows = new ArrayList<>();
        String[] lines = text.replace("\r\n", "\n").split("\n", -1);
        boolean lastWasBlank = true;

        for (String raw : lines) {
            if (raw.isEmpty()) {
                lastWasBlank = true;
                continue;
            }

            float size = 28f;
            boolean center = false;
            boolean bold = false;
            boolean tight = false;
            String line = raw;

            while (true) {
                if (line.startsWith(MARK_TIGHT)) {
                    line = line.substring(MARK_TIGHT.length());
                    tight = true;
                    continue;
                }
                if (line.startsWith(MARK_BOLD_CENTER)) {
                    line = line.substring(MARK_BOLD_CENTER.length());
                    size = 29f;
                    center = true;
                    bold = true;
                    continue;
                }
                if (line.startsWith(MARK_XL)) {
                    line = line.substring(MARK_XL.length());
                    size = 40f;
                    center = true;
                    bold = true;
                    break;
                }
                if (line.startsWith(MARK_CENTER)) {
                    line = line.substring(MARK_CENTER.length());
                    center = true;
                    continue;
                }
                if (line.startsWith(MARK_LARGE)) {
                    line = line.substring(MARK_LARGE.length());
                    size = 32f;
                    center = true;
                    bold = true;
                    continue;
                }
                if (line.startsWith(MARK_BOLD)) {
                    line = line.substring(MARK_BOLD.length());
                    size = 27f;
                    bold = true;
                    break;
                }
                break;
            }

            if (line.startsWith("   *") || line.startsWith("* ") || line.startsWith("   \u00bb")) {
                size = 26f;
            } else if (line.matches("-{8,}.*")) {
                size = 24f;
            }

            int gap = (lastWasBlank && !tight) ? GAP_SECTION : 0;
            rows.add(new Row(line, size, center, bold, gap));
            lastWasBlank = false;
        }
        return rows;
    }

    private static float measureTextHeight(TextPaint paint, String text, int maxWidth, boolean center) {
        if (text == null || text.isEmpty()) return paint.getTextSize() * 0.5f;
        Layout.Alignment align = center ? Layout.Alignment.ALIGN_CENTER : Layout.Alignment.ALIGN_NORMAL;
        StaticLayout layout = buildLayout(paint, text, maxWidth, align);
        return layout.getHeight();
    }

    private static float drawTextBlock(Canvas canvas, TextPaint paint, String text, boolean center, float y) {
        int maxWidth = PAPER_WIDTH - PADDING_X * 2;
        Layout.Alignment align = center ? Layout.Alignment.ALIGN_CENTER : Layout.Alignment.ALIGN_NORMAL;
        StaticLayout layout = buildLayout(paint, text, maxWidth, align);
        canvas.save();
        float x = center ? PADDING_X : PADDING_X;
        canvas.translate(x, y);
        layout.draw(canvas);
        canvas.restore();
        return layout.getHeight();
    }

    private static StaticLayout buildLayout(TextPaint paint, String text, int width, Layout.Alignment align) {
        return StaticLayout.Builder.obtain(text, 0, text.length(), paint, width)
            .setAlignment(align)
            .setLineSpacing(0f, 1.05f)
            .setIncludePad(false)
            .build();
    }

    static Bitmap createQrBitmap(String content, int size) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.MARGIN, 1);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        for (int x = 0; x < size; x++) {
            for (int y = 0; y < size; y++) {
                bmp.setPixel(x, y, matrix.get(x, y) ? Color.BLACK : Color.WHITE);
            }
        }
        return bmp;
    }
}
