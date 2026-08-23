package br.com.comunidadesantaluzia.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final String MOTION_BETA_PACKAGE = "br.com.comunidadesantaluzia.motionbeta";
    private String motionRuntime;

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

        if (ehMotionBeta()) {
            prepararWebViewLocalFirst();
            agendarMotion();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (ehMotionBeta()) agendarMotion();
    }

    private boolean ehMotionBeta() {
        return MOTION_BETA_PACKAGE.equals(getPackageName());
    }

    private void prepararWebViewLocalFirst() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(true);
    }

    private void agendarMotion() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        Runnable aplicar = () -> {
            try {
                String script = carregarMotionRuntime();
                if (script != null && !script.isEmpty()) webView.evaluateJavascript(script, null);
            } catch (Exception erro) {
                android.util.Log.e("SantaLuziaMotion", "Falha ao aplicar runtime Motion empacotado", erro);
            }
        };

        // A primeira execução pega páginas que já carregaram; as seguintes cobrem
        // WebViews mais lentos sem substituir o WebViewClient interno do Capacitor.
        webView.postDelayed(aplicar, 700);
        webView.postDelayed(aplicar, 2200);
        webView.postDelayed(aplicar, 5200);
    }

    private String carregarMotionRuntime() throws Exception {
        if (motionRuntime != null) return motionRuntime;
        String windows = lerAssetTexto("public/motion/windows-beta-runtime.js");
        String android = lerAssetTexto("public/motion/android-motion-beta.js");
        motionRuntime = windows + "\n;\n" + android;
        return motionRuntime;
    }

    private String lerAssetTexto(String caminho) throws Exception {
        try (InputStream input = getAssets().open(caminho); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int lidos;
            while ((lidos = input.read(buffer)) != -1) output.write(buffer, 0, lidos);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
