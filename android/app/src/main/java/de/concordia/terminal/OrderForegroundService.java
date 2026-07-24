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
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class OrderForegroundService extends Service {
    public static final String ACTION_START = "de.concordia.terminal.action.START_FG";
    public static final String ACTION_STOP = "de.concordia.terminal.action.STOP_FG";
    public static final String ACTION_ORDER_ALERT = "de.concordia.terminal.action.ORDER_ALERT";
    public static final String EXTRA_BRANCH_ID = "branch_id";
    public static final String EXTRA_BRANCH_NAME = "branch_name";
    public static final String EXTRA_ORDER_SUMMARY = "order_summary";

    private static final int NOTIFICATION_ID = 1001;
    private static final int ORDER_ALERT_NOTIFICATION_ID = 1002;
    private static final String CHANNEL_ID = "concordia_terminal_orders";
    private static final String ALERT_CHANNEL_ID = "concordia_terminal_order_alerts";
    static final String PREFS_NAME = "concordia_terminal";
    static final String PREF_SESSION_ACTIVE = "session_active";
    static final String PREF_BRANCH_ID = "branch_id";
    static final String PREF_BRANCH_NAME = "branch_name";

    private PowerManager.WakeLock wakeLock;

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

    public static void alertNewOrder(Context context, String summary) {
        Intent intent = new Intent(context, OrderForegroundService.class);
        intent.setAction(ACTION_ORDER_ALERT);
        intent.putExtra(EXTRA_ORDER_SUMMARY, summary == null ? "" : summary);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void launchMainActivity(Context context) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        context.startActivity(launch);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        // Must promote to foreground immediately — WebView init can delay onStartCommand.
        startForeground(NOTIFICATION_ID, buildOngoingNotification("Concordia Terminal"));
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            releaseWakeLock();
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

        startForeground(NOTIFICATION_ID, buildOngoingNotification(branchName));
        acquireWakeLock();

        if (intent != null && ACTION_ORDER_ALERT.equals(intent.getAction())) {
            String summary = intent.getStringExtra(EXTRA_ORDER_SUMMARY);
            postOrderAlert(summary);
            wakeScreenBriefly();
            // Do not force-open the UI — user taps the heads-up notification (WhatsApp-style).
        }

        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        if (!isSessionActive(this)) return;

        String branchId = getSavedBranchId(this);
        String branchName = getSavedBranchName(this);

        // Keep the foreground service alive so the process can restart, but do not pin/reopen the UI.
        Intent restartService = new Intent(getApplicationContext(), OrderForegroundService.class);
        restartService.setAction(ACTION_START);
        restartService.putExtra(EXTRA_BRANCH_ID, branchId);
        restartService.putExtra(EXTRA_BRANCH_NAME, branchName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getApplicationContext().startForegroundService(restartService);
        } else {
            getApplicationContext().startService(restartService);
        }
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
        if (isSessionActive(this)) {
            // System killed the service — ask Android to recreate it.
            start(getApplicationContext(), getSavedBranchId(this), getSavedBranchName(this));
        }
    }

    private void postOrderAlert(String summary) {
        String text = (summary == null || summary.trim().isEmpty())
            ? getString(R.string.order_alert_text_default)
            : summary.trim();

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        launchIntent.putExtra("open_from_order_alert", true);

        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            1,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle(getString(R.string.order_alert_title))
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(contentIntent)
            .setTimeoutAfter(120_000L)
            .build();

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(ORDER_ALERT_NOTIFICATION_ID, notification);
        }
    }

    private Notification buildOngoingNotification(String branchName) {
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

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel ongoing = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.fg_notification_channel),
            NotificationManager.IMPORTANCE_LOW
        );
        ongoing.setDescription(getString(R.string.fg_notification_channel_desc));
        ongoing.setShowBadge(false);
        manager.createNotificationChannel(ongoing);

        NotificationChannel alerts = new NotificationChannel(
            ALERT_CHANNEL_ID,
            getString(R.string.order_alert_channel),
            NotificationManager.IMPORTANCE_HIGH
        );
        alerts.setDescription(getString(R.string.order_alert_channel_desc));
        alerts.setShowBadge(true);
        alerts.enableVibration(true);
        alerts.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(alerts);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "concordia:terminal-orders"
        );
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private void wakeScreenBriefly() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        @SuppressWarnings("deprecation")
        PowerManager.WakeLock screenLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK
                | PowerManager.ACQUIRE_CAUSES_WAKEUP
                | PowerManager.ON_AFTER_RELEASE,
            "concordia:terminal-order-screen"
        );
        screenLock.acquire(5_000L);
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
