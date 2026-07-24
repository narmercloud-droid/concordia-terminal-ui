package de.concordia.terminal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        boolean boot =
            Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
        if (!boot) return;
        if (!OrderForegroundService.isSessionActive(context)) return;

        String branchId = OrderForegroundService.getSavedBranchId(context);
        String branchName = OrderForegroundService.getSavedBranchName(context);
        OrderForegroundService.start(context, branchId, branchName);
        OrderForegroundService.launchMainActivity(context);
    }
}
