package de.concordia.terminal;

import android.graphics.Bitmap;
import android.graphics.Color;

import java.io.ByteArrayOutputStream;

/** ESC/POS raster bitmap (GS v 0) for thermal printers. */
final class EscPosBitmapEncoder {
    private EscPosBitmapEncoder() {}

    static byte[] encode(Bitmap src, int maxWidth) {
        Bitmap scaled = src;
        if (src.getWidth() > maxWidth) {
            float ratio = maxWidth / (float) src.getWidth();
            int h = Math.max(1, Math.round(src.getHeight() * ratio));
            scaled = Bitmap.createScaledBitmap(src, maxWidth, h, true);
        }

        int width = scaled.getWidth();
        int height = scaled.getHeight();
        int bytesPerRow = (width + 7) / 8;

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0x1B);
        out.write(0x40); // init
        out.write(0x1B);
        out.write(0x61);
        out.write(0x01); // center

        int xL = bytesPerRow & 0xFF;
        int xH = (bytesPerRow >> 8) & 0xFF;
        int yL = height & 0xFF;
        int yH = (height >> 8) & 0xFF;

        out.write(0x1D);
        out.write(0x76);
        out.write(0x30);
        out.write(0x00);
        out.write(xL);
        out.write(xH);
        out.write(yL);
        out.write(yH);

        for (int y = 0; y < height; y++) {
            for (int xByte = 0; xByte < bytesPerRow; xByte++) {
                int value = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = xByte * 8 + bit;
                    if (x < width) {
                        int pixel = scaled.getPixel(x, y);
                        int gray = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3;
                        if (gray < 160) {
                            value |= (0x80 >> bit);
                        }
                    }
                }
                out.write(value);
            }
        }

        out.write(0x1B);
        out.write(0x61);
        out.write(0x00);
        out.write(0x1B);
        out.write(0x64);
        out.write(0x04);
        return out.toByteArray();
    }
}
