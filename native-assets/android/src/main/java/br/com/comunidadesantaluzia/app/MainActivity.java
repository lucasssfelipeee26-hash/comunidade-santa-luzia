package br.com.comunidadesantaluzia.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
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
    private MotionOfflineWebViewClient motionClient;
    private boolean serviceWorkerConfigured = false;
    private boolean offlineRecoveryTriggered = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getDelegate().setHandleNativeActionModesEnabled(false);

        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(CaminhoDaLuzPlugin.class);
        registerPlugin(WhatajongPlugin.class);
        registerPlugin(OfflineStorePlugin.class);
        super.onCreate(savedInstanceState);

        if (ehMotionBeta()) {
            prepararWebViewOriginalOffline();
            agendarMotion();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (ehMotionBeta()) {
            prepararWebViewOriginalOffline();
            agendarMotion();
        }
    }

    private boolean ehMotionBeta() {
        return MOTION_BETA_PACKAGE.equals(getPackageName());
    }

    private boolean temConexao() {
        try {
            ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (manager == null) return false;
            Network network = manager.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = manager.getNetworkCapabilities(network);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception erro) {
            return false;
        }
    }

    private void prepararWebViewOriginalOffline() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (motionClient == null) {
            motionClient = new MotionOfflineWebViewClient(getBridge(), this, this::agendarMotion);
            webView.setWebViewClient(motionClient);
        }

        if (!serviceWorkerConfigured && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                        MotionOfflineWebViewClient client = motionClient;
                        WebView current = getBridge() != null ? getBridge().getWebView() : null;
                        return client != null ? client.shouldInterceptRequest(current, request) : null;
                    }
                });
                serviceWorkerConfigured = true;
            } catch (Exception erro) {
                android.util.Log.w("SantaLuziaMotion", "Não foi possível instalar o cache do Service Worker", erro);
            }
        }

        // O Bridge do Capacitor pode iniciar a primeira navegação antes de MainActivity
        // instalar o cliente. Se o app foi aberto já sem rede, repetimos a navegação uma
        // única vez para que a URL original seja atendida pelo cache HTTP nativo.
        if (!temConexao() && !offlineRecoveryTriggered) {
            offlineRecoveryTriggered = true;
            webView.postDelayed(() -> {
                try {
                    String url = webView.getUrl();
                    if (url != null && url.startsWith("https://")) webView.loadUrl(url);
                } catch (Exception ignored) {}
            }, 180);
        }
        if (temConexao()) offlineRecoveryTriggered = false;
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

        // Reaplica depois de cada navegação/hidratação sem substituir a interface React.
        webView.postDelayed(aplicar, 250);
        webView.postDelayed(aplicar, 750);
        webView.postDelayed(aplicar, 1600);
        webView.postDelayed(aplicar, 3200);
        webView.postDelayed(aplicar, 6500);
    }

    private String carregarMotionRuntime() throws Exception {
        if (motionRuntime != null) return motionRuntime;

        String css = lerAssetTexto("public/motion/windows-motion-fixes.css");
        String behavior = lerAssetTexto("public/motion/windows-behavior-fixes.js");
        String polish = lerAssetTexto("public/motion/windows-beta7-polish.js");
        String preload = lerAssetTexto("public/motion/windows-preload-v5.js");
        String runtime = lerAssetTexto("public/motion/windows-beta-runtime.js");
        String android = lerAssetTexto("public/motion/android-motion-beta.js");
        String offlineFirst = lerAssetTexto("public/motion/android-offline-first-beta7.js");
        String localFirst = lerAssetTexto("public/motion/android-local-first-beta8.js");
        String memberState = lerAssetTexto("public/motion/android-member-state-beta8.js");
        String rscGuard = lerAssetTexto("public/motion/android-rsc-guard-beta8.js");
        String originalUi = lerAssetTexto("public/motion/android-original-ui-beta10.js");

        String cssBootstrap = "(() => {" +
            "const id='sl-motion-beta-windows-css-android';" +
            "let s=document.getElementById(id);" +
            "if(!s){s=document.createElement('style');s.id=id;document.head&&document.head.appendChild(s);}" +
            "if(s)s.textContent=" + JSONObject.quote(css) + ";" +
            "})();";

        motionRuntime = cssBootstrap + "\n;\n" +
            behavior + "\n;\n" +
            polish + "\n;\n" +
            preload + "\n;\n" +
            runtime + "\n;\n" +
            android + "\n;\n" +
            offlineFirst + "\n;\n" +
            localFirst + "\n;\n" +
            memberState + "\n;\n" +
            rscGuard + "\n;\n" +
            originalUi;
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