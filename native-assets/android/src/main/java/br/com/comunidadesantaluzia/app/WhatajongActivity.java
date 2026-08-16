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

public class WhatajongActivity extends Activity {
    private static final String URL_JOGO = "file:///android_asset/public/whatajong/index.html";
    private static final String PREFIXO_LOCAL = "file:///android_asset/public/whatajong/";
    private WebView webView;
    private int checkpointScore = 0;
    private int checkpointRound = 0;
    private String checkpointDifficulty = "facil";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(20, 55, 47));
        getWindow().setNavigationBarColor(Color.rgb(16, 42, 36));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 42, 36));
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

        webView.addJavascriptInterface(new GameBridge(), "SantaLuziaWhatajong");
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

    private Intent resultado(int score, int completedRound, String difficulty) {
        Intent resposta = new Intent();
        resposta.putExtra("score", Math.max(0, Math.min(5_000_000, score)));
        resposta.putExtra("completedRound", Math.max(0, Math.min(24, completedRound)));
        String dif = difficulty == null ? "facil" : difficulty.trim();
        if (!dif.equals("medio") && !dif.equals("dificil")) dif = "facil";
        resposta.putExtra("difficulty", dif);
        return resposta;
    }

    private final class GameBridge {
        @JavascriptInterface
        public void checkpoint(int score, int completedRound, String difficulty) {
            checkpointScore = Math.max(checkpointScore, Math.max(0, Math.min(5_000_000, score)));
            checkpointRound = Math.max(checkpointRound, Math.max(0, Math.min(24, completedRound)));
            if (difficulty != null && (difficulty.equals("facil") || difficulty.equals("medio") || difficulty.equals("dificil"))) {
                checkpointDifficulty = difficulty;
            }
        }

        @JavascriptInterface
        public void finish(int score, int completedRound, String difficulty) {
            checkpoint(score, completedRound, difficulty);
            Intent resposta = resultado(checkpointScore, checkpointRound, checkpointDifficulty);
            runOnUiThread(() -> {
                setResult(Activity.RESULT_OK, resposta);
                WhatajongActivity.this.finish();
            });
        }

        @JavascriptInterface
        public void close() {
            runOnUiThread(() -> {
                if (checkpointRound > 0) setResult(Activity.RESULT_OK, resultado(checkpointScore, checkpointRound, checkpointDifficulty));
                else setResult(Activity.RESULT_CANCELED);
                WhatajongActivity.this.finish();
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (checkpointRound > 0) setResult(Activity.RESULT_OK, resultado(checkpointScore, checkpointRound, checkpointDifficulty));
        else setResult(Activity.RESULT_CANCELED);
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("SantaLuziaWhatajong");
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
