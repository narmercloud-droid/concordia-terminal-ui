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

# Vendor printer SDKs are loaded via reflection on the device — do not strip our plugin
-keepclassmembers class * {
    public <init>(...);
}
