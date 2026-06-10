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
 * Kingtop Z90/Z91 built-in printer via Imagpay/ZCS MposHandler SDK.
 * Uses reflection so the app builds without vendor JARs; works when the SDK is preinstalled on the device.
 */
@CapacitorPlugin(name = "KingtopPrint")
public class KingtopPrintPlugin extends Plugin {
    private static final String TAG = "KingtopPrint";
    private static final String[] HANDLER_CLASSES = {
        "com.imagpay.mpos.MposHandler",
        "com.imagpay.MposHandler",
        "com.zcs.sdk.MposHandler"
    };
    private static final String[] SETTINGS_CLASSES = {
        "com.imagpay.Settings",
        "com.imagpay.mpos.Settings",
        "com.zcs.sdk.Settings"
    };

    private Object handler;
    private Object settings;
    private Class<?> handlerClass;
    private Class<?> settingsClass;
    private String lastInitError = "SDK not initialized";

    private boolean tryLoadClass(String name) {
        try {
            Class.forName(name);
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    private Object resolvePosModel() {
        String[] modelClasses = {
            "com.imagpay.mpos.PosModel",
            "com.imagpay.PosModel",
            "com.zcs.sdk.PosModel"
        };
        for (String modelClassName : modelClasses) {
            try {
                Class<?> modelClass = Class.forName(modelClassName);
                for (String modelName : new String[] { "Z91", "Z90" }) {
                    try {
                        @SuppressWarnings({ "unchecked", "rawtypes" })
                        Object value = Enum.valueOf((Class<Enum>) modelClass, modelName);
                        return value;
                    } catch (IllegalArgumentException ignored) {
                        // try next model name
                    }
                }
            } catch (ClassNotFoundException ignored) {
                // try next class name
            }
        }
        return null;
    }

    private synchronized boolean ensureReady() {
        if (initialized()) return true;

        Context context = getContext();
        for (String handlerName : HANDLER_CLASSES) {
            if (!tryLoadClass(handlerName)) continue;
            try {
                handlerClass = Class.forName(handlerName);
                Object posModel = resolvePosModel();
                if (posModel != null) {
                    Method getInstance = handlerClass.getMethod("getInstance", Context.class, posModel.getClass());
                    handler = getInstance.invoke(null, context, posModel);
                } else {
                    Method getInstance = handlerClass.getMethod("getInstance", Context.class);
                    handler = getInstance.invoke(null, context);
                }

                Method isConnected = handlerClass.getMethod("isConnected");
                boolean connected = Boolean.TRUE.equals(isConnected.invoke(handler));
                if (!connected) {
                    Method connect = handlerClass.getMethod("connect");
                    connect.invoke(handler);
                }

                for (String settingsName : SETTINGS_CLASSES) {
                    if (!tryLoadClass(settingsName)) continue;
                    settingsClass = Class.forName(settingsName);
                    try {
                        Method getInstance = settingsClass.getMethod("getInstance", handlerClass);
                        settings = getInstance.invoke(null, handler);
                    } catch (NoSuchMethodException e) {
                        settings = settingsClass.getConstructor(handlerClass).newInstance(handler);
                    }
                    lastInitError = "";
                    return true;
                }
                lastInitError = "MposHandler found but Settings class missing";
            } catch (Exception e) {
                lastInitError = handlerName + ": " + e.getMessage();
                Log.w(TAG, "Kingtop init failed for " + handlerName + ": " + e.getMessage());
                handler = null;
                settings = null;
                handlerClass = null;
                settingsClass = null;
            }
        }

        if (lastInitError.isEmpty()) {
            lastInitError = "Imagpay/ZCS printer SDK not found on device";
        }
        return false;
    }

    private boolean initialized() {
        return handler != null && settings != null && handlerClass != null && settingsClass != null;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        boolean available = ensureReady();
        result.put("available", available);
        if (!available) {
            result.put("reason", lastInitError);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject result = new JSObject();
        StringBuilder found = new StringBuilder();
        for (String name : HANDLER_CLASSES) {
            if (tryLoadClass(name)) {
                if (found.length() > 0) found.append(", ");
                found.append(name);
            }
        }
        result.put("handlerClassesFound", found.length() > 0 ? found.toString() : "none");
        result.put("available", ensureReady());
        result.put("lastError", lastInitError);
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (!ensureReady()) {
            call.reject("Kingtop printer SDK not available: " + lastInitError);
            return;
        }

        final Object settingsRef = settings;
        final Class<?> settingsRefClass = settingsClass;
        new Thread(() -> {
            try {
                Method enterPrint = settingsRefClass.getMethod("mPosEnterPrint");
                Boolean entered = (Boolean) enterPrint.invoke(settingsRef);
                if (entered != null && !entered) {
                    rejectOnMain(call, "mPosEnterPrint failed");
                    return;
                }

                Method prnStr = settingsRefClass.getMethod("mPosPrnStr", String.class);
                String[] lines = text.split("\n", -1);
                for (String line : lines) {
                    prnStr.invoke(settingsRef, line + "\n");
                }

                try {
                    Method exitPrint = settingsRefClass.getMethod("mPosExitPrint");
                    exitPrint.invoke(settingsRef);
                } catch (NoSuchMethodException ignored) {
                    // Some firmware builds omit explicit exit call.
                }

                JSObject result = new JSObject();
                result.put("ok", true);
                resolveOnMain(call, result);
            } catch (Exception e) {
                rejectOnMain(call, "Kingtop print failed: " + e.getMessage());
            }
        }).start();
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
