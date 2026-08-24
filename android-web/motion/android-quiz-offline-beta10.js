"use strict";

(() => {
  const VERSION = "2.0.0-beta.10";
  const FLAG = "motionQuizOfflineBeta10";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const previousFetch = window.fetch.bind(window);
  const TOKEN_PREFIX = "santa-luzia:beta10:quiz-token:";
  const DONE_PREFIX = "santa-luzia:beta10:quiz-done:";

  function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
  function dateCuiaba() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }
  function id(prefix = "offline") { try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; } }
  async function online() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (network?.getStatus) return !!(await network.getStatus())?.connected;
    } catch {}
    return false;
  }
  function options(correct, others, rotate) {
    const base = [correct, ...others.filter((x) => x && x !== correct)].slice(0, 3);
    while (base.length < 3) base.push(base.length === 1 ? "Não consta na Liturgia de hoje" : "Outra referência");
    const n = rotate % 3;
    const values = [...base.slice(n), ...base.slice(0, n)];
    return { values, correct: values.indexOf(correct) };
  }
  function build(liturgy, date) {
    const first = liturgy?.leituras?.primeiraLeitura?.[0];
    const psalm = liturgy?.leituras?.salmo?.[0];
    const second = liturgy?.leituras?.segundaLeitura?.[0];
    const gospel = liturgy?.leituras?.evangelho?.[0];
    const refs = [first?.referencia, psalm?.referencia, second?.referencia, gospel?.referencia].filter(Boolean);
    const questions = [];
    if (first?.referencia) { const o = options(first.referencia, refs.filter((x) => x !== first.referencia), 1); questions.push({ id: "lit-1", enunciado: "Qual é a referência da Primeira Leitura da Liturgia de hoje?", opcoes: o.values, correta: o.correct, pontos: 10 }); }
    if (psalm?.referencia) { const o = options(psalm.referencia, refs.filter((x) => x !== psalm.referencia), 2); questions.push({ id: "lit-2", enunciado: "Qual é a referência do Salmo Responsorial de hoje?", opcoes: o.values, correta: o.correct, pontos: 10 }); }
    if (psalm?.refrao) { const o = options(psalm.refrao, ["O Senhor é meu pastor e nada me faltará.", "Provai e vede como o Senhor é bom."], 1); questions.push({ id: "lit-3", enunciado: "Qual é o refrão do Salmo Responsorial apresentado na Liturgia de hoje?", opcoes: o.values, correta: o.correct, pontos: 15 }); }
    if (gospel?.referencia) { const o = options(gospel.referencia, refs.filter((x) => x !== gospel.referencia), 0); questions.push({ id: "lit-4", enunciado: "Qual é a referência do Evangelho proclamado hoje?", opcoes: o.values, correta: o.correct, pontos: 15 }); }
    if (String(liturgy?.tempoLiturgicoAtual || "").trim()) { const o = options(liturgy.tempoLiturgicoAtual, ["Tempo do Advento", "Tempo Pascal"], 2); questions.push({ id: "lit-5", enunciado: "Em qual período litúrgico está inserida a celebração de hoje?", opcoes: o.values, correta: o.correct, pontos: 10 }); }
    if (questions.length < 3) return null;
    return { date, questions };
  }
  async function auth() {
    try {
      const r = await previousFetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
      const j = await r.json();
      return j?.sessao || null;
    } catch { return null; }
  }
  async function localQuiz() {
    const session = await auth();
    if (!session?.usuario?.id) return json({ erro: "Faça o primeiro login com internet antes de usar o Quiz offline." }, 401);
    const date = dateCuiaba();
    const doneKey = `${DONE_PREFIX}${session.usuario.id}:${date}`;
    try {
      const done = JSON.parse(localStorage.getItem(doneKey) || "null");
      if (done?.resultado) return json({ respondido: true, resultado: done.resultado, data: date, offline: true });
    } catch {}
    const liturgyResponse = await previousFetch("/api/liturgia-local", { cache: "force-cache" });
    const liturgy = await liturgyResponse.json().catch(() => null);
    const generated = build(liturgy, date);
    if (!generated) return json({ erro: "A Liturgia local não possui dados suficientes para montar o Quiz de hoje." }, 503);
    const token = id(`offline-liturgia-${date}`);
    const expires = Date.now() + 90_000;
    try { localStorage.setItem(`${TOKEN_PREFIX}${token}`, JSON.stringify({ ...generated, userId: session.usuario.id, expires })); } catch {}
    return json({ respondido: false, offline: true, quiz: { token, titulo: "Quiz da Liturgia de Hoje", descricao: "Perguntas geradas no aparelho a partir da mesma Liturgia Diária disponível offline.", expiraEm: expires, duracaoSegundos: 90, perguntas: generated.questions.map(({ correta, ...q }) => q) } });
  }
  async function appendNativeQueue(item) {
    const store = window.Capacitor?.Plugins?.OfflineStore;
    if (!store?.loadQueue || !store?.saveQueue) return false;
    try {
      const result = await store.loadQueue();
      const current = JSON.parse(result?.queue || "[]");
      const list = Array.isArray(current) ? current : [];
      if (!list.some((row) => String(row.id) === String(item.id))) list.push(item);
      await store.saveQueue({ queue: JSON.stringify(list) });
      return true;
    } catch { return false; }
  }
  async function writeRankingCache(result, userId) {
    let envelope = null;
    try { envelope = JSON.parse(localStorage.getItem("santa-luzia:offline:v1:ranking") || "null"); } catch {}
    const data = envelope?.dados;
    if (!data?.eu || !Array.isArray(data?.ranking)) return;
    const rows = data.ranking.map((row) => String(row.usuarioId) === String(userId) ? { ...row, pontos: Number(row.pontos || 0) + Number(result.pontos || 0), quizzesRespondidos: Number(row.quizzesRespondidos || 0) + 1, acertos: Number(row.acertos || 0) + Number(result.acertos || 0), offline_pendente: true } : row).sort((a, b) => Number(b.pontos || 0) - Number(a.pontos || 0)).map((row, index) => ({ ...row, posicao: index + 1 }));
    const next = { ...data, ranking: rows };
    try { localStorage.setItem("santa-luzia:offline:v1:ranking", JSON.stringify({ atualizadoEm: Date.now(), dados: next })); } catch {}
    if (!("caches" in window)) return;
    const key = new Request(new URL("/api/ranking", location.href).toString(), { method: "GET", credentials: "same-origin" });
    for (const name of await caches.keys().catch(() => [])) {
      if (!name.startsWith("santa-luzia-offline-v") && !name.startsWith("santa-luzia-private-v")) continue;
      try { await (await caches.open(name)).put(key, json(next).clone()); } catch {}
    }
  }
  async function answerOffline(request, init) {
    let body = null;
    try { body = typeof init?.body === "string" ? JSON.parse(init.body) : request ? await request.clone().json() : null; } catch {}
    const token = String(body?.token || "");
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`${TOKEN_PREFIX}${token}`) || "null"); } catch {}
    if (!saved?.userId || !Array.isArray(saved?.questions)) return json({ erro: "Tentativa offline não encontrada. Abra novamente o Quiz." }, 400);
    if (Date.now() > Number(saved.expires || 0)) return json({ erro: "O tempo desta tentativa terminou." }, 408);
    const answers = Array.isArray(body?.respostas) ? body.respostas.map(Number) : [];
    if (answers.length !== saved.questions.length || answers.some((x, i) => !Number.isInteger(x) || x < 0 || x >= saved.questions[i].opcoes.length)) return json({ erro: "Respostas incompletas." }, 400);
    let hits = 0, points = 0, total = 0;
    for (let i = 0; i < saved.questions.length; i += 1) { const q = saved.questions[i]; total += Number(q.pontos || 0); if (answers[i] === q.correta) { hits += 1; points += Number(q.pontos || 0); } }
    const result = { quiz_id: `liturgia-auto:${saved.date}`, usuario_id: saved.userId, respostas: answers, acertos: hits, pontos: points, total_pontos: total, offline_pendente: true };
    const clientRequestId = id("quiz-liturgia");
    await appendNativeQueue({ id: clientRequestId, tipo: "quiz-liturgia", criadoEm: Date.now(), ownerId: saved.userId, payload: { dataIso: saved.date, respostas: answers, clientRequestId } });
    try { localStorage.setItem(`${DONE_PREFIX}${saved.userId}:${saved.date}`, JSON.stringify({ resultado: result, savedAt: Date.now() })); localStorage.removeItem(`${TOKEN_PREFIX}${token}`); } catch {}
    await writeRankingCache(result, saved.userId);
    window.dispatchEvent(new CustomEvent("santa-luzia:offline-data", { detail: { tipo: "quiz-liturgia", pendente: true } }));
    return json({ ok: true, offline: true, queued: true, resultado: result, mensagem: "Quiz concluído no aparelho e pendente de sincronização." });
  }

  window.fetch = async function motionQuizOfflineFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    let parsed;
    try { parsed = new URL(url, location.href); } catch { return previousFetch(input, init); }
    if (parsed.origin !== location.origin) return previousFetch(input, init);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const connected = await online();
    if (!connected && method === "GET" && parsed.pathname === "/api/quizzes/liturgia") return localQuiz();
    if (!connected && method === "POST" && parsed.pathname === "/api/quizzes/liturgia/responder") return answerOffline(request, init);

    const response = await previousFetch(input, init);
    // Quizzes avulsos não carregam a chave de correção no cliente. Eles podem ser
    // respondidos offline e enviados depois, mas o placar final só é confirmado
    // pelo servidor para não expor respostas corretas no aplicativo.
    if (!connected && method === "POST" && /^\/api\/quizzes\/[^/]+\/responder$/.test(parsed.pathname) && response.ok) {
      let payload = null;
      try { payload = await response.clone().json(); } catch {}
      if (payload?.queued && !payload?.resultado) return json({ ...payload, resultado: { acertos: "pendente", pontos: 0, offline_pendente: true } });
    }
    return response;
  };
})();
