package br.com.comunidadesantaluzia.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class CaminhoDaLuzActivity extends Activity {
    private static final String URL_JOGO = "file:///android_asset/public/caminho-da-luz/index.html";
    private static final String PREFIXO_LOCAL = "file:///android_asset/public/caminho-da-luz/";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(82, 17, 35));
        getWindow().setNavigationBarColor(Color.rgb(255, 250, 240));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(255, 250, 240));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);

        webView.addJavascriptInterface(new GameBridge(), "SantaLuziaGame");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !url.startsWith(PREFIXO_LOCAL);
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return url == null || !url.startsWith(PREFIXO_LOCAL);
            }
        });
        webView.loadUrl(URL_JOGO);
    }

    private final class GameBridge {
        @JavascriptInterface
        public void finish(int score, int level, String mode) {
            int scoreSeguro = Math.max(0, Math.min(1_000_000, score));
            int nivelSeguro = Math.max(1, Math.min(999, level));
            String modoSeguro = mode == null ? "Missão do Altar" : mode.trim();
            if (modoSeguro.length() > 80) modoSeguro = modoSeguro.substring(0, 80);

            Intent resposta = new Intent();
            resposta.putExtra("score", scoreSeguro);
            resposta.putExtra("level", nivelSeguro);
            resposta.putExtra("mode", modoSeguro);
            runOnUiThread(() -> {
                setResult(Activity.RESULT_OK, resposta);
                CaminhoDaLuzActivity.this.finish();
            });
        }

        @JavascriptInterface
        public void close() {
            runOnUiThread(() -> {
                setResult(Activity.RESULT_CANCELED);
                CaminhoDaLuzActivity.this.finish();
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("SantaLuziaGame");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
