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
 * Kingtop Z90/Z91 built-in printer via Imagpay/ZCS SDK (same stack as legacy POS apps on device).
 * Uses reflection so the app builds without vendor JARs; vendor classes ship on the terminal firmware.
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
    private String initPath = "";

    private boolean tryLoadClass(String name) {
        try {
            Class.forName(name);
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    private Object resolvePosModel(Class<?> handlerCls) {
        String handlerPackage = handlerCls.getPackage() != null ? handlerCls.getPackage().getName() : "";
        String[] modelClasses = {
            handlerPackage + ".PosModel",
            "com.imagpay.mpos.PosModel",
            "com.imagpay.PosModel",
            "com.zcs.sdk.PosModel"
        };

        for (String modelClassName : modelClasses) {
            try {
                Class<?> modelClass = Class.forName(modelClassName);
                for (String modelName : new String[] { "Z91", "Z90", "Z92" }) {
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

    private Object invokeStaticNoArg(Class<?> cls, String methodName) throws Exception {
        Method method = cls.getMethod(methodName);
        return method.invoke(null);
    }

    private Object createHandler(Context context, Class<?> handlerCls) throws Exception {
        // Match legacy Imagpay demo: MposHandler.getInstance(context) first
        try {
            Method getInstance = handlerCls.getMethod("getInstance", Context.class);
            Object instance = getInstance.invoke(null, context);
            if (instance != null) return instance;
        } catch (NoSuchMethodException ignored) {
            // fall through
        }

        try {
            Object instance = invokeStaticNoArg(handlerCls, "getInstance");
            if (instance != null) return instance;
        } catch (NoSuchMethodException ignored) {
            // fall through
        }

        Object posModel = resolvePosModel(handlerCls);
        if (posModel != null) {
            Method getInstance = handlerCls.getMethod("getInstance", Context.class, posModel.getClass());
            return getInstance.invoke(null, context, posModel);
        }

        throw new NoSuchMethodException("No supported getInstance() on " + handlerCls.getName());
    }

    private Object createSettings(Class<?> handlerCls, Object handlerRef) throws Exception {
        for (String settingsName : SETTINGS_CLASSES) {
            if (!tryLoadClass(settingsName)) continue;
            settingsClass = Class.forName(settingsName);
            try {
                Method getInstance = settingsClass.getMethod("getInstance", handlerCls);
                return getInstance.invoke(null, handlerRef);
            } catch (NoSuchMethodException e) {
                return settingsClass.getConstructor(handlerCls).newInstance(handlerRef);
            }
        }
        throw new ClassNotFoundException("Settings class missing");
    }

    private void powerOnAndConnect() throws Exception {
        try {
            Method powerOn = settingsClass.getMethod("mPosPowerOn");
            powerOn.invoke(settings);
        } catch (NoSuchMethodException ignored) {
            // optional on some firmware builds
        }

        // Z90/Z91 SDK notes: wait before serial connect
        Thread.sleep(1000);

        Method isConnected = handlerClass.getMethod("isConnected");
        boolean connected = Boolean.TRUE.equals(isConnected.invoke(handler));
        if (!connected) {
            Method connect = handlerClass.getMethod("connect");
            Object connectResult = connect.invoke(handler);
            Log.i(TAG, "connect() => " + String.valueOf(connectResult));
            Thread.sleep(300);
        }
    }

    private synchronized boolean ensureReady() {
        if (initialized()) return true;

        Context context = getContext();
        for (String handlerName : HANDLER_CLASSES) {
            if (!tryLoadClass(handlerName)) continue;

            try {
                handlerClass = Class.forName(handlerName);
                handler = createHandler(context, handlerClass);
                settings = createSettings(handlerClass, handler);
                powerOnAndConnect();

                initPath = handlerName;
                lastInitError = "";
                Log.i(TAG, "Kingtop SDK ready via " + handlerName);
                return true;
            } catch (Exception e) {
                lastInitError = handlerName + ": " + e.getMessage();
                Log.w(TAG, "Kingtop init failed for " + handlerName, e);
                handler = null;
                settings = null;
                handlerClass = null;
                settingsClass = null;
                initPath = "";
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

    private boolean tryPrintWithPrnStr(String text) throws Exception {
        // Legacy demo: single prnStr then prnStart
        try {
            Method prnStr = settingsClass.getMethod("prnStr", String.class);
            prnStr.invoke(settings, text);
            Method prnStart = settingsClass.getMethod("prnStart");
            prnStart.invoke(settings);
            return true;
        } catch (NoSuchMethodException e) {
            Method prnStr = settingsClass.getMethod("prnStr", String.class);
            prnStr.invoke(settings, text);
            return true;
        }
    }

    private boolean tryPrintWithMposStr(String text) throws Exception {
        Method enterPrint = settingsClass.getMethod("mPosEnterPrint");
        Boolean entered = (Boolean) enterPrint.invoke(settings);
        if (entered != null && !entered) {
            throw new IllegalStateException("mPosEnterPrint failed");
        }

        Method prnStr = settingsClass.getMethod("mPosPrnStr", String.class);
        String[] lines = text.split("\n", -1);
        for (String line : lines) {
            prnStr.invoke(settings, line + "\n");
        }

        try {
            Method exitPrint = settingsClass.getMethod("mPosExitPrint");
            exitPrint.invoke(settings);
        } catch (NoSuchMethodException ignored) {
            // optional
        }
        return true;
    }

    private boolean tryPrintOnHandler(String text) throws Exception {
        try {
            Method prnStr = handlerClass.getMethod("mPosPrnStr", String.class);
            prnStr.invoke(handler, text);
            return true;
        } catch (NoSuchMethodException ignored) {
            // fall through
        }

        Method prnStr = handlerClass.getMethod("prnStr", String.class);
        prnStr.invoke(handler, text);
        return true;
    }

    private void printTextInternal(String text) throws Exception {
        Exception lastError = null;

        try {
            if (tryPrintWithPrnStr(text)) {
                Log.i(TAG, "Printed via Settings.prnStr/prnStart");
                return;
            }
        } catch (Exception e) {
            lastError = e;
            Log.w(TAG, "prnStr/prnStart failed", e);
        }

        try {
            if (tryPrintWithMposStr(text)) {
                Log.i(TAG, "Printed via mPosEnterPrint/mPosPrnStr");
                return;
            }
        } catch (Exception e) {
            lastError = e;
            Log.w(TAG, "mPosPrnStr path failed", e);
        }

        try {
            if (tryPrintOnHandler(text)) {
                Log.i(TAG, "Printed via handler direct API");
                return;
            }
        } catch (Exception e) {
            lastError = e;
            Log.w(TAG, "handler print failed", e);
        }

        if (lastError != null) {
            throw lastError;
        }
        throw new IllegalStateException("No print method succeeded");
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        new Thread(() -> {
            JSObject result = new JSObject();
            boolean available = ensureReady();
            result.put("available", available);
            if (!available) {
                result.put("reason", lastInitError);
            } else {
                result.put("initPath", initPath);
            }
            resolveOnMain(call, result);
        }).start();
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        new Thread(() -> {
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
            result.put("initPath", initPath);
            resolveOnMain(call, result);
        }).start();
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        String text = call.getString("text", "");
        String qrUrl = call.getString("qrUrl");
        String footerText = call.getString("footerText", "");

        new Thread(() -> {
            try {
                if (!ensureReady()) {
                    rejectOnMain(call, "Kingtop printer SDK not available: " + lastInitError);
                    return;
                }
                printTextInternal(text);
                boolean qrPrinted = true;
                if (qrUrl != null && !qrUrl.trim().isEmpty()) {
                    qrPrinted = KingtopQrPrint.print(getContext(), qrUrl.trim(), footerText);
                }
                JSObject result = new JSObject();
                result.put("ok", qrPrinted);
                result.put("qrPrinted", qrPrinted);
                resolveOnMain(call, result);
            } catch (Exception e) {
                Log.e(TAG, "Kingtop receipt print failed", e);
                rejectOnMain(call, "Kingtop receipt print failed: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");

        new Thread(() -> {
            try {
                if (!ensureReady()) {
                    rejectOnMain(call, "Kingtop printer SDK not available: " + lastInitError);
                    return;
                }
                printTextInternal(text);
                JSObject result = new JSObject();
                result.put("ok", true);
                resolveOnMain(call, result);
            } catch (Exception e) {
                Log.e(TAG, "Kingtop print failed", e);
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
