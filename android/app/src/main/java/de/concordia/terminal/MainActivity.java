package de.concordia.terminal;

import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long RETURN_DELAY_MS = 3000L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable bringToFrontRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SunmiPrintPlugin.class);
        registerPlugin(ZcsPrintPlugin.class);
        registerPlugin(KingtopPrintPlugin.class);
        registerPlugin(NetworkPrintPlugin.class);
        registerPlugin(AlertSoundPlugin.class);
        registerPlugin(TerminalKeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enableImmersiveMode();
        tuneWebView();
        warmUpVendorPrintStack();
    }

    private void warmUpVendorPrintStack() {
        new Thread(() -> {
            try {
                startService(new Intent().setComponent(
                    new ComponentName("com.zcs.printer", "com.zcs.printer.LocalPrintService")
                ));
            } catch (Exception ignored) {
                // optional vendor service
            }
            try {
                getPackageManager().getPackageInfo("com.szzcs.smartpos", 0);
                createPackageContext(
                    "com.szzcs.smartpos",
                    Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
                );
            } catch (Exception ignored) {
                // vendor demo app not installed
            }
        }).start();
    }

    @Override
    public void onResume() {
        super.onResume();
        cancelBringToFront();
        enableImmersiveMode();
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        scheduleBringToFront();
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

    private void scheduleBringToFront() {
        cancelBringToFront();
        bringToFrontRunnable = () -> {
            try {
                ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                if (activityManager != null) {
                    activityManager.moveTaskToFront(getTaskId(), ActivityManager.MOVE_TASK_WITH_HOME);
                }
            } catch (Exception ignored) {
                Intent intent = new Intent(this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
            }
        };
        mainHandler.postDelayed(bringToFrontRunnable, RETURN_DELAY_MS);
    }

    private void cancelBringToFront() {
        if (bringToFrontRunnable != null) {
            mainHandler.removeCallbacks(bringToFrontRunnable);
            bringToFrontRunnable = null;
        }
    }

    private void tuneWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDomStorageEnabled(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
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
