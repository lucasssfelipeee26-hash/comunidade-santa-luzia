package br.com.comunidadesantaluzia.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String MOTION_BETA_PACKAGE = "br.com.comunidadesantaluzia.motionbeta";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getDelegate().setHandleNativeActionModesEnabled(false);

        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(CaminhoDaLuzPlugin.class);
        registerPlugin(WhatajongPlugin.class);
        registerPlugin(OfflineStorePlugin.class);
        registerPlugin(SyncHttpPlugin.class);
        registerPlugin(DiagnosticReportPlugin.class);
        super.onCreate(savedInstanceState);

        if (ehMotionBeta()) prepararWebViewLocal();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (ehMotionBeta()) prepararWebViewLocal();
    }

    private boolean ehMotionBeta() {
        return MOTION_BETA_PACKAGE.equals(getPackageName());
    }

    private void prepararWebViewLocal() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        // A Motion Beta carrega a interface React empacotada no APK. A rede é
        // usada somente para autenticação e sincronização quando disponível.
        // A Beta 14 deixa o WebView controlar a rolagem vertical sem uma camada
        // JavaScript reposicionando a tela e mantém a barra visível durante uso.
        webView.setOverScrollMode(WebView.OVER_SCROLL_IF_CONTENT_SCROLLS);
        webView.setVerticalScrollBarEnabled(true);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setScrollbarFadingEnabled(false);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
    }
}
