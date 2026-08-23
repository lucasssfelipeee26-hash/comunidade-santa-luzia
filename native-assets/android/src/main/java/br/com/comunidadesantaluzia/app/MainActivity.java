package br.com.comunidadesantaluzia.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String MOTION_BETA_PACKAGE = "br.com.comunidadesantaluzia.motionbeta";
    private String motionRuntime;

    @Override
    public void onCreate(Bundle savedInstanceState) {
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
    public void onResume() {
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
                android.util.Log.e("SantaLuziaMotion", "Falha ao aplicar stack Motion empacotada", erro);
            }
        };

        // O WebView pode terminar a hidratação do Next.js em momentos diferentes
        // conforme o aparelho. Reaplicar é seguro porque cada camada é idempotente.
        webView.postDelayed(aplicar, 450);
        webView.postDelayed(aplicar, 1200);
        webView.postDelayed(aplicar, 2600);
        webView.postDelayed(aplicar, 5200);
    }

    private String carregarMotionRuntime() throws Exception {
        if (motionRuntime != null) return motionRuntime;

        String css = lerAssetTexto("public/motion/windows-motion-fixes.css");
        String behavior = lerAssetTexto("public/motion/windows-behavior-fixes.js");
        String polish = lerAssetTexto("public/motion/windows-beta7-polish.js");
        String preload = lerAssetTexto("public/motion/windows-preload-v5.js");
        String runtime = lerAssetTexto("public/motion/windows-beta-runtime.js");
        String android = lerAssetTexto("public/motion/android-motion-beta.js");

        String cssBootstrap = "(() => {" +
            "const id='sl-motion-beta-windows-css-android';" +
            "let s=document.getElementById(id);" +
            "if(!s){s=document.createElement('style');s.id=id;document.head&&document.head.appendChild(s);}" +
            "if(s)s.textContent=" + JSONObject.quote(css) + ";" +
            "})();";

        // Espelha a ordem efetiva usada pelo Electron: CSS -> behavior -> polish ->
        // preload visual -> runtime consolidado -> adaptações Android.
        motionRuntime = cssBootstrap + "\n;\n" +
            behavior + "\n;\n" +
            polish + "\n;\n" +
            preload + "\n;\n" +
            runtime + "\n;\n" +
            android;
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
