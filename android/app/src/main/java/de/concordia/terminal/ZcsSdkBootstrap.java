package de.concordia.terminal;

import android.content.Context;
import android.util.Log;

import java.io.File;

/**
 * Loads ZCS SmartPos JNI + SDK from the vendor SmartPos APK on Kingtop Z91 terminals.
 * com.zcs.printer ships print-service stubs only; libSmartPosJni.so lives in com.szzcs.smartpos.
 */
final class ZcsSdkBootstrap {
    private static final String TAG = "ZcsSdkBootstrap";
    private static final String SMART_POS_PACKAGE = "com.szzcs.smartpos";
    private static final String ZCS_PRINT_PACKAGE = "com.zcs.printer";

    private static volatile boolean jniLoaded;
    private static volatile ClassLoader sdkLoader;
    private static volatile String sdkSourcePackage = "";

    private ZcsSdkBootstrap() {}

    static ClassLoader resolveSdkLoader(Context context) throws Exception {
        if (sdkLoader != null) return sdkLoader;

        ensureVendorJniLoaded(context);

        Exception lastError = null;
        for (String pkg : new String[] { SMART_POS_PACKAGE, ZCS_PRINT_PACKAGE }) {
            try {
                Context pkgContext = context.createPackageContext(
                    pkg,
                    Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
                );
                Class.forName("com.zcs.sdk.DriverManager", true, pkgContext.getClassLoader());
                sdkLoader = pkgContext.getClassLoader();
                sdkSourcePackage = pkg;
                Log.i(TAG, "ZCS SDK classloader from " + pkg);
                return sdkLoader;
            } catch (Exception e) {
                lastError = e;
                Log.w(TAG, "Could not load ZCS SDK from " + pkg, e);
            }
        }

        if (lastError != null) {
            throw lastError;
        }
        throw new ClassNotFoundException("ZCS DriverManager not found in vendor packages");
    }

    static String getSdkSourcePackage() {
        return sdkSourcePackage;
    }

    static void ensureVendorJniLoaded(Context context) {
        if (jniLoaded || context == null) return;
        synchronized (ZcsSdkBootstrap.class) {
            if (jniLoaded) return;

            try {
                System.loadLibrary("SmartPosJni");
                jniLoaded = true;
                Log.i(TAG, "Loaded bundled libSmartPosJni");
                return;
            } catch (UnsatisfiedLinkError ignored) {
                // expected — JNI ships in vendor APK on device
            }

            for (String pkg : new String[] { SMART_POS_PACKAGE, ZCS_PRINT_PACKAGE }) {
                try {
                    Context pkgContext = context.createPackageContext(
                        pkg,
                        Context.CONTEXT_INCLUDE_CODE | Context.CONTEXT_IGNORE_SECURITY
                    );
                    String libDir = pkgContext.getApplicationInfo().nativeLibraryDir;
                    if (libDir == null) continue;

                    File lib = new File(libDir, "libSmartPosJni.so");
                    if (!lib.exists()) {
                        Log.w(TAG, "libSmartPosJni.so missing in " + pkg + " nativeLibraryDir");
                        continue;
                    }

                    System.load(lib.getAbsolutePath());
                    jniLoaded = true;
                    Log.i(TAG, "Loaded libSmartPosJni from " + pkg + ": " + lib);
                    return;
                } catch (Exception e) {
                    Log.w(TAG, "Could not load libSmartPosJni from " + pkg, e);
                }
            }

            Log.w(TAG, "libSmartPosJni could not be loaded from app or vendor packages");
        }
    }
}
