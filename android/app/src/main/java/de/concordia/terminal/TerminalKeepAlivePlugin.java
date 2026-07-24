package de.concordia.terminal;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "TerminalKeepAlive",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class TerminalKeepAlivePlugin extends Plugin {
    private PluginCall pendingStartCall;

    @PluginMethod
    public void startKeepAlive(PluginCall call) {
        String branchId = call.getString("branchId", "");
        String branchName = call.getString("branchName", "Concordia Terminal");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                pendingStartCall = call;
                requestPermissionForAlias(
                    "notifications",
                    call,
                    "onNotificationPermissionResult"
                );
                return;
            }
        }

        startKeepAliveInternal(branchId, branchName);
        call.resolve();
    }

    @PermissionCallback
    private void onNotificationPermissionResult(PluginCall call) {
        if (pendingStartCall != null) {
            PluginCall startCall = pendingStartCall;
            pendingStartCall = null;
            String branchId = startCall.getString("branchId", "");
            String branchName = startCall.getString("branchName", "Concordia Terminal");
            startKeepAliveInternal(branchId, branchName);
            startCall.resolve();
            return;
        }
        if (call != null) {
            call.resolve();
        }
    }

    private void startKeepAliveInternal(String branchId, String branchName) {
        OrderForegroundService.saveSession(getContext(), branchId, branchName);
        OrderForegroundService.start(getContext(), branchId, branchName);

        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).runOnUiThread(
                ((MainActivity) activity)::requestIgnoreBatteryOptimizations
            );
        }
    }

    @PluginMethod
    public void stopKeepAlive(PluginCall call) {
        OrderForegroundService.clearSession(getContext());
        OrderForegroundService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void bringToFront(PluginCall call) {
        Context context = getContext();
        try {
            Activity activity = getActivity();
            if (activity != null) {
                ActivityManager activityManager =
                    (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
                if (activityManager != null) {
                    activityManager.moveTaskToFront(
                        activity.getTaskId(),
                        ActivityManager.MOVE_TASK_WITH_HOME
                    );
                }
            } else {
                OrderForegroundService.launchMainActivity(context);
            }
        } catch (Exception ignored) {
            OrderForegroundService.launchMainActivity(context);
        }
        call.resolve();
    }

    /** Heads-up notification only — does not force the app open (WhatsApp-style). */
    @PluginMethod
    public void alertNewOrder(PluginCall call) {
        String summary = call.getString("summary", "");
        OrderForegroundService.alertNewOrder(getContext(), summary);
        call.resolve();
    }

    @PluginMethod
    public void isSessionActive(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", OrderForegroundService.isSessionActive(getContext()));
        call.resolve(result);
    }
}
