package br.com.comunidadesantaluzia.app;

import android.os.Build;
import android.os.Bundle;
import android.view.ActionMode;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);

        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(CaminhoDaLuzPlugin.class);
        registerPlugin(OfflineStorePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && type == ActionMode.TYPE_FLOATING) {
            ActionMode mode = super.onWindowStartingActionMode(callback, ActionMode.TYPE_PRIMARY);
            if (mode != null) {
                mode.setType(ActionMode.TYPE_PRIMARY);
            }
            return mode;
        }
        return super.onWindowStartingActionMode(callback, type);
    }

    @Override
    public void onActionModeStarted(ActionMode mode) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && mode != null && mode.getType() == ActionMode.TYPE_FLOATING) {
            mode.setType(ActionMode.TYPE_PRIMARY);
        }
        super.onActionModeStarted(mode);
    }
}
