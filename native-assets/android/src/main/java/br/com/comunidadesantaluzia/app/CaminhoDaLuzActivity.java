package br.com.comunidadesantaluzia.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class CaminhoDaLuzActivity extends Activity {
    private static final String URL_JOGO = "file:///android_asset/public/caminho-da-luz/index.html";
    private static final String PREFIXO_LOCAL = "file:///android_asset/public/caminho-da-luz/";
    private WebView webView;
    private int checkpointScore = 0;
    private int checkpointLevel = 1;
    private String checkpointMode = "Joias da Luz";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(79, 36, 49));
        getWindow().setNavigationBarColor(Color.rgb(255, 250, 246));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(245, 241, 239));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
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
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) settings.setOffscreenPreRaster(true);

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

    private Intent resultado(int score, int level, String mode) {
        int scoreSeguro = Math.max(0, Math.min(1_000_000, score));
        int nivelSeguro = Math.max(1, Math.min(999, level));
        String modoSeguro = mode == null ? "Joias da Luz" : mode.trim();
        if (modoSeguro.length() > 80) modoSeguro = modoSeguro.substring(0, 80);
        Intent resposta = new Intent();
        resposta.putExtra("score", scoreSeguro);
        resposta.putExtra("level", nivelSeguro);
        resposta.putExtra("mode", modoSeguro);
        return resposta;
    }

    private final class GameBridge {
        @JavascriptInterface
        public void checkpoint(int score, int level, String mode) {
            checkpointScore = Math.max(checkpointScore, Math.max(0, Math.min(1_000_000, score)));
            checkpointLevel = Math.max(checkpointLevel, Math.max(1, Math.min(999, level)));
            if (mode != null && !mode.trim().isEmpty()) {
                checkpointMode = mode.trim().length() > 80 ? mode.trim().substring(0, 80) : mode.trim();
            }
        }

        @JavascriptInterface
        public void finish(int score, int level, String mode) {
            checkpoint(score, level, mode);
            Intent resposta = resultado(checkpointScore, checkpointLevel, checkpointMode);
            runOnUiThread(() -> {
                setResult(Activity.RESULT_OK, resposta);
                CaminhoDaLuzActivity.this.finish();
            });
        }

        @JavascriptInterface
        public void close() {
            runOnUiThread(() -> {
                if (checkpointLevel > 1) setResult(Activity.RESULT_OK, resultado(checkpointScore, checkpointLevel, checkpointMode));
                else setResult(Activity.RESULT_CANCELED);
                CaminhoDaLuzActivity.this.finish();
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (checkpointLevel > 1) setResult(Activity.RESULT_OK, resultado(checkpointScore, checkpointLevel, checkpointMode));
        else setResult(Activity.RESULT_CANCELED);
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("SantaLuziaGame");
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
