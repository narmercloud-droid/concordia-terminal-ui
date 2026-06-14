package de.concordia.terminal;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlertSound")
public class AlertSoundPlugin extends Plugin {
    @PluginMethod
    public void playPendingAlert(PluginCall call) {
        runOnUi(() -> {
            MelodicChimePlayer.play(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void startPendingAlertLoop(PluginCall call) {
        runOnUi(() -> {
            MelodicChimePlayer.startLoop(getContext());
            call.resolve();
        });
    }

    @PluginMethod
    public void stopPendingAlert(PluginCall call) {
        runOnUi(() -> {
            MelodicChimePlayer.stopLoop(getContext());
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        MelodicChimePlayer.stopLoop(getContext());
        super.handleOnDestroy();
    }

    private void runOnUi(Runnable action) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(action);
            return;
        }
        action.run();
    }
}
