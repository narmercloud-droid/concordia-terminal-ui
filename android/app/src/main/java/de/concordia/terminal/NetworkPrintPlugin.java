package de.concordia.terminal;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.Charset;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Raw ESC/POS over TCP (port 9100) for kitchen printers on the local network
 * (USB printer shared via PC, or dedicated network receipt printer).
 */
@CapacitorPlugin(name = "NetworkPrint")
public class NetworkPrintPlugin extends Plugin {
    private static final String TAG = "NetworkPrint";
    private static final Charset PRINT_CHARSET = Charset.forName("ISO-8859-1");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void isAvailable(PluginCall call) {
        String host = call.getString("host", "").trim();
        int port = call.getInt("port", 9100);
        JSObject result = new JSObject();
        boolean ok = host != null && !host.isEmpty() && port > 0 && port < 65536;
        result.put("available", ok);
        if (!ok) {
            result.put("reason", "Printer IP not configured");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String host = call.getString("host", "").trim();
        int port = call.getInt("port", 9100);
        String text = call.getString("text", "");
        int timeoutMs = call.getInt("timeoutMs", 8000);

        if (host == null || host.isEmpty()) {
            call.reject("Printer IP address is required");
            return;
        }

        executor.execute(() -> {
            Socket socket = null;
            try {
                socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), timeoutMs);
                socket.setSoTimeout(timeoutMs);

                OutputStream out = socket.getOutputStream();
                out.write(new byte[] { 0x1B, 0x40 }); // ESC @ init
                out.write(text.getBytes(PRINT_CHARSET));
                out.write("\n\n\n".getBytes(PRINT_CHARSET));
                out.write(new byte[] { 0x1D, 0x56, 0x00 }); // partial cut
                out.flush();

                JSObject result = new JSObject();
                result.put("ok", true);
                resolveOnMain(call, result);
            } catch (Exception e) {
                Log.e(TAG, "Network print failed", e);
                rejectOnMain(call, "Network print failed: " + e.getMessage());
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (Exception ignored) {
                    }
                }
            }
        });
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
