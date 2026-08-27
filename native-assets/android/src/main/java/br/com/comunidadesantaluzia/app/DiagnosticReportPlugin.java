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
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "DiagnosticReport")
public class DiagnosticReportPlugin extends Plugin {
    private static final int MAX_REPORT_BYTES = 8 * 1024 * 1024;
    private static final String MIME_JSON = "application/json";
    private static final String PROVIDER_SUFFIX = ".diagnosticprovider";
    private volatile Uri ultimoRelatorioUri;
    private volatile String ultimoRelatorioNome;

    private String nomeSeguro(String value) {
        String raw = value == null ? "" : value.trim();
        String clean = raw.replaceAll("[^0-9A-Za-zÀ-ÿ._-]", "-").replaceAll("-+", "-");
        if (clean.isEmpty()) clean = "Santa-Luzia-Diagnostico.json";
        if (!clean.toLowerCase().endsWith(".json")) clean += ".json";
        return clean.length() > 120 ? clean.substring(0, 115) + ".json" : clean;
    }

    private byte[] conteudo(PluginCall call) {
        String content = call.getString("content", "");
        return content.getBytes(StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void saveReport(PluginCall call) {
        final String fileName = nomeSeguro(call.getString("fileName", "Santa-Luzia-Diagnostico.json"));
        final byte[] bytes = conteudo(call);
        if (bytes.length == 0) {
            call.reject("O relatório está vazio.", "RELATORIO_VAZIO");
            return;
        }
        if (bytes.length > MAX_REPORT_BYTES) {
            call.reject("O relatório excedeu o limite de 8 MB.", "RELATORIO_GRANDE");
            return;
        }

        try {
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
                    out.write(bytes);
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
                    out.write(bytes);
                    out.flush();
                    out.getFD().sync();
                }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + PROVIDER_SUFFIX, file);
                location = file.getAbsolutePath();
            }

            ultimoRelatorioUri = uri;
            ultimoRelatorioNome = fileName;
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("fileName", fileName);
            result.put("uri", uri.toString());
            result.put("location", location);
            result.put("bytes", bytes.length);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível salvar o relatório técnico no Android.", "FALHA_RELATORIO", error);
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
