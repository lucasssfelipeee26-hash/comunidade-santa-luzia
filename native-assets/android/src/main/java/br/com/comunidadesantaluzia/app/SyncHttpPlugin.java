package br.com.comunidadesantaluzia.app;

import android.webkit.CookieManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "SyncHttp")
public class SyncHttpPlugin extends Plugin {
    private static final String BASE_URL = "https://comunidade-santa-luzia-production.up.railway.app";
    private static final int CONNECT_TIMEOUT_MS = 12_000;
    private static final int READ_TIMEOUT_MS = 20_000;
    private static final int MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

    private boolean caminhoSeguro(String path) {
        if (path == null || !path.startsWith("/") || path.startsWith("//")) return false;
        return !path.contains("\\") && !path.contains("\n") && !path.contains("\r");
    }

    private String lerTudo(InputStream input) throws Exception {
        if (input == null) return "";
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int lidos;
            while ((lidos = in.read(buffer)) != -1) {
                total += lidos;
                if (total > MAX_RESPONSE_BYTES) throw new IllegalStateException("Resposta do servidor excedeu o limite local.");
                out.write(buffer, 0, lidos);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void aplicarCookies(HttpURLConnection conexao) {
        try {
            String cookies = CookieManager.getInstance().getCookie(BASE_URL);
            if (cookies != null && !cookies.trim().isEmpty()) conexao.setRequestProperty("Cookie", cookies);
        } catch (Exception ignored) {}
    }

    private void reterCookies(HttpURLConnection conexao) {
        try {
            CookieManager manager = CookieManager.getInstance();
            Map<String, List<String>> headers = conexao.getHeaderFields();
            for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
                if (entry.getKey() == null || !"set-cookie".equalsIgnoreCase(entry.getKey())) continue;
                for (String cookie : entry.getValue()) if (cookie != null && !cookie.isEmpty()) manager.setCookie(BASE_URL, cookie);
            }
            manager.flush();
        } catch (Exception ignored) {}
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
        final String method = call.getString("method", "GET").trim().toUpperCase();
        final String body = call.getString("body", "");
        final String contentType = call.getString("contentType", "application/json; charset=utf-8");

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
                conexao.setRequestProperty("User-Agent", "SantaLuziaAndroid SantaLuziaMotionBeta/2.0.0-beta.9 SantaLuziaLocalFirst/1");
                conexao.setRequestProperty("X-Santa-Luzia-Windows-Beta", "1");
                aplicarCookies(conexao);

                if (!method.equals("GET") && body != null && !body.isEmpty()) {
                    conexao.setDoOutput(true);
                    conexao.setRequestProperty("Content-Type", contentType == null || contentType.isEmpty() ? "application/json; charset=utf-8" : contentType);
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    conexao.setFixedLengthStreamingMode(bytes.length);
                    try (OutputStream out = conexao.getOutputStream()) { out.write(bytes); }
                }

                int status = conexao.getResponseCode();
                reterCookies(conexao);
                InputStream stream = status >= 400 ? conexao.getErrorStream() : conexao.getInputStream();
                String texto = lerTudo(stream);

                JSObject resposta = new JSObject();
                resposta.put("ok", status >= 200 && status < 300);
                resposta.put("status", status);
                resposta.put("body", texto == null ? "" : texto);
                String tipo = conexao.getHeaderField("Content-Type");
                resposta.put("contentType", tipo == null ? "" : tipo);
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
            CookieManager.getInstance().setCookie(BASE_URL, "santa_luzia_sessao=; Max-Age=0; Path=/; Secure; SameSite=Lax");
            CookieManager.getInstance().flush();
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
