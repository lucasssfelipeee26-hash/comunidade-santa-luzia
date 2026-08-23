package br.com.comunidadesantaluzia.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
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
        if (ehMotionBeta()) {
            prepararWebViewLocalFirst();
            agendarMotion();
        }
    }

    private boolean ehMotionBeta() {
        return MOTION_BETA_PACKAGE.equals(getPackageName());
    }

    private boolean temConexao() {
        try {
            ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo info = manager != null ? manager.getActiveNetworkInfo() : null;
            return info != null && info.isConnected();
        } catch (Exception erro) {
            return true;
        }
    }

    private void prepararWebViewLocalFirst() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(temConexao() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
    }

    private void agendarMotion() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        Runnable aplicar = () -> {
            try {
                prepararWebViewLocalFirst();
                String script = carregarMotionRuntime();
                if (script != null && !script.isEmpty()) webView.evaluateJavascript(script, null);
            } catch (Exception erro) {
                android.util.Log.e("SantaLuziaMotion", "Falha ao aplicar stack Motion empacotada", erro);
            }
        };

        // O WebView pode terminar a navegação e a hidratação do Next.js em momentos
        // diferentes conforme aparelho/rede. Reaplicar é seguro porque as camadas
        // da Windows Beta são idempotentes e usam guards próprios.
        webView.postDelayed(aplicar, 350);
        webView.postDelayed(aplicar, 900);
        webView.postDelayed(aplicar, 1800);
        webView.postDelayed(aplicar, 3200);
        webView.postDelayed(aplicar, 5200);
        webView.postDelayed(aplicar, 9000);
        webView.postDelayed(aplicar, 15000);
        webView.postDelayed(aplicar, 30000);
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