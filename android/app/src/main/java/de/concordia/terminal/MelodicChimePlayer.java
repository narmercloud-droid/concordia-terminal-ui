package de.concordia.terminal;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;

/** Short C5–E5–G5 chime for new pending orders. Repeats until stopLoop(). */
final class MelodicChimePlayer {
    private static MediaPlayer mediaPlayer;
    private static Handler repeatHandler;
    private static Runnable repeatTask;
    private static boolean looping;
    private static final long REPEAT_MS = 6_000L;

    private MelodicChimePlayer() {}

    static synchronized void startLoop(Context context) {
        stopLoop(context);
        looping = true;
        Context app = context.getApplicationContext();
        repeatHandler = new Handler(Looper.getMainLooper());
        repeatTask = new Runnable() {
            @Override
            public void run() {
                if (!looping) return;
                playOnce(app);
                if (looping && repeatHandler != null) {
                    repeatHandler.postDelayed(this, REPEAT_MS);
                }
            }
        };
        playOnce(app);
        repeatHandler.postDelayed(repeatTask, REPEAT_MS);
    }

    static synchronized void play(Context context) {
        playOnce(context.getApplicationContext());
    }

    static synchronized void stop(Context context) {
        stopLoop(context);
    }

    static synchronized void stopLoop(Context context) {
        looping = false;
        if (repeatHandler != null && repeatTask != null) {
            repeatHandler.removeCallbacks(repeatTask);
        }
        repeatHandler = null;
        repeatTask = null;
        stopInternal();
    }

    private static void playOnce(Context app) {
        stopInternal();
        mediaPlayer = MediaPlayer.create(app, R.raw.new_order_chime);
        if (mediaPlayer == null) return;

        mediaPlayer.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        mediaPlayer.setVolume(1.0f, 1.0f);
        try {
            AudioManager audioManager = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
            }
        } catch (Exception ignored) {
            // Some devices restrict programmatic volume changes
        }
        mediaPlayer.setOnCompletionListener(mp -> stopInternal());
        mediaPlayer.start();
    }

    private static void stopInternal() {
        if (mediaPlayer == null) return;
        try {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
            }
        } catch (Exception ignored) {
            // MediaPlayer may already be in an invalid state
        }
        mediaPlayer.release();
        mediaPlayer = null;
    }
}
