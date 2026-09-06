package br.com.comunidadesantaluzia.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "DiagnosticReport")
public class DiagnosticReportPlugin extends Plugin {
    private static final String MIME_JSON = "application/json";
    private static final String PROVIDER_SUFFIX = ".diagnosticprovider";
    private static final int COPY_BUFFER_BYTES = 128 * 1024;

    private volatile Uri ultimoRelatorioUri;
    private volatile String ultimoRelatorioNome;
    private File exportTempFile;
    private String exportTempId;
    private String exportTempName;
    private long exportTempBytes;

    private String nomeSeguro(String value) {
        String raw = value == null ? "" : value.trim();
        String clean = raw.replaceAll("[^0-9A-Za-zÀ-ÿ._-]", "-").replaceAll("-+", "-");
        if (clean.isEmpty()) clean = "Santa-Luzia-Diagnostico.json";
        if (!clean.toLowerCase().endsWith(".json")) clean += ".json";
        return clean.length() > 120 ? clean.substring(0, 115) + ".json" : clean;
    }

    private File pastaTemporaria() {
        File dir = new File(getContext().getCacheDir(), "santa-luzia-diagnostic-export");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Não foi possível preparar a exportação do relatório.");
        }
        return dir;
    }

    private void copiar(File source, OutputStream out) throws Exception {
        byte[] buffer = new byte[COPY_BUFFER_BYTES];
        try (FileInputStream in = new FileInputStream(source)) {
            int read;
            while ((read = in.read(buffer)) >= 0) {
                if (read > 0) out.write(buffer, 0, read);
            }
        }
    }

    private JSObject publicarArquivo(File source, String fileName) throws Exception {
        if (source == null || !source.exists() || source.length() <= 0) {
            throw new IllegalStateException("O relatório está vazio.");
        }

        final long bytes = source.length();
        Uri uri;
        String location;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, MIME_JSON);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Santa Luzia/Diagnosticos");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("O Android não criou o arquivo do relatório.");
            try (OutputStream out = resolver.openOutputStream(uri, "w")) {
                if (out == null) throw new IllegalStateException("O Android não abriu o arquivo do relatório.");
                copiar(source, out);
                out.flush();
            } catch (Exception error) {
                resolver.delete(uri, null, null);
                throw error;
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            location = "Downloads/Santa Luzia/Diagnosticos/" + fileName;
        } else {
            File base = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (base == null) throw new IllegalStateException("Armazenamento de Downloads indisponível.");
            File dir = new File(base, "Santa-Luzia-Diagnosticos");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Não foi possível criar a pasta do relatório.");
            File file = new File(dir, fileName);
            try (FileOutputStream out = new FileOutputStream(file, false)) {
                copiar(source, out);
                out.flush();
                out.getFD().sync();
            }
            uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + PROVIDER_SUFFIX, file);
            location = file.getAbsolutePath();
        }

        ultimoRelatorioUri = uri;
        ultimoRelatorioNome = fileName;
        if (!source.delete()) source.deleteOnExit();

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("fileName", fileName);
        result.put("uri", uri.toString());
        result.put("location", location);
        result.put("bytes", bytes);
        result.put("appByteLimit", false);
        result.put("lossless", true);
        return result;
    }

    private void limparExportacaoAtiva() {
        File file = exportTempFile;
        if (file != null && file.exists() && !file.delete()) file.deleteOnExit();
        exportTempFile = null;
        exportTempId = null;
        exportTempName = null;
        exportTempBytes = 0;
    }

    private boolean exportacaoValida(String exportId) {
        return exportTempFile != null
            && exportTempFile.exists()
            && exportTempId != null
            && exportTempId.equals(exportId);
    }

    @PluginMethod
    public synchronized void beginReport(PluginCall call) {
        try {
            limparExportacaoAtiva();
            final String fileName = nomeSeguro(call.getString("fileName", "Santa-Luzia-Diagnostico.json"));
            final String exportId = UUID.randomUUID().toString();
            final File temp = new File(pastaTemporaria(), exportId + ".json.part");
            try (FileOutputStream out = new FileOutputStream(temp, false)) {
                out.flush();
            }
            exportTempFile = temp;
            exportTempId = exportId;
            exportTempName = fileName;
            exportTempBytes = 0;

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("exportId", exportId);
            result.put("fileName", fileName);
            result.put("streaming", true);
            result.put("appByteLimit", false);
            call.resolve(result);
        } catch (Exception error) {
            limparExportacaoAtiva();
            call.reject("Não foi possível iniciar a exportação do relatório.", "FALHA_INICIAR_RELATORIO", error);
        }
    }

    @PluginMethod
    public synchronized void appendReport(PluginCall call) {
        final String exportId = call.getString("exportId", "");
        if (!exportacaoValida(exportId)) {
            call.reject("A exportação do relatório não está ativa.", "RELATORIO_EXPORTACAO_INVALIDA");
            return;
        }
        final String chunk = call.getString("chunk", "");
        try {
            byte[] bytes = chunk.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 0) {
                try (FileOutputStream out = new FileOutputStream(exportTempFile, true)) {
                    out.write(bytes);
                    out.flush();
                }
                exportTempBytes += bytes.length;
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("bytes", exportTempBytes);
            call.resolve(result);
        } catch (Exception error) {
            limparExportacaoAtiva();
            call.reject("Não foi possível continuar a gravação do relatório.", "FALHA_GRAVAR_RELATORIO", error);
        }
    }

    @PluginMethod
    public synchronized void finishReport(PluginCall call) {
        final String exportId = call.getString("exportId", "");
        if (!exportacaoValida(exportId)) {
            call.reject("A exportação do relatório não está ativa.", "RELATORIO_EXPORTACAO_INVALIDA");
            return;
        }
        if (exportTempBytes <= 0) {
            limparExportacaoAtiva();
            call.reject("O relatório está vazio.", "RELATORIO_VAZIO");
            return;
        }
        final File temp = exportTempFile;
        final String fileName = exportTempName;
        exportTempFile = null;
        exportTempId = null;
        exportTempName = null;
        exportTempBytes = 0;
        try {
            JSObject result = publicarArquivo(temp, fileName);
            result.put("streaming", true);
            call.resolve(result);
        } catch (Exception error) {
            if (temp != null && temp.exists() && !temp.delete()) temp.deleteOnExit();
            call.reject("Não foi possível finalizar o relatório técnico no Android.", "FALHA_RELATORIO", error);
        }
    }

    @PluginMethod
    public synchronized void abortReport(PluginCall call) {
        limparExportacaoAtiva();
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void saveReport(PluginCall call) {
        final String fileName = nomeSeguro(call.getString("fileName", "Santa-Luzia-Diagnostico.json"));
        final String content = call.getString("content", "");
        if (content.isEmpty()) {
            call.reject("O relatório está vazio.", "RELATORIO_VAZIO");
            return;
        }
        File temp = null;
        try {
            temp = File.createTempFile("santa-luzia-diagnostico-", ".json.part", pastaTemporaria());
            try (FileOutputStream out = new FileOutputStream(temp, false)) {
                out.write(content.getBytes(StandardCharsets.UTF_8));
                out.flush();
                out.getFD().sync();
            }
            JSObject result = publicarArquivo(temp, fileName);
            result.put("streaming", false);
            call.resolve(result);
        } catch (Exception error) {
            if (temp != null && temp.exists() && !temp.delete()) temp.deleteOnExit();
            call.reject("Não foi possível salvar o relatório técnico no Android.", "FALHA_RELATORIO", error);
        }
    }

    @PluginMethod
    public synchronized void deleteLastReport(PluginCall call) {
        Uri uri = ultimoRelatorioUri;
        try {
            boolean removed = false;
            if (uri != null) {
                if ("content".equalsIgnoreCase(uri.getScheme())) {
                    removed = getContext().getContentResolver().delete(uri, null, null) > 0;
                } else if ("file".equalsIgnoreCase(uri.getScheme())) {
                    File file = new File(uri.getPath());
                    removed = !file.exists() || file.delete();
                }
            }
            ultimoRelatorioUri = null;
            ultimoRelatorioNome = null;
            limparExportacaoAtiva();
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("removed", removed);
            call.resolve(result);
        } catch (Exception error) {
            ultimoRelatorioUri = null;
            ultimoRelatorioNome = null;
            limparExportacaoAtiva();
            call.reject("Não foi possível remover o último relatório técnico.", "FALHA_REMOVER_RELATORIO", error);
        }
    }

    @PluginMethod
    public void shareLastReport(PluginCall call) {
        Uri uri = ultimoRelatorioUri;
        if (uri == null) {
            call.reject("Gere um relatório antes de compartilhar.", "RELATORIO_AUSENTE");
            return;
        }
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(MIME_JSON);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, ultimoRelatorioNome == null ? "Auditor Santa Luzia" : ultimoRelatorioNome);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            Intent chooser = Intent.createChooser(send, "Compartilhar relatório do Auditor Santa Luzia");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("fileName", ultimoRelatorioNome);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível abrir o compartilhamento do relatório.", "FALHA_COMPARTILHAR", error);
        }
    }
}
