# Capacitor / WebView
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
    @com.getcapacitor.PluginMethod <methods>;
}

# Concordia native plugins (reflection targets vendor SDKs on device)
-keep class de.concordia.terminal.** { *; }

# Sunmi printer SDK
-keep class com.sunmi.peripheral.printer.** { *; }
-dontwarn com.sunmi.**

# Imagpay / ZCS Kingtop printer SDK (loaded via reflection on device)
-keep class com.imagpay.** { *; }
-keep class com.zcs.sdk.** { *; }
-dontwarn com.imagpay.**
-dontwarn com.zcs.sdk.**

# Vendor printer SDKs are loaded via reflection on the device — do not strip our plugin
-keepclassmembers class * {
    public <init>(...);
}
