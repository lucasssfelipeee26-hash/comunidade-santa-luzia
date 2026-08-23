package br.com.comunidadesantaluzia.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Proxy/cache nativo exclusivo da Motion Beta.
 *
 * A interface continua sendo exatamente a aplicação web original. Enquanto há
 * internet, GET/HEAD para o servidor Santa Luzia passam por este cliente e a
 * resposta real é persistida no sandbox do app. Sem internet, a mesma URL (e a
 * mesma variante RSC do Next.js) é respondida com o último conteúdo sincronizado.
 *
 * Mutações não são interceptadas aqui porque o corpo de POST/PUT/PATCH/DELETE não
 * é exposto pelo WebResourceRequest. Elas continuam sendo tratadas pela fila
 * local-first JavaScript/SQLite e reenviadas depois.
 */
public class MotionOfflineWebViewClient extends BridgeWebViewClient {
    private static final long MAX_ENTRY_BYTES = 24L * 1024L * 1024L;
    private static final long MAX_CACHE_BYTES = 320L * 1024L * 1024L;
    private static final String CACHE_DIR = "motion_original_http_cache_v1";
    private static final String SERVER_HOST = "comunidade-santa-luzia-production.up.railway.app";

    private final Context context;
    private final File cacheDir;
    private final Runnable pageFinished;

    public MotionOfflineWebViewClient(Bridge bridge, Context context, Runnable pageFinished) {
        super(bridge);
        this.context = context.getApplicationContext();
        this.pageFinished = pageFinished;
        this.cacheDir = new File(this.context.getFilesDir(), CACHE_DIR);
        if (!this.cacheDir.exists()) this.cacheDir.mkdirs();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        try {
            Uri uri = request.getUrl();
            String method = request.getMethod() == null ? "GET" : request.getMethod().toUpperCase(Locale.ROOT);
            if (!isSantaLuzia(uri) || !("GET".equals(method) || "HEAD".equals(method))) {
                return super.shouldInterceptRequest(view, request);
            }

            String cacheKey = cacheKey(request);
            if (hasInternet()) {
                try {
                    WebResourceResponse online = fetchAndCache(request, cacheKey, "HEAD".equals(method));
                    if (online != null) return online;
                } catch (Exception ignored) {
                    WebResourceResponse cached = readCached(cacheKey);
                    if (cached != null) return cached;
                }
            } else {
                WebResourceResponse cached = readCached(cacheKey);
                if (cached != null) return cached;

                // Para uma navegação HTML comum, tenta a variante sem marcadores RSC.
                // Isso evita que uma combinação de headers de prefetch impeça a abertura
                // de uma página HTML que já foi sincronizada no aparelho.
                String documentKey = cacheKeyFor(uri.toString(), "html");
                cached = readCached(documentKey);
                if (cached != null) return cached;
            }
        } catch (Exception ignored) {}
        return super.shouldInterceptRequest(view, request);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (pageFinished != null) view.post(pageFinished);
    }

    private boolean isSantaLuzia(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        String host = uri.getHost();
        return "https".equalsIgnoreCase(scheme) && SERVER_HOST.equalsIgnoreCase(host);
    }

