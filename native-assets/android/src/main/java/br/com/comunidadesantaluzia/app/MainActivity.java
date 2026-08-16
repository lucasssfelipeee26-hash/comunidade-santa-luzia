package br.com.comunidadesantaluzia.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O AppCompat intercepta ActionMode por padrão. Isso fazia o WebView usar
        // uma camada intermediária para os menus de seleção/cópia/cola. Ao
        // desativar essa interceptação, o framework Android volta a desenhar e
        // colorir o menu contextual conforme o próprio aparelho/versão do SO.
        getDelegate().setHandleNativeActionModesEnabled(false);

        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(CaminhoDaLuzPlugin.class);
        registerPlugin(WhatajongPlugin.class);
        registerPlugin(OfflineStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
