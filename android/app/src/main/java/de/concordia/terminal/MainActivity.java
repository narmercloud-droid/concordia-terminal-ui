package de.concordia.terminal;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Kitchen terminal UI. No lock-task / pinning — behaves like a normal app.
 * Order alerts come via notification while a foreground keep-alive service runs.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SunmiPrintPlugin.class);
        registerPlugin(NetworkPrintPlugin.class);
        registerPlugin(AlertSoundPlugin.class);
        registerPlugin(TerminalKeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
        // Ensure any previous lock-task / pin session from older builds is cleared.
        try {
            stopLockTask();
        } catch (Exception ignored) {
            // ignore
        }
        applyWakeAndShowFlags();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enableImmersiveMode();
        tuneWebView();

        if (OrderForegroundService.isSessionActive(this)) {
            String branchId = OrderForegroundService.getSavedBranchId(this);
            String branchName = OrderForegroundService.getSavedBranchName(this);
            OrderForegroundService.start(this, branchId, branchName);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        enableImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "(function(){window.dispatchEvent(new CustomEvent('concordia-hardware-back'));})();",
                null
            );
            return;
        }
        super.onBackPressed();
    }

    void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            String packageName = getPackageName();
            if (pm.isIgnoringBatteryOptimizations(packageName)) return;
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + packageName));
            startActivity(intent);
        } catch (Exception ignored) {
            // Some OEMs block this intent.
        }
    }

    private void applyWakeAndShowFlags() {
        // Allow order-alert taps to wake / show over lock screen (WhatsApp-style).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
    }

    private void tuneWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDomStorageEnabled(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            WebView.setWebContentsDebuggingEnabled(debuggable);
        }
    }

    private void enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }
}
