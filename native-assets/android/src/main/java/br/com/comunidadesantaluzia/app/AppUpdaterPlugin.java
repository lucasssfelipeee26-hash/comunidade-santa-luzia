package br.com.comunidadesantaluzia.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String HOST_RAILWAY = "comunidade-santa-luzia-production.up.railway.app";
    private static final String HOST_GITHUB = "github.com";
    private static final String HOST_GITHUB_RELEASE_ASSETS = "release-assets.githubusercontent.com";
    private static final String HOST_GITHUB_OBJECTS = "objects.githubusercontent.com";
    private static final String GITHUB_RELEASE_PREFIX = "/lucasssfelipeee26-hash/comunidade-santa-luzia/releases/";
    private static final String MIME_APK = "application/vnd.android.package-archive";
    private static final long INTERVALO_PROGRESSO_MS = 180L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadEmAndamento = new AtomicBoolean(false);
    private volatile File apkPendente;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        if (!downloadEmAndamento.compareAndSet(false, true)) {
            call.reject("Já existe uma atualização sendo baixada.", "DOWNLOAD_EM_ANDAMENTO");
            return;
        }

        final String endereco = call.getString("url", "").trim();
        final String nomeArquivo = limparNomeArquivo(call.getString("fileName", "Santa-Luzia-atualizacao.apk"));
        final String shaEsperado = call.getString("expectedSha256", "").trim().toLowerCase(Locale.ROOT);
        final long tamanhoEsperado = lerTamanhoEsperado(call);

        try {
            validarEntrada(endereco, nomeArquivo, shaEsperado, tamanhoEsperado);
        } catch (Exception erro) {
            downloadEmAndamento.set(false);
            call.reject(erro.getMessage(), "ATUALIZACAO_INVALIDA");
            return;
        }

        executor.execute(() -> baixarValidarEInstalar(call, endereco, nomeArquivo, shaEsperado, tamanhoEsperado));
    }

    private long lerTamanhoEsperado(PluginCall call) {
        Object valor = call.getData().opt("expectedSize");
        if (valor instanceof Number) return ((Number) valor).longValue();
        if (valor != null) {
            try {
                return Long.parseLong(String.valueOf(valor));
            } catch (NumberFormatException ignorado) {
                // A validação abaixo tratará o valor como inválido.
            }
        }
        return 0L;
    }

    private boolean hostOficial(String host) {
        if (host == null) return false;
        String normalizado = host.toLowerCase(Locale.ROOT);
        return HOST_RAILWAY.equals(normalizado)
            || HOST_GITHUB.equals(normalizado)
            || HOST_GITHUB_RELEASE_ASSETS.equals(normalizado)
            || HOST_GITHUB_OBJECTS.equals(normalizado);
    }

    private boolean enderecoInicialOficial(URI uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || !hostOficial(uri.getHost())) return false;
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!HOST_GITHUB.equals(host)) return true;
        String caminho = uri.getPath();
        return caminho != null && caminho.startsWith(GITHUB_RELEASE_PREFIX);
    }

    private void validarEntrada(String endereco, String nomeArquivo, String shaEsperado, long tamanhoEsperado) throws Exception {
        URI uri = new URI(endereco);
        if (!enderecoInicialOficial(uri)) {
            throw new IllegalArgumentException("A atualização não veio de uma origem oficial autorizada.");
        }
        if (!nomeArquivo.toLowerCase(Locale.ROOT).endsWith(".apk")) {
            throw new IllegalArgumentException("O arquivo de atualização é inválido.");
        }
        if (!shaEsperado.matches("[0-9a-f]{64}") || tamanhoEsperado <= 0) {
            throw new IllegalArgumentException("A atualização não possui dados de integridade válidos.");
        }
    }

    private void baixarValidarEInstalar(
        PluginCall call,
        String endereco,
        String nomeArquivo,
        String shaEsperado,
        long tamanhoEsperado
    ) {
        HttpsURLConnection conexao = null;
        File parcial = null;

        try {
            File baseExterna = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (baseExterna == null) throw new IOException("O Android não disponibilizou o armazenamento privado para a atualização.");
            File pasta = new File(baseExterna, "updates");
            if (!pasta.exists() && !pasta.mkdirs()) throw new IOException("Não foi possível preparar o armazenamento da atualização.");
            limparAtualizacoesAntigas(pasta);

            File destino = new File(pasta, nomeArquivo);
            parcial = new File(pasta, nomeArquivo + ".part");
            if (parcial.exists() && !parcial.delete()) throw new IOException("Não foi possível reiniciar o download anterior.");

            conexao = abrirConexao(endereco);
            int codigo = conexao.getResponseCode();
            if (codigo < 200 || codigo >= 300) throw new IOException("O servidor recusou o download (HTTP " + codigo + ").");

            long tamanhoServidor = conexao.getContentLengthLong();
            if (tamanhoServidor > 0 && tamanhoServidor != tamanhoEsperado) {
                throw new IOException("O tamanho da atualização recebida não corresponde ao publicado.");
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long baixados = 0L;
            long ultimoAviso = 0L;
            byte[] buffer = new byte[64 * 1024];

            avisarProgresso("downloading", 0L, tamanhoEsperado, 0);
            try (
                BufferedInputStream entrada = new BufferedInputStream(conexao.getInputStream());
                FileOutputStream saida = new FileOutputStream(parcial)
            ) {
                int lidos;
                while ((lidos = entrada.read(buffer)) != -1) {
                    saida.write(buffer, 0, lidos);
                    digest.update(buffer, 0, lidos);
                    baixados += lidos;

                    long agora = System.currentTimeMillis();
                    if (agora - ultimoAviso >= INTERVALO_PROGRESSO_MS || baixados == tamanhoEsperado) {
                        int percentual = (int) Math.min(100L, (baixados * 100L) / tamanhoEsperado);
                        avisarProgresso("downloading", baixados, tamanhoEsperado, percentual);
                        ultimoAviso = agora;
                    }
                }
                saida.getFD().sync();
            }

            avisarProgresso("verifying", baixados, tamanhoEsperado, 100);
            if (baixados != tamanhoEsperado) throw new IOException("O download terminou incompleto.");

            String shaRecebido = paraHexadecimal(digest.digest());
            if (!MessageDigest.isEqual(shaEsperado.getBytes(), shaRecebido.getBytes())) {
                throw new IOException("A verificação de segurança da atualização falhou.");
            }

            if (destino.exists() && !destino.delete()) throw new IOException("Não foi possível substituir a atualização anterior.");
            if (!parcial.renameTo(destino)) throw new IOException("Não foi possível finalizar o arquivo da atualização.");
            validarApkParaAtualizacao(destino);

            apkPendente = destino;
            getActivity().runOnUiThread(() -> solicitarPermissaoOuInstalar(call, destino));
        } catch (Exception erro) {
            if (parcial != null && parcial.exists()) parcial.delete();
            downloadEmAndamento.set(false);
            call.reject(mensagemSegura(erro), "FALHA_DOWNLOAD", erro);
        } finally {
            if (conexao != null) conexao.disconnect();
        }
    }

    private HttpsURLConnection abrirConexao(String endereco) throws Exception {
        URL atual = new URL(endereco);
        for (int redirecionamentos = 0; redirecionamentos <= 3; redirecionamentos++) {
            if (!"https".equalsIgnoreCase(atual.getProtocol()) || !hostOficial(atual.getHost())) {
                throw new IOException("O servidor tentou redirecionar a atualização para uma origem não autorizada.");
            }

            HttpsURLConnection conexao = (HttpsURLConnection) atual.openConnection();
            conexao.setConnectTimeout(20_000);
            conexao.setReadTimeout(45_000);
            conexao.setInstanceFollowRedirects(false);
            conexao.setRequestProperty("Accept", MIME_APK);
            conexao.setRequestProperty("User-Agent", "SantaLuziaAndroid-Updater/3");

            int codigo = conexao.getResponseCode();
            if (codigo < 300 || codigo >= 400) return conexao;

            String local = conexao.getHeaderField("Location");
            conexao.disconnect();
            if (local == null || local.trim().isEmpty()) throw new IOException("O servidor retornou um redirecionamento inválido.");
            atual = new URL(atual, local);
        }
        throw new IOException("A atualização excedeu o limite de redirecionamentos.");
    }

    private void solicitarPermissaoOuInstalar(PluginCall call, File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            avisarProgresso("permission", apk.length(), apk.length(), 100);
            Intent configuracao = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            startActivityForResult(call, configuracao, "permissaoInstalacaoCallback");
            return;
        }
        abrirInstalador(call, apk);
    }

    @ActivityCallback
    private void permissaoInstalacaoCallback(PluginCall call, ActivityResult result) {
        File apk = apkPendente;
        if (apk == null || !apk.exists()) {
            downloadEmAndamento.set(false);
            call.reject("O arquivo da atualização não está mais disponível.", "APK_AUSENTE");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            downloadEmAndamento.set(false);
            call.reject("Autorize a instalação pelo Santa Luzia para concluir a atualização.", "PERMISSAO_NEGADA");
            return;
        }
        abrirInstalador(call, apk);
    }

    private void abrirInstalador(PluginCall call, File apk) {
        try {
            validarApkParaAtualizacao(apk);
            avisarProgresso("installing", apk.length(), apk.length(), 100);
            Uri conteudo = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );
            Intent instalador = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            instalador.setDataAndType(conteudo, MIME_APK);
            instalador.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            instalador.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            instalador.putExtra(Intent.EXTRA_RETURN_RESULT, false);
            getActivity().startActivity(instalador);

            JSObject resultado = new JSObject();
            resultado.put("status", "installer_opened");
            call.resolve(resultado);
        } catch (Exception erro) {
            call.reject(mensagemSegura(erro), "FALHA_INSTALADOR", erro);
        } finally {
            downloadEmAndamento.set(false);
        }
    }

    private void validarApkParaAtualizacao(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;

        PackageInfo candidato = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (candidato == null) throw new IOException("O Android não reconheceu o pacote de atualização.");
        if (!getContext().getPackageName().equals(candidato.packageName)) {
            throw new IOException("O arquivo recebido pertence a outro aplicativo.");
        }

        PackageInfo instalado = pm.getPackageInfo(getContext().getPackageName(), flags);
        long versaoCandidata = obterVersionCode(candidato);
        long versaoInstalada = obterVersionCode(instalado);
        if (versaoCandidata <= versaoInstalada) {
            throw new IOException("A atualização recebida não é mais nova que a versão instalada.");
        }

        Set<String> assinaturaInstalada = obterImpressaoAssinaturas(instalado);
        Set<String> assinaturaCandidata = obterImpressaoAssinaturas(candidato);
        if (assinaturaInstalada.isEmpty() || !assinaturaInstalada.equals(assinaturaCandidata)) {
            throw new IOException("A assinatura da atualização não corresponde à assinatura oficial instalada.");
        }
    }

    private long obterVersionCode(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
        return info.versionCode;
    }

    private Set<String> obterImpressaoAssinaturas(PackageInfo info) throws Exception {
        Signature[] assinaturas;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return new HashSet<>();
            assinaturas = info.signingInfo.getApkContentsSigners();
        } else {
            assinaturas = info.signatures;
        }

        Set<String> resultado = new HashSet<>();
        if (assinaturas == null) return resultado;
        for (Signature assinatura : assinaturas) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            resultado.add(paraHexadecimal(digest.digest(assinatura.toByteArray())));
        }
        return resultado;
    }

    private void avisarProgresso(String etapa, long baixados, long total, int percentual) {
        JSObject progresso = new JSObject();
        progresso.put("stage", etapa);
        progresso.put("downloaded", baixados);
        progresso.put("total", total);
        progresso.put("percent", percentual);
        notifyListeners("downloadProgress", progresso);
    }

    private void limparAtualizacoesAntigas(File pasta) {
        File[] arquivos = pasta.listFiles();
        if (arquivos == null) return;
        for (File arquivo : arquivos) {
            if (arquivo.isFile() && (arquivo.getName().endsWith(".apk") || arquivo.getName().endsWith(".part"))) {
                arquivo.delete();
            }
        }
    }

    private String limparNomeArquivo(String nome) {
        String limpo = nome == null ? "" : nome.replaceAll("[^0-9A-Za-z._-]", "-");
        return limpo.isEmpty() ? "Santa-Luzia-atualizacao.apk" : limpo;
    }

    private String paraHexadecimal(byte[] bytes) {
        StringBuilder resultado = new StringBuilder(bytes.length * 2);
        for (byte valor : bytes) resultado.append(String.format(Locale.ROOT, "%02x", valor));
        return resultado.toString();
    }

    private String mensagemSegura(Exception erro) {
        String mensagem = erro.getMessage();
        return mensagem == null || mensagem.trim().isEmpty()
            ? "Não foi possível baixar a atualização. Verifique sua conexão e tente novamente."
            : mensagem;
    }
}
