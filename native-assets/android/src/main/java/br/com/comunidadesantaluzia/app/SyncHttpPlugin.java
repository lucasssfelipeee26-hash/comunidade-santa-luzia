package br.com.comunidadesantaluzia.app;

import android.util.Base64;
import android.webkit.CookieManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "SyncHttp")
public class SyncHttpPlugin extends Plugin {
    private static final String BASE_URL = "https://comunidade-santa-luzia-production.up.railway.app";
    private static final int CONNECT_TIMEOUT_MS = 12_000;
    private static final int READ_TIMEOUT_MS = 25_000;
    private static final int MAX_RESPONSE_BYTES = 28 * 1024 * 1024;
    private static final int MAX_REQUEST_BYTES = 32 * 1024 * 1024;

    private static class Corpo {
        final String value;
        final String contentType;
        Corpo(String value, String contentType) { this.value = value; this.contentType = contentType; }
    }

    private boolean caminhoSeguro(String path) {
        if (path == null || !path.startsWith("/") || path.startsWith("//")) return false;
        return !path.contains("\\") && !path.contains("\n") && !path.contains("\r");
    }

    private byte[] lerBytes(InputStream input) throws Exception {
        if (input == null) return new byte[0];
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int lidos;
            while ((lidos = in.read(buffer)) != -1) {
                total += lidos;
                if (total > MAX_RESPONSE_BYTES) throw new IllegalStateException("Resposta do servidor excedeu o limite local.");
                out.write(buffer, 0, lidos);
            }
            return out.toByteArray();
        }
    }

    private void aplicarCookies(HttpURLConnection conexao) {
        try {
            String cookies = CookieManager.getInstance().getCookie(BASE_URL);
            if (cookies != null && !cookies.trim().isEmpty()) conexao.setRequestProperty("Cookie", cookies);
        } catch (Exception ignored) {}
    }

    private void reterCookies(HttpURLConnection conexao) throws Exception {
        // setCookie is asynchronous. Do not release login until the cookie is
        // visible to the next /auth/me request and persisted for a cold start.
        List<String> cookies = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : conexao.getHeaderFields().entrySet()) {
            if (entry.getKey() != null && "set-cookie".equalsIgnoreCase(entry.getKey())) {
                for (String cookie : entry.getValue()) if (cookie != null && !cookie.isEmpty()) cookies.add(cookie);
            }
        }
        if (cookies.isEmpty()) return;
        if (getActivity() == null) throw new IllegalStateException("Aplicativo indisponível para salvar a sessão.");
        CountDownLatch saved = new CountDownLatch(cookies.size());
        AtomicBoolean accepted = new AtomicBoolean(true);
        getActivity().runOnUiThread(() -> {
            CookieManager manager = CookieManager.getInstance();
            manager.setAcceptCookie(true);
            for (String cookie : cookies) {
                manager.setCookie(BASE_URL, cookie, success -> {
                    if (!Boolean.TRUE.equals(success)) accepted.set(false);
                    saved.countDown();
                });
            }
        });
        if (!saved.await(10, TimeUnit.SECONDS) || !accepted.get()) {
            throw new IllegalStateException("Não foi possível salvar a sessão no aparelho.");
        }
        CookieManager.getInstance().flush();
    }

    private void aplicarHeaders(HttpURLConnection conexao, String headersJson) {
        try {
            JSONObject headers = new JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String lower = key.toLowerCase(Locale.ROOT);
                if (lower.equals("host") || lower.equals("connection") || lower.equals("content-length") || lower.equals("cookie") || lower.equals("origin") || lower.equals("referer") || lower.equals("content-type")) continue;
                String value = headers.optString(key, "");
                if (!value.isEmpty()) conexao.setRequestProperty(key, value);
            }
        } catch (Exception ignored) {}
    }

    private Corpo normalizarCorpo(String path, String method, String body, String contentType) {
        String tipo = contentType == null || contentType.isEmpty() ? "application/json; charset=utf-8" : contentType;

        if ("POST".equals(method) && "/api/jogo/whatajong/resultado".equals(path) && tipo.toLowerCase(Locale.ROOT).contains("application/json")) {
            try {
                JSONObject recebido = new JSONObject(body == null || body.isEmpty() ? "{}" : body);
                if (!recebido.has("completedRound") && recebido.has("level")) {
                    int rodada = recebido.optInt("level", 0);
                    if (rodada <= 0) return new Corpo("{}", "application/json; charset=utf-8");
                    JSONObject corrigido = new JSONObject();
                    corrigido.put("score", recebido.optInt("score", 0));
                    corrigido.put("completedRound", rodada);
                    corrigido.put("difficulty", recebido.optString("mode", "facil"));
                    return new Corpo(corrigido.toString(), "application/json; charset=utf-8");
                }
            } catch (Exception ignored) {}
        }

        // Compatibilidade apenas para formações antigas que chegavam como JSON.
        // O formulário original da Beta 10 usa multipart e preserva anexos abaixo.
        if ("POST".equals(method) && "/api/formacoes".equals(path) && tipo.toLowerCase(Locale.ROOT).contains("application/json")) {
            try {
                JSONObject json = new JSONObject(body == null || body.isEmpty() ? "{}" : body);
                StringBuilder encoded = new StringBuilder();
                Iterator<String> keys = json.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = json.opt(key);
                    if (value == null || value == JSONObject.NULL) continue;
                    if (encoded.length() > 0) encoded.append('&');
                    encoded.append(URLEncoder.encode(key, "UTF-8"));
                    encoded.append('=');
                    encoded.append(URLEncoder.encode(String.valueOf(value), "UTF-8"));
                }
                return new Corpo(encoded.toString(), "application/x-www-form-urlencoded; charset=utf-8");
            } catch (Exception ignored) {}
        }
        return new Corpo(body == null ? "" : body, tipo);
    }

    private String nomeSeguro(String valor) {
        if (valor == null || valor.isEmpty()) return "arquivo";
        return valor.replace("\\", "-").replace("/", "-").replace("\"", "-").replace("\r", "-").replace("\n", "-");
    }

    private void escrever(OutputStream out, String texto) throws Exception {
        out.write(texto.getBytes(StandardCharsets.UTF_8));
    }

    private void escreverMultipart(HttpURLConnection conexao, String formDataJson) throws Exception {
        JSONArray entries = new JSONArray(formDataJson == null || formDataJson.isEmpty() ? "[]" : formDataJson);
        String boundary = "----SantaLuziaBeta10" + UUID.randomUUID().toString().replace("-", "");
        conexao.setDoOutput(true);
        conexao.setChunkedStreamingMode(16 * 1024);
        conexao.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

        long total = 0;
        try (OutputStream out = conexao.getOutputStream()) {
            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.optJSONObject(i);
                if (entry == null) continue;
                String name = nomeSeguro(entry.optString("name", "campo"));
                String kind = entry.optString("kind", "text");
                escrever(out, "--" + boundary + "\r\n");
                if ("blob".equals(kind)) {
                    byte[] bytes = Base64.decode(entry.optString("base64", ""), Base64.DEFAULT);
                    total += bytes.length;
                    if (total > MAX_REQUEST_BYTES) throw new IllegalStateException("Anexos excedem o limite local de envio.");
                    String filename = nomeSeguro(entry.optString("filename", "arquivo"));
                    String type = entry.optString("type", "application/octet-stream");
                    escrever(out, "Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + filename + "\"\r\n");
                    escrever(out, "Content-Type: " + type + "\r\n\r\n");
                    out.write(bytes);
                    escrever(out, "\r\n");
                } else {
                    String value = entry.optString("value", "");
                    byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
                    total += bytes.length;
                    if (total > MAX_REQUEST_BYTES) throw new IllegalStateException("Formulário excede o limite local de envio.");
                    escrever(out, "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
                    out.write(bytes);
                    escrever(out, "\r\n");
                }
            }
            escrever(out, "--" + boundary + "--\r\n");
        }
    }

    private boolean respostaTextual(String contentType) {
        String tipo = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        return tipo.startsWith("text/") || tipo.contains("json") || tipo.contains("javascript") || tipo.contains("xml") || tipo.contains("x-www-form-urlencoded") || tipo.isEmpty();
    }

    private JSObject headersResposta(HttpURLConnection conexao) {
        JSObject headers = new JSObject();
        for (String name : new String[]{"Cache-Control", "ETag", "Last-Modified", "Content-Disposition", "Content-Type"}) {
            String value = conexao.getHeaderField(name);
            if (value != null && !value.isEmpty()) headers.put(name, value);
        }
        return headers;
    }

    private void resolverNoUi(PluginCall call, JSObject resposta) {
        if (getActivity() == null) call.resolve(resposta);
        else getActivity().runOnUiThread(() -> call.resolve(resposta));
    }

    private void rejeitarNoUi(PluginCall call, String mensagem, Exception erro) {
        if (getActivity() == null) call.reject(mensagem, erro);
        else getActivity().runOnUiThread(() -> call.reject(mensagem, erro));
    }

    @PluginMethod
    public void request(PluginCall call) {
        final String path = call.getString("path", "");
        final String method = call.getString("method", "GET").trim().toUpperCase(Locale.ROOT);
        final String body = call.getString("body", "");
        final String bodyBase64 = call.getString("bodyBase64", "");
        final String formDataJson = call.getString("formDataJson", "");
        final String contentType = call.getString("contentType", "application/json; charset=utf-8");
        final String headersJson = call.getString("headersJson", "{}");

        if (!caminhoSeguro(path)) {
            call.reject("Caminho de sincronização inválido.");
            return;
        }
        if (!(method.equals("GET") || method.equals("POST") || method.equals("PUT") || method.equals("PATCH") || method.equals("DELETE"))) {
            call.reject("Método de sincronização inválido.");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conexao = null;
            try {
                URL url = new URL(BASE_URL + path);
                conexao = (HttpURLConnection) url.openConnection();
                conexao.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conexao.setReadTimeout(READ_TIMEOUT_MS);
                conexao.setRequestMethod(method);
                conexao.setInstanceFollowRedirects(false);
                conexao.setUseCaches(false);
                conexao.setRequestProperty("Accept", "application/json, text/plain, */*");
                conexao.setRequestProperty("User-Agent", "SantaLuziaAndroid SantaLuziaMotionBeta/2.0.0-beta.21 SantaLuziaOriginalUIOffline/2 SantaLuziaWindowsBeta/0.1.0-beta.19");
                conexao.setRequestProperty("X-Santa-Luzia-Windows-Beta", "1");
                aplicarHeaders(conexao, headersJson);
                aplicarCookies(conexao);

                if (!method.equals("GET")) {
                    if (formDataJson != null && !formDataJson.isEmpty()) {
                        escreverMultipart(conexao, formDataJson);
                    } else if (bodyBase64 != null && !bodyBase64.isEmpty()) {
                        byte[] bytes = Base64.decode(bodyBase64, Base64.DEFAULT);
                        if (bytes.length > MAX_REQUEST_BYTES) throw new IllegalStateException("Corpo da requisição excede o limite local.");
                        conexao.setDoOutput(true);
                        conexao.setRequestProperty("Content-Type", contentType);
                        conexao.setFixedLengthStreamingMode(bytes.length);
                        try (OutputStream out = conexao.getOutputStream()) { out.write(bytes); }
                    } else {
                        Corpo corpo = normalizarCorpo(path, method, body, contentType);
                        if (corpo.value != null && !corpo.value.isEmpty()) {
                            byte[] bytes = corpo.value.getBytes(StandardCharsets.UTF_8);
                            if (bytes.length > MAX_REQUEST_BYTES) throw new IllegalStateException("Corpo da requisição excede o limite local.");
                            conexao.setDoOutput(true);
                            conexao.setRequestProperty("Content-Type", corpo.contentType);
                            conexao.setFixedLengthStreamingMode(bytes.length);
                            try (OutputStream out = conexao.getOutputStream()) { out.write(bytes); }
                        }
                    }
                }

                int status = conexao.getResponseCode();
                reterCookies(conexao);
                InputStream stream = status >= 400 ? conexao.getErrorStream() : conexao.getInputStream();
                byte[] bytes = lerBytes(stream);
                String tipo = conexao.getHeaderField("Content-Type");

                JSObject resposta = new JSObject();
                resposta.put("ok", status >= 200 && status < 300);
                resposta.put("status", status);
                resposta.put("contentType", tipo == null ? "" : tipo);
                resposta.put("contentDisposition", conexao.getHeaderField("Content-Disposition") == null ? "" : conexao.getHeaderField("Content-Disposition"));
                resposta.put("headers", headersResposta(conexao));
                if (respostaTextual(tipo)) {
                    resposta.put("body", new String(bytes, StandardCharsets.UTF_8));
                    resposta.put("bodyBase64", "");
                } else {
                    resposta.put("body", "");
                    resposta.put("bodyBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                }
                resposta.put("server", BASE_URL);
                resolverNoUi(call, resposta);
            } catch (Exception erro) {
                rejeitarNoUi(call, "Servidor indisponível. A operação continuará localmente.", erro);
            } finally {
                if (conexao != null) conexao.disconnect();
            }
        }, "SantaLuzia-SyncHttp").start();
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        try {
            CookieManager manager = CookieManager.getInstance();
            manager.setCookie(BASE_URL, "santa_luzia_sessao=; Max-Age=0; Path=/; Secure; SameSite=Lax");
            manager.flush();
            JSObject resposta = new JSObject();
            resposta.put("ok", true);
            call.resolve(resposta);
        } catch (Exception erro) {
            call.reject("Não foi possível limpar a sessão local.", erro);
        }
    }

    @PluginMethod
    public void baseUrl(PluginCall call) {
        JSObject resposta = new JSObject();
        resposta.put("url", BASE_URL);
        call.resolve(resposta);
    }
}
