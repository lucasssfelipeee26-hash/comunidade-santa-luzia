"use strict";

(() => {
  const VERSION = "2.0.0-beta.11";
  const FLAG = "motionReportBridgeBeta11";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const previousFetch = window.fetch.bind(window);
  const PERSONAL = "/api/formacoes/presencas/resumo?escopo=me";
  const TEAM = "/api/formacoes/presencas/resumo";

  function responseJson(data) {
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  function normalized(value) {
    const url = new URL(value, location.href);
    for (const key of ["_rsc", "motionBeta", "sync"]) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  }
  async function cacheNames() {
    if (!("caches" in window)) return [];
    const names = await caches.keys().catch(() => []);
    const selected = names.filter((name) => name.startsWith("santa-luzia-offline-v") || name.startsWith("santa-luzia-private-v"));
    if (!selected.some((name) => name.startsWith("santa-luzia-private-v"))) selected.push("santa-luzia-private-v3");
    return [...new Set(selected)];
  }
  async function readCached(path) {
    if (!("caches" in window)) return null;
    const key = new Request(normalized(path), { method: "GET", credentials: "same-origin" });
    for (const name of (await cacheNames()).sort((a, b) => Number(b.includes("private")) - Number(a.includes("private")))) {
      try {
        const hit = await (await caches.open(name)).match(key);
        if (hit) return await hit.clone().json();
      } catch {}
    }
    return null;
  }
  async function writeCached(path, data) {
    if (!("caches" in window) || !data) return;
    const key = new Request(normalized(path), { method: "GET", credentials: "same-origin" });
    const names = await cacheNames();
    await Promise.all(names.filter((name) => name.includes("private")).map(async (name) => {
      try { await (await caches.open(name)).put(key, responseJson(data)); } catch {}
    }));
  }
  async function patchCached(path, updater) {
    const current = await readCached(path);
    if (!current) return null;
    let clone;
    try { clone = structuredClone(current); } catch { clone = JSON.parse(JSON.stringify(current)); }
    const next = updater(clone);
    if (next) await writeCached(path, next);
    return next;
  }
  async function bodyOf(init, request) {
    if (typeof init?.body === "string") { try { return JSON.parse(init.body); } catch { return null; } }
    if (request) { try { return await request.clone().json(); } catch {} }
    return null;
  }
  async function currentUser() {
    const auth = await readCached("/api/auth/me");
    return auth?.sessao?.usuario || null;
  }
  async function userById(id) {
    const me = await currentUser();
    if (String(me?.id || "") === String(id)) return { id: String(id), nome: me.nome || "Usuário", funcao: me.funcao || "Participante", tipo: me.tipo || "membro" };
    for (const path of ["/api/membros", "/api/equipe"]) {
      const data = await readCached(path);
      const list = Array.isArray(data?.membros) ? data.membros : Array.isArray(data?.equipe) ? data.equipe : [];
      const found = list.find((row) => String(row?.id) === String(id));
      if (found) return { id: String(id), nome: found.nome || "Membro", funcao: found.funcao || "Participante", tipo: found.tipo || "membro" };
    }
    return { id: String(id), nome: "Membro", funcao: "Participante", tipo: "membro" };
  }
  async function formationById(id) {
    const data = await readCached("/api/formacoes");
    return (Array.isArray(data?.formacoes) ? data.formacoes : []).find((row) => String(row?.id) === String(id)) || null;
  }
  async function scaleById(id) {
    const data = await readCached("/api/escalas");
    return (Array.isArray(data?.escalas) ? data.escalas : []).find((row) => String(row?.id) === String(id)) || null;
  }

  function recalc(data) {
    const records = Array.isArray(data?.recentes) ? data.recentes : [];
    const count = (userId, status) => records.filter((row) => (!userId || String(row.usuarioId) === String(userId)) && row.status === status).length;
    if (Array.isArray(data?.pessoas)) {
      data.pessoas = data.pessoas.map((person) => {
        const id = person.id;
        const presencas = count(id, "presente");
        const faltas = count(id, "falta");
        const justificadas = count(id, "justificada");
        const advertencias = count(id, "advertencia");
        const atrasos = count(id, "atraso");
        const observacoes = count(id, "observacao");
        return { ...person, presencas, faltas, justificadas, advertencias, atrasos, total: presencas + faltas + justificadas + advertencias + atrasos + observacoes };
      });
    }
    if (data?.resumo) {
      const presencas = count(null, "presente");
      const faltas = count(null, "falta");
      const justificadas = count(null, "justificada");
      const advertencias = count(null, "advertencia");
      const atrasos = count(null, "atraso");
      const observacoes = count(null, "observacao");
      data.resumo = { ...data.resumo, presencas, faltas, justificadas, advertencias, atrasos, observacoes, total: presencas + faltas + justificadas + advertencias + atrasos + observacoes };
    }
    return data;
  }
  function upsert(data, record) {
    if (!data || !record) return data;
    const records = Array.isArray(data.recentes) ? data.recentes : [];
    data.recentes = [record, ...records.filter((row) => String(row.id) !== String(record.id))]
      .sort((a, b) => Number(b.atualizadoEm || 0) - Number(a.atualizadoEm || 0))
      .slice(0, 500);
    return recalc(data);
  }
  function remove(data, predicate) {
    if (!data) return data;
    data.recentes = (Array.isArray(data.recentes) ? data.recentes : []).filter((row) => !predicate(row));
    return recalc(data);
  }
  async function patchForUser(userId, record) {
    await patchCached(TEAM, (data) => upsert(data, record));
    const me = await currentUser();
    if (String(me?.id || "") === String(userId)) await patchCached(PERSONAL, (data) => upsert(data, record));
    window.dispatchEvent(new CustomEvent("santa-luzia:offline-data", { detail: { tipo: "relatorio", usuarioId } }));
  }
  async function removeForUser(userId, predicate) {
    await patchCached(TEAM, (data) => remove(data, predicate));
    const me = await currentUser();
    if (String(me?.id || "") === String(userId)) await patchCached(PERSONAL, (data) => remove(data, predicate));
    window.dispatchEvent(new CustomEvent("santa-luzia:offline-data", { detail: { tipo: "relatorio", usuarioId } }));
  }

  async function patchMyFormation(path, payload) {
    const match = path.match(/^\/api\/formacoes\/([^/]+)\/minha-presenca$/);
    if (!match || !payload?.status) return;
    const me = await currentUser();
    if (!me?.id) return;
    const id = decodeURIComponent(match[1]);
    const formation = await formationById(id);
    await patchForUser(me.id, {
      id: `motion-local-formacao-${id}-${me.id}`,
      usuarioId: me.id,
      usuarioNome: me.nome || "Usuário",
      usuarioFuncao: me.funcao || "Participante",
      usuarioTipo: me.tipo || "membro",
      formacaoId: id,
      formacaoTitulo: formation?.titulo || "Formação",
      formacaoData: formation?.data || new Date().toISOString().slice(0, 10),
      formacaoHorario: formation?.horario || null,
      status: payload.status,
      justificativa: payload.status === "justificada" ? (payload.justificativa || null) : null,
      atualizadoEm: Date.now(),
      offline_pendente: true,
    });
  }

  async function patchFormationBatch(path, payload) {
    const match = path.match(/^\/api\/formacoes\/([^/]+)\/presencas$/);
    if (!match || !Array.isArray(payload?.presencas)) return;
    const formationId = decodeURIComponent(match[1]);
    const formation = await formationById(formationId);
    for (const item of payload.presencas) {
      const userId = String(item?.usuarioId || "");
      if (!userId) continue;
      if (item.situacao === "nao_registrado") {
        await removeForUser(userId, (row) => String(row.formacaoId) === formationId && ["presente", "falta", "justificada"].includes(row.status));
        continue;
      }
      if (!["presente", "falta", "justificada"].includes(item.situacao)) continue;
      const user = await userById(userId);
      await patchForUser(userId, {
        id: `motion-local-formacao-${formationId}-${userId}`,
        usuarioId: userId,
        usuarioNome: user.nome,
        usuarioFuncao: user.funcao,
        usuarioTipo: user.tipo,
        formacaoId: formationId,
        formacaoTitulo: formation?.titulo || "Formação",
        formacaoData: formation?.data || new Date().toISOString().slice(0, 10),
        formacaoHorario: formation?.horario || null,
        status: item.situacao,
        justificativa: item.situacao === "justificada" ? (item.justificativa || null) : null,
        atualizadoEm: Date.now(),
        offline_pendente: true,
      });
    }
  }

  async function patchAdministrative(path, payload, responseData) {
    const match = path.match(/^\/api\/membros\/([^/]+)\/registros$/);
    if (!match || !payload?.tipo) return;
    const userId = decodeURIComponent(match[1]);
    const status = payload.tipo === "advertencias" ? "advertencia" : payload.tipo === "faltas" ? "falta" : payload.tipo === "justificativas" ? "justificada" : "observacao";
    const user = await userById(userId);
    const id = responseData?.registro?.id || responseData?.id || responseData?.clientRequestId || `local-${Date.now()}`;
    await patchForUser(userId, {
      id: `administrativo-${id}`,
      usuarioId: userId,
      usuarioNome: user.nome,
      usuarioFuncao: user.funcao,
      usuarioTipo: user.tipo,
      formacaoId: null,
      formacaoTitulo: status === "advertencia" ? "Advertência" : status === "falta" ? "Falta administrativa" : status === "justificada" ? "Justificativa" : "Observação",
      formacaoData: String(payload.data || new Date().toISOString().slice(0, 10)),
      formacaoHorario: null,
      status,
      justificativa: payload.descricao || null,
      atualizadoEm: Date.now(),
      offline_pendente: true,
    });
  }

  async function patchScaleJustification(path, payload, responseData) {
    const match = path.match(/^\/api\/escalas\/([^/]+)\/minha-justificativa$/);
    if (!match) return;
    const me = await currentUser();
    if (!me?.id) return;
    const scaleId = decodeURIComponent(match[1]);
    const scale = await scaleById(scaleId);
    const reason = payload?.justificativa || payload?.motivo || payload?.descricao || "Justificativa registrada";
    const id = responseData?.id || responseData?.clientRequestId || `local-${Date.now()}`;
    await patchForUser(me.id, {
      id: `escala-justificada-${id}`,
      usuarioId: me.id,
      usuarioNome: me.nome || "Usuário",
      usuarioFuncao: me.funcao || "Participante",
      usuarioTipo: me.tipo || "membro",
      formacaoId: scaleId,
      formacaoTitulo: `Falta justificada na missa · ${scale?.celebracao_liturgica || "Celebração litúrgica"}`,
      formacaoData: scale?.data || new Date().toISOString().slice(0, 10),
      formacaoHorario: scale?.horario || null,
      status: "justificada",
      justificativa: reason,
      atualizadoEm: Date.now(),
      offline_pendente: true,
    });
  }

  async function patchDelayModeration(payload) {
    if (payload?.action !== "moderar_atraso" || !payload?.ocorrenciaId) return;
    const ranking = await readCached("/api/ranking");
    const occurrence = (Array.isArray(ranking?.ocorrencias) ? ranking.ocorrencias : []).find((row) => String(row.id) === String(payload.ocorrenciaId));
    if (!occurrence?.usuario_id) return;
    const userId = String(occurrence.usuario_id);
    if (payload.status === "rejeitado") {
      await removeForUser(userId, (row) => String(row.id) === `atraso-${payload.ocorrenciaId}`);
      return;
    }
    if (!["confirmado", "confirmir"].includes(payload.status)) return;
    const user = await userById(userId);
    await patchForUser(userId, {
      id: `atraso-${payload.ocorrenciaId}`,
      usuarioId: userId,
      usuarioNome: user.nome,
      usuarioFuncao: user.funcao,
      usuarioTipo: user.tipo,
      formacaoId: occurrence.escala_id || null,
      formacaoTitulo: `Atraso · Missa às ${occurrence.horario_missa || ""}`,
      formacaoData: occurrence.data_missa || new Date().toISOString().slice(0, 10),
      formacaoHorario: occurrence.horario_missa || null,
      status: "atraso",
      justificativa: occurrence.observacao || `Limite de chegada: ${occurrence.limite_chegada || ""}`,
      atualizadoEm: Date.now(),
      offline_pendente: true,
    });
  }

  window.fetch = async function motionReportFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const parsed = new URL(url, location.href);
    const path = parsed.pathname;
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return previousFetch(input, init);

    const payload = await bodyOf(init, request);
    let response;
    try {
      response = await previousFetch(input, init);
    } catch (error) {
      // Alguns fluxos possuem fila de domínio própria e lançam offline de forma
      // intencional. O relatório deve refletir a mudança local mesmo assim.
      if (/^\/api\/formacoes\/[^/]+\/minha-presenca$/.test(path) && method === "PUT") await patchMyFormation(path, payload);
      throw error;
    }

    if (!response?.ok) return response;
    const responseData = await response.clone().json().catch(() => ({}));

    if (/^\/api\/formacoes\/[^/]+\/minha-presenca$/.test(path) && method === "PUT") await patchMyFormation(path, payload);
    else if (/^\/api\/formacoes\/[^/]+\/presencas$/.test(path) && method === "PUT") await patchFormationBatch(path, payload);
    else if (/^\/api\/membros\/[^/]+\/registros$/.test(path) && method === "POST") await patchAdministrative(path, payload, responseData);
    else if (/^\/api\/membros\/[^/]+\/registros\/[^/]+$/.test(path) && method === "DELETE") {
      const match = path.match(/^\/api\/membros\/([^/]+)\/registros\/([^/]+)$/);
      if (match) await removeForUser(decodeURIComponent(match[1]), (row) => String(row.id) === `administrativo-${decodeURIComponent(match[2])}`);
    }
    else if (/^\/api\/escalas\/[^/]+\/minha-justificativa$/.test(path)) await patchScaleJustification(path, payload, responseData);
    else if (path === "/api/ranking" && payload?.action === "moderar_atraso") await patchDelayModeration(payload);

    return response;
  };
})();
