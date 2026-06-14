package de.concordia.terminal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class OrderForegroundService extends Service {
    public static final String ACTION_START = "de.concordia.terminal.action.START_FG";
    public static final String ACTION_STOP = "de.concordia.terminal.action.STOP_FG";
    public static final String EXTRA_BRANCH_ID = "branch_id";
    public static final String EXTRA_BRANCH_NAME = "branch_name";

    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "concordia_terminal_orders";
    static final String PREFS_NAME = "concordia_terminal";
    static final String PREF_SESSION_ACTIVE = "session_active";
    static final String PREF_BRANCH_ID = "branch_id";
    static final String PREF_BRANCH_NAME = "branch_name";

    public static void start(Context context, String branchId, String branchName) {
        Intent intent = new Intent(context, OrderForegroundService.class);
        intent.setAction(ACTION_START);
        intent.putExtra(EXTRA_BRANCH_ID, branchId == null ? "" : branchId);
        intent.putExtra(EXTRA_BRANCH_NAME, branchName == null ? "Concordia Terminal" : branchName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, OrderForegroundService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        // Must promote to foreground immediately — WebView init can delay onStartCommand.
        startForeground(NOTIFICATION_ID, buildNotification("Concordia Terminal"));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String branchName = intent != null
            ? intent.getStringExtra(EXTRA_BRANCH_NAME)
            : null;
        if (branchName == null || branchName.trim().isEmpty()) {
            branchName = getSavedBranchName(this);
        }
        if (branchName == null || branchName.trim().isEmpty()) {
            branchName = "Concordia Terminal";
        }

        Notification notification = buildNotification(branchName);
        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    private Notification buildNotification(String branchName) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.fg_notification_title))
            .setContentText(getString(R.string.fg_notification_text, branchName))
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.fg_notification_channel),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.fg_notification_channel_desc));
        channel.setShowBadge(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    static void saveSession(Context context, String branchId, String branchName) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean(PREF_SESSION_ACTIVE, true)
            .putString(PREF_BRANCH_ID, branchId == null ? "" : branchId)
            .putString(PREF_BRANCH_NAME, branchName == null ? "Concordia Terminal" : branchName)
            .apply();
    }

    static void clearSession(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean(PREF_SESSION_ACTIVE, false)
            .remove(PREF_BRANCH_ID)
            .remove(PREF_BRANCH_NAME)
            .apply();
    }

    static boolean isSessionActive(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(PREF_SESSION_ACTIVE, false);
    }

    static String getSavedBranchId(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(PREF_BRANCH_ID, "");
    }

    static String getSavedBranchName(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(PREF_BRANCH_NAME, "Concordia Terminal");
    }
}
