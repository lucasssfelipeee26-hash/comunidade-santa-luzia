package br.com.comunidadesantaluzia.app;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O design do aplicativo é claro. Impede que o Android/Samsung injete
        // automaticamente texto branco em popups, campos e menus de seleção.
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);

        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(CaminhoDaLuzPlugin.class);
        registerPlugin(OfflineStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
