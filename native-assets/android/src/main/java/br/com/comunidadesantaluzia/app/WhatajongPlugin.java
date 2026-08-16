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

@CapacitorPlugin(name = "Whatajong")
public class WhatajongPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(getContext(), WhatajongActivity.class);
        startActivityForResult(call, intent, "resultadoWhatajong");
    }

    @ActivityCallback
    private void resultadoWhatajong(PluginCall call, ActivityResult result) {
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
        resposta.put("completedRound", Math.max(0, data.getIntExtra("completedRound", 0)));
        String dificuldade = data.getStringExtra("difficulty");
        resposta.put("difficulty", dificuldade == null ? "facil" : dificuldade);
        call.resolve(resposta);
    }
}
