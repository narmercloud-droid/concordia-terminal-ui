package de.concordia.terminal;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Over-the-air APK updates from concordia-updates (Wi‑Fi).
 * Downloads the APK then opens the system installer (Android requires one confirm tap).
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean downloadInFlight = false;

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo info = pm.getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName != null ? info.versionName : "");
            long code;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                code = info.getLongVersionCode();
            } else {
                code = info.versionCode;
            }
            ret.put("versionCode", code);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read app version: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject ret = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("No activity");
                return;
            }
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            activity.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open install settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("url");
        String expectedChecksum = call.getString("checksum");
        if (apkUrl == null || apkUrl.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        if (downloadInFlight) {
            call.reject("Download already in progress");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject ret = new JSObject();
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }

        downloadInFlight = true;
        executor.execute(() -> {
            File apkFile = null;
            try {
                notifyProgress(0, "downloading");
                apkFile = downloadApk(apkUrl.trim());
                if (expectedChecksum != null && !expectedChecksum.trim().isEmpty()) {
                    String actual = sha256(apkFile);
                    if (!actual.equalsIgnoreCase(expectedChecksum.trim())) {
                        //noinspection ResultOfMethodCallIgnored
                        apkFile.delete();
                        rejectOnMain(call, "APK checksum mismatch");
                        return;
                    }
                }
                notifyProgress(100, "installing");
                installApk(apkFile);
                JSObject ret = new JSObject();
                ret.put("needsPermission", false);
                ret.put("startedInstall", true);
                resolveOnMain(call, ret);
            } catch (Exception e) {
                if (apkFile != null) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                }
                rejectOnMain(call, e.getMessage() != null ? e.getMessage() : "Update failed");
            } finally {
                downloadInFlight = false;
            }
        });
    }

    private File downloadApk(String apkUrl) throws Exception {
        HttpURLConnection connection = openFollowingRedirects(apkUrl);
        try {
            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new Exception("APK download failed (HTTP " + code + ")");
            }

            long total = connection.getContentLengthLong();
            File outFile = new File(getContext().getCacheDir(), "concordia-terminal-update.apk");
            if (outFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                outFile.delete();
            }

            try (InputStream in = connection.getInputStream();
                 FileOutputStream out = new FileOutputStream(outFile)) {
                byte[] buffer = new byte[8192];
                long readTotal = 0;
                int n;
                int lastPct = -1;
                while ((n = in.read(buffer)) >= 0) {
                    out.write(buffer, 0, n);
                    readTotal += n;
                    if (total > 0) {
                        int pct = (int) Math.min(99, (readTotal * 100) / total);
                        if (pct != lastPct && pct % 5 == 0) {
                            lastPct = pct;
                            notifyProgress(pct, "downloading");
                        }
                    }
                }
                out.flush();
            }
            return outFile;
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection openFollowingRedirects(String apkUrl) throws Exception {
        String current = apkUrl;
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
            connection.setConnectTimeout(30_000);
            connection.setReadTimeout(120_000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "ConcordiaTerminalUpdater/1.0");
            connection.connect();
            int code = connection.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("APK download redirect missing Location");
                }
                current = location;
                continue;
            }
            return connection;
        }
        throw new Exception("Too many redirects downloading APK");
    }

    private void installApk(File apkFile) throws Exception {
        Activity activity = getActivity();
        if (activity == null) {
            throw new Exception("No activity for install");
        }
        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) >= 0) {
                digest.update(buffer, 0, n);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private void notifyProgress(int percent, String phase) {
        JSObject data = new JSObject();
        data.put("percent", percent);
        data.put("phase", phase);
        notifyListeners("appUpdateProgress", data);
    }

    private void resolveOnMain(PluginCall call, JSObject ret) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(ret);
            return;
        }
        activity.runOnUiThread(() -> call.resolve(ret));
    }

    private void rejectOnMain(PluginCall call, String message) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject(message);
            return;
        }
        activity.runOnUiThread(() -> call.reject(message));
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
