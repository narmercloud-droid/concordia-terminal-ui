package de.concordia.terminal;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.reflect.Method;

/**
 * Kingtop / Z90 / Z91 built-in printer via Imagpay MposHandler SDK.
 * Uses reflection so the app builds without vendor JARs; works when the SDK is on the device.
 */
@CapacitorPlugin(name = "KingtopPrint")
public class KingtopPrintPlugin extends Plugin {
    private static final String TAG = "KingtopPrint";
    private Object handler;
    private Object settings;
    private boolean initialized = false;

    private boolean hasSdk() {
        try {
            Class.forName("com.imagpay.mpos.MposHandler");
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    private synchronized boolean ensureReady() {
        if (!hasSdk()) return false;
        if (initialized && handler != null && settings != null) return true;

        try {
            Context context = getContext();
            Class<?> handlerClass = Class.forName("com.imagpay.mpos.MposHandler");
            Method getInstance = handlerClass.getMethod("getInstance", Context.class);
            handler = getInstance.invoke(null, context);

            Class<?> settingsClass = Class.forName("com.imagpay.Settings");
            Method settingsGetInstance = settingsClass.getMethod("getInstance", handlerClass);
            settings = settingsGetInstance.invoke(null, handler);

            Method powerOn = settingsClass.getMethod("mPosPowerOn");
            powerOn.invoke(settings);

            Method isConnected = handlerClass.getMethod("isConnected");
            boolean connected = Boolean.TRUE.equals(isConnected.invoke(handler));
            if (!connected) {
                Method connect = handlerClass.getMethod("connect");
                Object result = connect.invoke(handler);
                Log.i(TAG, "connect result: " + result);
            }

            initialized = true;
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Kingtop init failed: " + e.getMessage());
            initialized = false;
            handler = null;
            settings = null;
            return false;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", ensureReady());
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (!ensureReady()) {
            call.reject("Kingtop printer SDK not available on this device");
            return;
        }

        try {
            Class<?> settingsClass = settings.getClass();
            Method enterPrint = settingsClass.getMethod("mPosEnterPrint");
            enterPrint.invoke(settings);

            Method prnStr = settingsClass.getMethod("prnStr", String.class);
            prnStr.invoke(settings, text.endsWith("\n") ? text : text + "\n");

            Method prnStart = settingsClass.getMethod("prnStart");
            prnStart.invoke(settings);

            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Kingtop print failed: " + e.getMessage());
        }
    }
}