    private boolean hasInternet() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception ignored) {
            return false;
        }
    }

    private String variant(WebResourceRequest request) {
        Map<String, String> h = request.getRequestHeaders();
        boolean rsc = "1".equals(header(h, "RSC"))
            || header(h, "Accept").contains("text/x-component")
            || request.getUrl().getQueryParameter("_rsc") != null;
        if (!rsc) return "html";
        String tree = header(h, "Next-Router-State-Tree");
        String prefetch = header(h, "Next-Router-Prefetch");
        return "rsc|" + tree + "|" + prefetch;
    }

    private String cacheKey(WebResourceRequest request) throws Exception {
        return cacheKeyFor(request.getUrl().toString(), variant(request));
    }

    private String cacheKeyFor(String url, String variant) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest((url + "\n" + variant).getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b));
        return out.toString();
    }

    private String header(Map<String, String> headers, String name) {
        if (headers == null) return "";
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (name.equalsIgnoreCase(entry.getKey())) return entry.getValue() == null ? "" : entry.getValue();
        }
        return "";
    }

    private WebResourceResponse fetchAndCache(WebResourceRequest request, String key, boolean headOnly) throws Exception {
        URL url = new URL(request.getUrl().toString());
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod(request.getMethod());
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(25000);
        connection.setUseCaches(false);

        for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
            String name = entry.getKey();
            if (name == null) continue;
            if (name.equalsIgnoreCase("Host") || name.equalsIgnoreCase("Connection") || name.equalsIgnoreCase("Content-Length") || name.equalsIgnoreCase("Accept-Encoding")) continue;
            connection.setRequestProperty(name, entry.getValue());
        }
        connection.setRequestProperty("Accept-Encoding", "identity");
        String cookie = CookieManager.getInstance().getCookie(url.toString());
        if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);

        int status = connection.getResponseCode();
        String reason = connection.getResponseMessage();
        Map<String, String> responseHeaders = flattenHeaders(connection.getHeaderFields());
        applyCookies(url.toString(), connection.getHeaderFields());

        byte[] body = new byte[0];
        if (!headOnly) {
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            body = readAll(stream, MAX_ENTRY_BYTES);
        }

        String contentType = connection.getContentType();
        String mime = mimeType(contentType, request.getUrl().getPath());
        String encoding = encoding(contentType);
        if (status >= 200 && status < 400 && body.length <= MAX_ENTRY_BYTES) {
            writeCached(key, status, reason, mime, encoding, responseHeaders, body, request.getUrl().toString());
            // Guarda também a chave HTML canônica quando a requisição realmente é documento HTML.
            if ("html".equals(variant(request)) && mime.contains("text/html")) {
                String htmlKey = cacheKeyFor(request.getUrl().toString(), "html");
                if (!htmlKey.equals(key)) writeCached(htmlKey, status, reason, mime, encoding, responseHeaders, body, request.getUrl().toString());
            }
        }
        connection.disconnect();
        return response(status, reason, mime, encoding, responseHeaders, body);
    }

    private Map<String, String> flattenHeaders(Map<String, List<String>> raw) {
        Map<String, String> out = new HashMap<>();
        if (raw == null) return out;
        for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) continue;
            if ("set-cookie".equalsIgnoreCase(entry.getKey())) continue;
            out.put(entry.getKey(), String.join(", ", entry.getValue()));
        }
        return out;
    }

    private void applyCookies(String url, Map<String, List<String>> raw) {
        try {
            if (raw == null) return;
            CookieManager cm = CookieManager.getInstance();
            for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
                if (!"set-cookie".equalsIgnoreCase(entry.getKey()) || entry.getValue() == null) continue;
                for (String cookie : entry.getValue()) if (cookie != null) cm.setCookie(url, cookie);
            }
            cm.flush();
        } catch (Exception ignored) {}
    }

    private void writeCached(String key, int status, String reason, String mime, String encoding, Map<String, String> headers, byte[] body, String url) {
        try {
            if (!cacheDir.exists()) cacheDir.mkdirs();
            File bodyFile = new File(cacheDir, key + ".body");
            File metaFile = new File(cacheDir, key + ".json");
            try (FileOutputStream out = new FileOutputStream(bodyFile)) { out.write(body); }
            JSONObject meta = new JSONObject();
            meta.put("status", status);
            meta.put("reason", reason == null ? "OK" : reason);
            meta.put("mime", mime);
            meta.put("encoding", encoding);
            meta.put("url", url);
            meta.put("savedAt", System.currentTimeMillis());
            meta.put("headers", new JSONObject(headers));
            try (FileOutputStream out = new FileOutputStream(metaFile)) { out.write(meta.toString().getBytes(StandardCharsets.UTF_8)); }
            pruneCache();
        } catch (Exception ignored) {}
    }

    private WebResourceResponse readCached(String key) {
        try {
            File bodyFile = new File(cacheDir, key + ".body");
            File metaFile = new File(cacheDir, key + ".json");
            if (!bodyFile.isFile() || !metaFile.isFile()) return null;
            JSONObject meta;
            try (FileInputStream in = new FileInputStream(metaFile)) { meta = new JSONObject(new String(readAll(in, 1024 * 1024), StandardCharsets.UTF_8)); }
            JSONObject h = meta.optJSONObject("headers");
            Map<String, String> headers = new HashMap<>();
            if (h != null) for (java.util.Iterator<String> it = h.keys(); it.hasNext();) { String k = it.next(); headers.put(k, h.optString(k, "")); }
            byte[] body;
            try (FileInputStream in = new FileInputStream(bodyFile)) { body = readAll(in, MAX_ENTRY_BYTES); }
            bodyFile.setLastModified(System.currentTimeMillis());
            metaFile.setLastModified(System.currentTimeMillis());
            return response(meta.optInt("status", 200), meta.optString("reason", "OK"), meta.optString("mime", "application/octet-stream"), meta.optString("encoding", "UTF-8"), headers, body);
        } catch (Exception ignored) { return null; }
    }

    private WebResourceResponse response(int status, String reason, String mime, String encoding, Map<String, String> headers, byte[] body) {
        return new WebResourceResponse(
            mime == null || mime.isEmpty() ? "application/octet-stream" : mime,
            encoding == null || encoding.isEmpty() ? "UTF-8" : encoding,
            Math.max(100, status),
            reason == null || reason.isEmpty() ? "OK" : reason,
            headers,
            new ByteArrayInputStream(body == null ? new byte[0] : body)
        );
    }

    private String mimeType(String contentType, String path) {
        if (contentType != null && !contentType.isEmpty()) {
            int semi = contentType.indexOf(';');
            return (semi >= 0 ? contentType.substring(0, semi) : contentType).trim();
        }
        String p = path == null ? "" : path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "text/html";
    }

    private String encoding(String contentType) {
        if (contentType != null) {
            for (String part : contentType.split(";")) {
                String s = part.trim();
                if (s.toLowerCase(Locale.ROOT).startsWith("charset=")) return s.substring(8).trim();
            }
        }
        return "UTF-8";
    }

    private byte[] readAll(InputStream input, long limit) throws Exception {
        if (input == null) return new byte[0];
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32 * 1024];
            long total = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > limit) throw new IllegalStateException("Resposta excede limite de cache");
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private void pruneCache() {
        try {
            File[] files = cacheDir.listFiles();
            if (files == null) return;
            long total = 0;
            for (File file : files) total += file.length();
            if (total <= MAX_CACHE_BYTES) return;
            java.util.Arrays.sort(files, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
            for (File file : files) {
                long size = file.length();
                if (file.delete()) total -= size;
                if (total <= MAX_CACHE_BYTES) break;
            }
        } catch (Exception ignored) {}
    }
}