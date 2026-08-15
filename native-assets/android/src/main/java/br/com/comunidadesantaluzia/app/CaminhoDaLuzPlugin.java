package br.com.comunidadesantaluzia.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CaminhoDaLuz")
public class CaminhoDaLuzPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(getContext(), CaminhoDaLuzActivity.class);
        startActivityForResult(call, intent, "resultadoJogo");
    }

    @ActivityCallback
    private void resultadoJogo(PluginCall call, ActivityResult result) {
        if (call == null) return;

        JSObject resposta = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            resposta.put("cancelled", true);
            call.resolve(resposta);
            return;
        }

        resposta.put("cancelled", false);
        resposta.put("score", Math.max(0, data.getIntExtra("score", 0)));
        resposta.put("level", Math.max(1, data.getIntExtra("level", 1)));
        resposta.put("mode", data.getStringExtra("mode") == null ? "Missão do Altar" : data.getStringExtra("mode"));
        call.resolve(resposta);
    }
}
