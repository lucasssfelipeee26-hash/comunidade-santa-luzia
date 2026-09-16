"use strict";

(() => {
  const VERSION = "2.0.0-beta.9";
  const ROOT = document.getElementById("app");
  const DOCS = {
    session: "local:session",
    escalas: "local:escalas",
    formacoes: "local:formacoes",
    ranking: "local:ranking",
    perfil: "local:perfil",
    perfis: "local:perfis",
    membros: "local:membros",
    equipe: "local:equipe",
    notificacoes: "local:notificacoes",
    quizzes: "local:quizzes",
    quizLiturgia: "local:quiz-liturgia",
    liturgia: "local:liturgia",
    tema: "local:tema",
    presencasResumo: "local:presencas-resumo",
    meta: "local:meta",
  };
  const FUNCOES_ESCALA = ["1º Cerimoniário","2º Cerimoniário","Cruciferário","1º Ceroferário","2º Ceroferário","1º Mestre de Procissão","2º Mestre de Procissão","Turiferário","Naviculário","Librífero","Auxiliar de Credência"];
  const state = {
    route: "home",
    session: null,
    escalas: { ok: true, escalas: [] },
    formacoes: { formacoes: [] },
    ranking: { ranking: [], membros: [], ocorrencias: [] },
    perfil: null,
    perfis: { perfis: [] },
    membros: { membros: [] },
    equipe: { equipe: [] },
    notificacoes: { notificacoes: [] },
    quizzes: { quizzes: [] },
    quizLiturgia: null,
    liturgia: null,
    tema: null,
    presencasResumo: null,
    meta: { lastSync: 0 },
    queue: [],
    syncing: false,
    online: false,
    menu: false,
    journeyTab: "ranking",
  };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const uid = (prefix="local") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const safeJson = (text, fallback=null) => { try { return JSON.parse(text); } catch { return fallback; } };
  const fmtDate = (iso) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||""))) return String(iso||""); const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
  const initials = (name) => String(name||"SL").trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const todayCuiaba = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Cuiaba",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const timeCuiaba = () => new Intl.DateTimeFormat("en-GB",{timeZone:"America/Cuiaba",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
  const plugin = (name) => window.Capacitor?.Plugins?.[name] || null;

  function toast(message) {
    const old = document.querySelector(".toast"); if (old) old.remove();
    const el = document.createElement("div"); el.className="toast"; el.textContent=message; document.body.appendChild(el);
    setTimeout(()=>el.remove(),3600);
  }

  async function docLoad(key) {
    const p=plugin("OfflineStore");
    if (p?.loadDocument) { try { const r=await p.loadDocument({key}); return r?.value ? safeJson(r.value,null) : null; } catch {} }
    try { const v=localStorage.getItem(`sl:${key}`); return v?safeJson(v,null):null; } catch { return null; }
  }
  async function docSave(key,value) {
    const raw=JSON.stringify(value);
    const p=plugin("OfflineStore");
    if (p?.saveDocument) { try { await p.saveDocument({key,value:raw}); return true; } catch {} }
    try { localStorage.setItem(`sl:${key}`,raw); return true; } catch { return false; }
  }
  async function queueLoad() {
    const p=plugin("OfflineStore");
    if (p?.loadQueue) { try { const r=await p.loadQueue(); const q=safeJson(r?.queue||"[]",[]); return Array.isArray(q)?q:[]; } catch {} }
    try { const q=safeJson(localStorage.getItem("sl:queue")||"[]",[]); return Array.isArray(q)?q:[]; } catch { return []; }
  }
  async function queueSave(queue) {
    state.queue=queue;
    const raw=JSON.stringify(queue);
    const p=plugin("OfflineStore");
    if (p?.saveQueue) { try { await p.saveQueue({queue:raw}); } catch {} }
    try { localStorage.setItem("sl:queue",raw); } catch {}
    renderChromeOnly();
  }

  async function server(path, method="GET", body=null, contentType="application/json; charset=utf-8") {
    const p=plugin("SyncHttp");
    if (!p?.request) throw new Error("Ponte de sincronização nativa indisponível.");
    const result=await p.request({path,method,body:body==null?"":(typeof body==="string"?body:JSON.stringify(body)),contentType});
    const parsed=safeJson(result?.body||"",{});
    return {ok:!!result?.ok,status:Number(result?.status||0),json:parsed,text:String(result?.body||"")};
  }

  async function getAndStore(key,path) {
    const r=await server(path,"GET");
    if (!r.ok) return r;
    state[key]=r.json;
    await docSave(DOCS[key],r.json);
    return r;
  }

  async function loadLocalLiturgia() {
    const data=todayCuiaba(); const mes=data.slice(0,7);
    try {
      const r=await fetch(`/offline/liturgia-completa/${mes}.json`,{cache:"force-cache"});
      if (r.ok) {
        const pacote=await r.json(); const dia=pacote?.dias?.[data];
        if (dia) { state.liturgia={...dia,dataIso:data,offline:true,fonte:{nome:"Acervo Litúrgico Santa Luzia"}}; await docSave(DOCS.liturgia,state.liturgia); return true; }
      }
    } catch {}
    return false;
  }

  async function loadAllLocal() {
    for (const key of Object.keys(DOCS)) {
      const value=await docLoad(DOCS[key]);
      if (value!=null) state[key]=value;
    }
    state.queue=await queueLoad();
    if (!state.liturgia || state.liturgia.dataIso!==todayCuiaba()) await loadLocalLiturgia();
  }

  function sessionFromAuth(auth) {
    const u=auth?.sessao?.usuario;
    if (!u?.id) return null;
    return {usuario:{id:String(u.id),nome:String(u.nome||""),usuario:u.usuario||"",email:u.email||"",funcao:u.funcao||null},tipo:auth.sessao.tipo||u.tipo||"membro",savedAt:Date.now()};
  }

  async function pullData({render=true}={}) {
    let auth=null;
    try {
      const r=await server("/api/auth/me","GET");
      if (r.ok) auth=r.json;
      else if (r.status===401) auth=null;
    } catch { state.online=false; if(render) render(); return false; }
    state.online=true;
    if (auth) {
      const sess=sessionFromAuth(auth);
      if (sess) { state.session=sess; await docSave(DOCS.session,sess); }
    }
    const common=[["escalas","/api/escalas"],["liturgia","/api/liturgia-local"]];
    if (state.session) common.push(["formacoes","/api/formacoes"],["ranking","/api/ranking"],["perfil","/api/perfil"],["perfis","/api/perfis"],["notificacoes","/api/notificacoes"],["quizzes","/api/quizzes"],["presencasResumo","/api/formacoes/presencas/resumo"]);
    if (state.session?.tipo==="moderador") common.push(["membros","/api/membros"],["equipe","/api/equipe"]);
    for (const [key,path] of common) {
      try { await getAndStore(key,path); } catch {}
    }
    try {
      const q=await server("/api/quizzes/liturgia","GET");
      if(q.ok){state.quizLiturgia=q.json;await docSave(DOCS.quizLiturgia,q.json);}
    } catch {}
    state.meta={...(state.meta||{}),lastSync:Date.now()}; await docSave(DOCS.meta,state.meta);
    if (render) render();
    return true;
  }

  async function flushQueue({refresh=true}={}) {
    if (!state.queue.length) return {sent:0,left:0};
    const kept=[]; let sent=0;
    for (const item of state.queue) {
      try {
        const r=await server(item.path,item.method,item.body,item.contentType||"application/json; charset=utf-8");
        if (r.ok || (r.status===409 && item.acceptConflict)) { sent++; continue; }
        if (r.status===401 || r.status===403) { kept.push({...item,lastError:r.json?.erro||`HTTP ${r.status}`},...state.queue.slice(state.queue.indexOf(item)+1)); break; }
        kept.push({...item,lastError:r.json?.erro||`HTTP ${r.status}`,attempts:(item.attempts||0)+1});
      } catch { kept.push(item,...state.queue.slice(state.queue.indexOf(item)+1)); state.online=false; break; }
    }
    await queueSave(kept);
    if (sent && refresh) await pullData({render:false});
    return {sent,left:kept.length};
  }

  async function syncNow({silent=false}={}) {
    if(state.syncing)return;
    state.syncing=true; renderChromeOnly();
    try {
      await flushQueue({refresh:false});
      const ok=await pullData({render:false});
      if(ok) await flushQueue({refresh:false});
      if(!silent) toast(ok?"Sincronização concluída.":"Sem internet. O aplicativo continua usando os dados locais.");
    } catch { state.online=false; if(!silent) toast("Sem internet. Alterações continuam salvas no aparelho."); }
    finally { state.syncing=false; render(); }
  }

  async function enqueue(path,method,body,label,{acceptConflict=false}={}) {
    const item={id:uid("op"),path,method,body:typeof body==="string"?body:JSON.stringify(body||{}),contentType:"application/json; charset=utf-8",label,createdAt:Date.now(),attempts:0,acceptConflict};
    await queueSave([...state.queue,item]);
    toast(`${label} salvo no aparelho. Será sincronizado quando houver internet.`);
    void syncNow({silent:true});
    return item;
  }

  function routeFromHash(){const raw=location.hash.replace(/^#\/?/,"");return raw||"home";}
  function go(route){state.menu=false;location.hash=`#/${route}`;}
  window.go=go;

  function lastSyncText(){const t=Number(state.meta?.lastSync||0);if(!t)return"ainda não sincronizado";return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(t));}
  function currentUser(){return state.session?.usuario||state.ranking?.eu||state.perfil?.perfil||null;}
  function isMod(){return state.session?.tipo==="moderador"||state.ranking?.eu?.tipo==="moderador";}
  function avatarHtml(person,size="") { const foto=person?.foto||person?.foto_url; return `<div class="avatar ${size}">${foto?`<img src="${esc(foto)}" alt="">`:esc(initials(person?.nome||"SL"))}</div>`; }

  function topbar(title="SANTA LUZIA"){
    return `<header class="topbar"><div class="brand-mini"><div class="seal">SL</div><div class="brand-copy"><b>${esc(title)}</b><small>Acólitos e Coroinhas São Padre Pio</small></div></div><span id="syncDot" class="sync-dot ${state.syncing?"syncing":state.online?"online":"offline"}"></span><button class="icon-btn" data-action="sync" aria-label="Sincronizar">↻</button>${state.session?`<button class="icon-btn" data-action="menu" aria-label="Menu">☰</button>`:""}</header>`;
  }
  function bottom(){const items=[["home","⌂","Início"],["escala","▦","Escala"],["formacao","◉","Formação"],["jornada","♕","Jornada"]];return `<nav class="bottom">${items.map(([r,i,l])=>`<button data-go="${r}" class="${state.route===r?"active":""}"><span>${i}</span>${l}</button>`).join("")}</nav>`;}
  function menu(){if(!state.menu)return"";const member=[["perfil","◉","Meu perfil"],["atrasos","◷","Atrasos"],["jornada","♕","Jornada"],["escala","▦","Escala"],["formacao","◎","Formação"],["biblioteca","▤","Biblioteca"]];const mod=[["painel","▦","Painel"],["atrasos","◷","Atrasos"],["jornada","♕","Jornada"],["gerenciar-escala","▣","Escalas"],["gerenciar-formacao","◎","Formação"],["presencas","✓","Presenças"],["registro","✎","Registro"],["quizzes-admin","?","Quizzes"],["tema","◌","Cores"],["escala","▦","Escala pública"],["biblioteca","▤","Biblioteca"]];const items=isMod()?mod:member;return `<div class="nav-modal" data-action="close-menu"><div class="nav-panel" onclick="event.stopPropagation()"><div class="row between"><div><b style="color:var(--wine)">NAVEGAÇÃO</b><div class="tiny muted">Escolha uma área</div></div><button class="icon-btn" data-action="close-menu">×</button></div><div class="nav-grid">${items.map(([r,ic,l])=>`<button class="nav-tile" data-go="${r}"><span>${ic}</span>${l}</button>`).join("")}</div></div></div>`;}
  function statusNotice(){return `<div class="notice ${state.online?"online":"offline"}">${state.online?"● Conectado para sincronização":"● Offline — o aplicativo está rodando localmente"} · última sincronização: ${esc(lastSyncText())}${state.queue.length?` · <b>${state.queue.length} pendente(s)</b>`:""}</div>`;}
  function pageHead(title,subtitle,back="home"){return `<div class="page-head"><button class="back" data-go="${back}">←</button><div><h1>${esc(title)}</h1><p>${esc(subtitle||"")}</p></div></div>`;}
  function shell(content,title){return `<div class="app fade-in">${topbar(title)}<main class="content">${content}</main>${bottom()}${menu()}</div>`;}

  function renderHome(){
    const user=currentUser(); const nextScale=(state.escalas?.escalas||[]).filter(x=>x.data>=todayCuiaba()).sort((a,b)=>`${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`))[0];
    return shell(`${statusNotice()}<section class="hero"><div class="kicker">Acólitos e Coroinhas São Padre Pio</div><h1>Servir a Deus<br>é reinar com Ele</h1><p>Formando corações para o altar e para a vida, com reverência, fé e amor a Jesus Eucarístico.</p><div class="hero-actions"><button class="primary" data-go="liturgia">▤ Liturgia diária</button><button class="secondary" data-go="escala">▦ Escala do dia</button></div></section><div class="grid2"><button class="quick" data-go="liturgia"><span class="emoji">📖</span><b>Centro Litúrgico</b><small>Liturgia diária, leituras e acervo local.</small></button><button class="quick" data-go="escala"><span class="emoji">📅</span><b>Escala do Dia</b><small>${nextScale?`${fmtDate(nextScale.data)} · ${nextScale.horario}`:"Veja as escalas sincronizadas."}</small></button><button class="quick" data-go="formacao"><span class="emoji">🎓</span><b>Formação</b><small>Materiais e presença disponíveis no aparelho.</small></button><button class="quick" data-go="jornada"><span class="emoji">🏆</span><b>Jornada</b><small>Ranking, quizzes e jogos.</small></button></div>${user?`<section class="section"><div class="card row"><div class="grow"><div class="tiny muted">Sessão local</div><h3>${esc(user.nome||"Membro")}</h3><p>${esc(state.session?.tipo||user.tipo||"")} · funciona mesmo sem rede.</p></div><button class="btn secondary" data-go="${isMod()?"painel":"perfil"}">Abrir</button></div></section>`:"<section class='section'><div class='card'><h3>Área Restrita</h3><p>Faça login uma vez com internet para manter a sessão e os dados no aparelho.</p><div class='btn-row'><button class='btn' data-go='login'>Entrar</button></div></div></section>"}`,"SANTA LUZIA");
  }

  function renderEscala(){const escalas=[...(state.escalas?.escalas||[])].sort((a,b)=>`${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`));return shell(`${pageHead("Escala do Dia","Tudo que já foi sincronizado fica disponível offline.")}${statusNotice()}${!escalas.length?`<div class="empty">Nenhuma escala publicada neste aparelho.</div>`:escalas.map(e=>`<article class="card"><div class="row between"><div><div class="badge ${e.offline_pendente?"pending":""}">${fmtDate(e.data)} · ${esc(e.horario||"")}</div><h3 style="margin-top:8px">${esc(e.celebracao_liturgica||"Celebração")}</h3></div>${e.offline_pendente?`<span class="pending-mark">pendente</span>`:""}</div><p><b>Celebrante:</b> ${esc(e.celebrante||"Não informado")}</p>${e.pessoas?.length?`<div style="margin-top:10px">${e.pessoas.map(p=>`<div class="row" style="padding:7px 0;border-top:1px solid #f1e9e6"><div class="grow"><b style="font-size:10px">${esc(p.nome||"Membro")}</b><div class="tiny muted">${esc(p.funcao||"")}</div></div></div>`).join("")}</div>`:"<p>Nenhum integrante listado.</p>"}${e.observacoes?`<p>${esc(e.observacoes)}</p>`:""}</article>`).join("")}`,"Escala");}

  function formationAllowed(f){const today=todayCuiaba();if(f.data!==today)return false;if(!f.horario)return true;return timeCuiaba()>=f.horario;}
  async function presenceAction(id,situacao){const list=state.formacoes?.formacoes||[];const f=list.find(x=>String(x.id)===String(id));if(!f)return;if(situacao==="presente"&&!formationAllowed(f)){toast(`A presença será liberada no dia da formação${f.horario?` às ${f.horario}`:""}.`);return;}let justificativa="";if(situacao==="justificada"){justificativa=prompt("Informe o motivo da justificativa:","")||"";if(justificativa.trim().length<3){toast("Informe uma justificativa válida.");return;}}f.minha_presenca={status:situacao,justificativa,atualizado_em:Date.now(),offline_pendente:true};await docSave(DOCS.formacoes,state.formacoes);render();await enqueue(`/api/formacoes/${encodeURIComponent(id)}/minha-presenca`,"PUT",{situacao,justificativa,clientRequestId:uid("pres")},situacao==="presente"?"Presença":"Justificativa",{acceptConflict:true});}
  window.presenceAction=presenceAction;
  function renderFormacao(){const fs=[...(state.formacoes?.formacoes||[])].sort((a,b)=>`${b.data}${b.horario||""}`.localeCompare(`${a.data}${a.horario||""}`));return shell(`${pageHead("Formação","Conteúdo e presença funcionam a partir do estado local.")}${statusNotice()}${!fs.length?`<div class="empty">Nenhuma formação sincronizada neste aparelho.</div>`:fs.map(f=>`<article class="card"><div class="row between"><div><span class="badge ${f.status==="cancelada"?"warn":"ok"}">${fmtDate(f.data)}${f.horario?` · ${esc(f.horario)}`:""}</span><h3 style="margin-top:8px">${esc(f.titulo||"Formação")}</h3></div>${f.minha_presenca?`<span class="badge ${f.minha_presenca.offline_pendente?"pending":"ok"}">${esc(f.minha_presenca.status)}</span>`:""}</div><p><b>Tema:</b> ${esc(f.tema||"")}</p>${f.descricao?`<p>${esc(f.descricao)}</p>`:""}${f.status!=="cancelada"&&state.session&&!isMod()?`<div class="btn-row"><button class="btn" data-presence="${esc(f.id)}:presente">Marcar presença</button><button class="btn secondary" data-presence="${esc(f.id)}:justificada">Justificar falta</button></div>`:""}${f.arquivo?`<p class="tiny">📎 ${esc(f.arquivo.nome_original||"Material anexado")} ${f.arquivo.local?"· salvo localmente":""}</p>`:""}</article>`).join("")}`,"Formação");}

  function rankingRows(){return Array.isArray(state.ranking?.ranking)?state.ranking.ranking:[];}
  async function openGame(name){const p=plugin(name);if(!p?.open){toast("Jogo nativo indisponível nesta instalação.");return;}try{const r=await p.open();if(r?.cancelled)return;if(name==="CaminhoDaLuz"){const level=Math.max(1,Number(r.level||1)),score=Math.max(0,Number(r.score||0));await enqueue("/api/jogo/caminho-da-luz/resultado","POST",{score,level,completedPhase:Math.max(0,level-1),mode:r.mode||"Missão do Altar"},"Resultado do jogo",{acceptConflict:true});}else if(name==="Whatajong"){await enqueue("/api/jogo/whatajong/resultado","POST",{score:Math.max(0,Number(r.score||0)),level:Math.max(1,Number(r.level||1)),mode:r.mode||"Whatajong"},"Resultado do Whatajong",{acceptConflict:true});}}catch(e){toast(e?.message||"Não foi possível abrir o jogo.");}}
  window.openGame=openGame;
  function renderRanking(){const rows=rankingRows();const top=rows.slice(0,3),rest=rows.slice(3);return `<section>${top.length?`<div class="podium">${top.map((r,i)=>`<div class="place ${i===0?"first":""}"><span class="trophy">${i===0?"🏆":i===1?"🥈":"🥉"}</span>${avatarHtml(r)}<b style="display:block;margin-top:7px;font-size:10px">${esc(r.nome)}</b><div class="score">${esc(r.pontos||0)}</div><div class="tiny muted">pontos</div></div>`).join("")}</div>`:"<div class='empty'>A classificação aparecerá quando houver dados sincronizados.</div>"}${rest.map(r=>`<div class="rank-row"><div class="rank-pos">${esc(r.posicao)}º</div>${avatarHtml(r)}<div><b>${esc(r.nome)}</b><small>${esc(r.funcao||"Participante")}</small></div><strong>${esc(r.pontos||0)}</strong></div>`).join("")}</section>`;}
  function renderGames(){return `<div class="card game-card"><h3>Joias da Luz / Missão do Altar</h3><p>O jogo é nativo e continua funcionando sem conexão. A pontuação fica no aparelho até sincronizar.</p><div class="btn-row"><button class="btn secondary" data-game="CaminhoDaLuz">Jogar agora</button></div></div><div class="card game-card"><h3>Whatajong</h3><p>Mahjong empacotado no APK. Resultado pode ficar pendente e subir depois.</p><div class="btn-row"><button class="btn secondary" data-game="Whatajong">Abrir Whatajong</button></div></div>`;}
  function renderQuizzes(){const qs=state.quizzes?.quizzes||[];return `<div class="card"><h3>Quiz Litúrgico</h3><p>${state.quizLiturgia?.quiz?"Quiz de hoje já foi sincronizado e está disponível neste aparelho.":"Quando o quiz for sincronizado, ele poderá ser aberto sem internet e enviado depois."}</p>${state.quizLiturgia?.quiz?`<div class="btn-row"><button class="btn" data-action="open-lit-quiz">Responder quiz salvo</button></div>`:""}</div>${qs.map(q=>`<div class="card"><h3>${esc(q.titulo)}</h3><p>${esc(q.descricao||"")} · ${q.perguntas?.length||0} pergunta(s)</p><div class="btn-row"><button class="btn secondary" data-quiz="${esc(q.id)}" ${q.respondido?"disabled":""}>${q.respondido?"Já respondido":"Responder"}</button></div></div>`).join("")||`<div class="empty">Nenhum quiz avulso sincronizado.</div>`}`;}
  function renderJornada(){const tab=state.journeyTab;return shell(`${pageHead("Jornada Litúrgica","Aprenda, jogue e acompanhe sua evolução.")}${statusNotice()}<div class="tabs"><button class="${tab==="ranking"?"active":""}" data-tab="ranking">🏆 Ranking</button><button class="${tab==="jogos"?"active":""}" data-tab="jogos">🎮 Jogos</button><button class="${tab==="quiz"?"active":""}" data-tab="quiz">❓ Quiz</button><button class="${tab==="pendentes"?"active":""}" data-tab="pendentes">↻ Fila</button></div>${tab==="ranking"?renderRanking():tab==="jogos"?renderGames():tab==="quiz"?renderQuizzes():renderQueue()}`,"Jornada Litúrgica");}
  function renderQueue(){return `<div class="section-title"><h2>Sincronização pendente</h2><small>${state.queue.length}</small></div>${!state.queue.length?`<div class="empty">Nenhuma ação pendente.</div>`:state.queue.map(q=>`<div class="card queue-item"><div class="row between"><div><h3>${esc(q.label||"Operação")}</h3><p>${new Date(q.createdAt).toLocaleString("pt-BR")} · tentativa ${q.attempts||0}</p></div><span class="badge pending">pendente</span></div>${q.lastError?`<p style="color:var(--danger)">${esc(q.lastError)}</p>`:""}</div>`).join("")}`;}

  function readingText(block){if(Array.isArray(block))return block.map(x=>x?.texto||x?.titulo||"").filter(Boolean).join("\n\n");return block?.texto||"";}
  function renderLiturgia(){const d=state.liturgia||{};const l=d.leituras||{};const items=[["1ª Leitura",l.primeiraLeitura],["Salmo Responsorial",l.salmo],["2ª Leitura",l.segundaLeitura],["Evangelho",l.evangelho]];return shell(`${pageHead("Liturgia Diária","Acervo anual empacotado dentro do APK.")}${statusNotice()}<section class="liturgia-day"><div class="inner"><div class="tiny" style="color:#f4d98e">LITURGIA DO DIA · ${fmtDate(d.dataIso||todayCuiaba())}</div><h2>${esc(d.titulo||d.nome||"Celebração do dia")}</h2><div class="tiny">${esc(d.cor||d.corLiturgica||"")}</div></div></section>${items.map(([title,b])=>{const t=readingText(b);return t?`<section class="reading"><h3>${title}</h3><p>${esc(t)}</p></section>`:""}).join("")||`<div class="empty" style="margin-top:10px">O acervo local deste dia não foi encontrado. O aplicativo tentará completar na próxima sincronização.</div>`}`,"Liturgia");}

  function profileList(){const candidates=state.perfis?.perfis||state.equipe?.equipe||state.membros?.membros||state.ranking?.membros||[];return Array.isArray(candidates)?candidates:[];}
  function renderPerfil(){const p=state.perfil?.perfil||currentUser()||{};return shell(`${pageHead("Meu Perfil","Dados salvos localmente.")}${statusNotice()}<div class="card" style="text-align:center">${avatarHtml(p)}<h3 style="margin-top:10px">${esc(p.nome||"Membro")}</h3><p>${esc(p.funcao||state.session?.tipo||"")}</p>${p.bio?`<p>${esc(p.bio)}</p>`:"<p>Adicione uma bio quando quiser.</p>"}<div class="btn-row" style="justify-content:center"><button class="btn secondary" data-action="edit-bio">Editar bio</button></div></div>`,"Meu Perfil");}
  function renderPainel(){const profiles=profileList();const stats=[profiles.length,state.ranking?.ocorrencias?.filter(x=>x.status==="pendente").length||0,state.formacoes?.formacoes?.length||0,state.escalas?.escalas?.length||0];return shell(`${pageHead("Área Restrita","Painel local da equipe.")}${statusNotice()}<div class="stats"><div class="stat"><strong>${stats[0]}</strong><small>Equipe</small></div><div class="stat"><strong>${stats[1]}</strong><small>Atrasos</small></div><div class="stat"><strong>${stats[2]}</strong><small>Formações</small></div><div class="stat"><strong>${stats[3]}</strong><small>Escalas</small></div></div><section class="section"><div class="section-title"><h2>Perfis da equipe</h2><small>${profiles.length}</small></div>${profiles.length?`<div class="profile-grid">${profiles.map(p=>`<div class="profile">${avatarHtml(p)}<b>${esc(p.nome)}</b><small>${esc(p.funcao||p.tipo||"")}</small></div>`).join("")}</div>`:`<div class="empty">Nenhum perfil sincronizado neste aparelho.</div>`}</section>`,"Área Restrita");}

  async function reportDelay(form){const fd=new FormData(form);const usuarioId=String(fd.get("usuarioId")||"");const dataMissa=String(fd.get("dataMissa")||todayCuiaba());const horarioMissa=String(fd.get("horarioMissa")||"18:00");const observacao=String(fd.get("observacao")||"");if(!usuarioId){toast("Escolha um colega.");return;}const me=currentUser();const members=state.ranking?.membros||[];const target=members.find(m=>String(m.id)===usuarioId);const occ={id:uid("atraso"),usuario_id:usuarioId,usuario_nome:target?.nome||"Membro",data_missa:dataMissa,horario_missa:horarioMissa,limite_chegada:horarioMissa,observacao,status:"pendente",criado_em:Date.now(),reportado_por:me?.id,reportado_por_nome:me?.nome,offline_pendente:true};state.ranking.ocorrencias=[occ,...(state.ranking.ocorrencias||[])];await docSave(DOCS.ranking,state.ranking);render();await enqueue("/api/ranking","POST",{action:"reportar_atraso",usuarioId,dataMissa,horarioMissa,observacao,clientRequestId:uid("delay")},"Relato de atraso",{acceptConflict:true});}
  async function moderateDelay(id,status){const occ=(state.ranking?.ocorrencias||[]).find(o=>String(o.id)===String(id));if(occ){occ.status=status;occ.offline_pendente=true;await docSave(DOCS.ranking,state.ranking);render();}await enqueue("/api/ranking","POST",{action:"moderar_atraso",ocorrenciaId:id,status},status==="confirmado"?"Confirmação de atraso":"Rejeição de atraso");}
  window.moderateDelay=moderateDelay;
  function renderAtrasos(){const data=state.ranking||{};const me=currentUser()||data.eu||{};const members=(data.membros||[]).filter(m=>String(m.id)!==String(me.id));const occ=data.ocorrencias||[];return shell(`${pageHead("Central de Atrasos","Relatos e decisões permanecem operáveis offline.",isMod()?"painel":"perfil")}${statusNotice()}<section class="card"><h3>Reportar colega atrasado</h3><p>O relato é salvo primeiro no aparelho; o moderador decide e a sincronização ocorre depois.</p><form id="delayForm" class="form-grid two" style="margin-top:12px"><label class="field">Colega<select name="usuarioId" required>${members.map(m=>`<option value="${esc(m.id)}">${esc(m.nome)} · ${esc(m.funcao||"")}</option>`).join("")}</select></label><label class="field">Data da Missa<input name="dataMissa" type="date" value="${todayCuiaba()}" required></label><label class="field">Horário da Missa<input name="horarioMissa" type="time" value="18:00" required></label><label class="field">Observação<input name="observacao" maxlength="300" placeholder="Ex.: chegou após o início"></label><button class="btn" type="submit">Salvar relato</button></form></section><section class="section"><div class="section-title"><h2>${isMod()?"Aguardando sua decisão":"Relatos"}</h2><small>${occ.length}</small></div>${!occ.length?`<div class="empty">Nenhum relato salvo neste aparelho.</div>`:occ.map(o=>`<article class="card"><div class="row between"><div><h3>${esc(o.usuario_nome||"Membro")}</h3><p>Missa de ${fmtDate(o.data_missa)} às ${esc(o.horario_missa||"")}</p></div><span class="badge ${o.status==="pendente"?"warn":o.status==="confirmado"?"ok":""}">${esc(o.status)}</span></div>${o.observacao?`<p>${esc(o.observacao)}</p>`:""}${o.offline_pendente?`<div class="pending-mark">alteração pendente</div>`:""}${isMod()&&o.status==="pendente"?`<div class="btn-row"><button class="btn" data-delay="${esc(o.id)}:confirmado">Confirmar atraso</button><button class="btn secondary" data-delay="${esc(o.id)}:rejeitado">Rejeitar</button></div>`:""}</article>`).join("")}</section>`,"Atrasos");}

  function memberSource(){const a=state.membros?.membros||state.equipe?.equipe||state.ranking?.membros||[];return Array.isArray(a)?a:[];}
  async function createScale(form){const fd=new FormData(form);const pessoas=[];for(const m of memberSource()){const func=String(fd.get(`func_${m.id}`)||"");if(func)pessoas.push({id:m.id,categoria:String(m.funcao).toLowerCase().includes("coroin")?"coroinha":"acolito",funcao:func});}const payload={data:String(fd.get("data")||""),horario:String(fd.get("horario")||""),celebrante:String(fd.get("celebrante")||""),observacoes:String(fd.get("observacoes")||""),pessoas};if(!payload.data||!payload.horario||payload.celebrante.trim().length<2){toast("Preencha data, horário e celebrante.");return;}const local={id:uid("escala"),...payload,pessoas:pessoas.map(p=>({...p,nome:memberSource().find(m=>m.id===p.id)?.nome||"Membro"})),offline_pendente:true};state.escalas.escalas=[local,...(state.escalas.escalas||[])];await docSave(DOCS.escalas,state.escalas);render();await enqueue("/api/escalas","POST",payload,"Publicação de escala");}
  function renderManageScale(){const members=memberSource();return shell(`${pageHead("Gerenciar Escalas","Crie a escala no aparelho e publique quando houver rede.","painel")}${statusNotice()}<section class="card"><h3>Nova escala</h3><form id="scaleForm" class="form-grid two" style="margin-top:12px"><label class="field">Data<input type="date" name="data" value="${todayCuiaba()}" required></label><label class="field">Horário<input type="time" name="horario" value="18:00" required></label><label class="field">Celebrante<input name="celebrante" placeholder="Padre ..." required></label><label class="field">Observações<input name="observacoes" maxlength="1200"></label><div style="grid-column:1/-1"><div class="tiny muted" style="margin-bottom:7px">Equipe e função</div>${members.map(m=>`<div class="row" style="margin-bottom:7px"><div class="grow"><b style="font-size:10px">${esc(m.nome)}</b><div class="tiny muted">${esc(m.funcao||"")}</div></div><select name="func_${esc(m.id)}" style="max-width:180px;border:1px solid var(--line);border-radius:10px;padding:8px"><option value="">Fora da escala</option>${FUNCOES_ESCALA.map(f=>`<option>${f}</option>`).join("")}</select></div>`).join("")}</div><button class="btn" type="submit">Salvar/publicar escala</button></form></section><section class="section">${renderEscalaCardsInline()}</section>`,"Gerenciar Escalas");}
  function renderEscalaCardsInline(){const es=state.escalas?.escalas||[];return es.map(e=>`<div class="card"><div class="row between"><div><h3>${fmtDate(e.data)} · ${esc(e.horario)}</h3><p>${esc(e.celebrante||"")}</p></div>${e.offline_pendente?`<span class="badge pending">pendente</span>`:""}</div></div>`).join("")||`<div class="empty">Nenhuma escala.</div>`;}

  async function createFormation(form){const fd=new FormData(form);const payload={titulo:String(fd.get("titulo")||""),tema:String(fd.get("tema")||""),data:String(fd.get("data")||""),horario:String(fd.get("horario")||""),descricao:String(fd.get("descricao")||""),status:"agendada"};if(payload.titulo.length<3||payload.tema.length<3||!payload.data){toast("Informe título, tema e data.");return;}const local={id:uid("formacao"),...payload,minha_presenca:null,offline_pendente:true};state.formacoes.formacoes=[local,...(state.formacoes.formacoes||[])];await docSave(DOCS.formacoes,state.formacoes);render();await enqueue("/api/formacoes","POST",payload,"Publicação de formação");}
  function renderManageFormation(){return shell(`${pageHead("Gerenciar Formação","A formação nasce localmente e sincroniza depois.","painel")}${statusNotice()}<section class="card"><h3>Nova formação</h3><form id="formationForm" class="form-grid two" style="margin-top:12px"><label class="field">Título<input name="titulo" required></label><label class="field">Tema<input name="tema" required></label><label class="field">Data<input type="date" name="data" value="${todayCuiaba()}" required></label><label class="field">Horário<input type="time" name="horario" value="13:00"></label><label class="field" style="grid-column:1/-1">Descrição<textarea name="descricao"></textarea></label><button class="btn" type="submit">Salvar formação</button></form></section><section class="section">${(state.formacoes?.formacoes||[]).map(f=>`<div class="card"><div class="row between"><div><h3>${esc(f.titulo)}</h3><p>${fmtDate(f.data)} ${esc(f.horario||"")}</p></div>${f.offline_pendente?`<span class="badge pending">pendente</span>`:""}</div></div>`).join("")||`<div class="empty">Nenhuma formação.</div>`}</section>`,"Gerenciar Formação");}

  function renderPresencas(){const fs=state.formacoes?.formacoes||[];return shell(`${pageHead("Controle de Presenças","O que já foi recebido fica disponível; alterações entram na fila.","painel")}${statusNotice()}${fs.map(f=>`<div class="card"><div class="row between"><div><h3>${esc(f.titulo)}</h3><p>${fmtDate(f.data)} · ${esc(f.horario||"")}</p></div><button class="btn secondary" data-pres-admin="${esc(f.id)}">Abrir lista</button></div></div>`).join("")||`<div class="empty">Nenhuma formação sincronizada.</div>`}`,"Presenças");}

  async function saveRecord(form){const fd=new FormData(form);const payload={usuarioId:String(fd.get("usuarioId")||""),tipo:String(fd.get("tipo")||"observacao"),texto:String(fd.get("texto")||"")};if(!payload.usuarioId||payload.texto.trim().length<3){toast("Escolha o membro e escreva o registro.");return;}await enqueue(`/api/membros/${encodeURIComponent(payload.usuarioId)}/registros`,"POST",payload,"Novo registro");form.reset();}
  function renderRegistro(){const ms=memberSource();return shell(`${pageHead("Novo Registro","Registre localmente; o envio ocorrerá depois.","painel")}${statusNotice()}<section class="card"><form id="recordForm" class="form-grid"><label class="field">Membro<select name="usuarioId">${ms.map(m=>`<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join("")}</select></label><label class="field">Tipo<select name="tipo"><option value="observacao">Observação</option><option value="advertencia">Advertência</option><option value="falta">Falta</option><option value="justificativa">Justificativa</option></select></label><label class="field">Registro<textarea name="texto" required></textarea></label><button class="btn">Salvar registro</button></form></section>`,"Registro");}

  function renderQuizAdmin(){const qs=state.quizzes?.quizzes||[];return shell(`${pageHead("Gerenciar Quizzes","Quizzes sincronizados ficam visíveis offline.","painel")}${statusNotice()}${qs.map(q=>`<div class="card"><h3>${esc(q.titulo)}</h3><p>${esc(q.descricao||"")} · ${q.perguntas?.length||0} pergunta(s)</p></div>`).join("")||`<div class="empty">Nenhum quiz sincronizado.</div>`}`,"Quizzes");}
  function renderTema(){const themes=[["classico","Clássico Santa Luzia",["#7b1326","#fffaf0","#d2b46c"]],["vinho","Vinho e Ouro",["#53101e","#fff","#c9a34e"]],["claro","Marfim",["#6d283a","#fffdf8","#d9c49a"]]];return shell(`${pageHead("Cores do Site","A escolha pode ser feita offline e sincronizada depois.","painel")}${statusNotice()}<div class="profile-grid">${themes.map(([id,n,cs])=>`<button class="profile" data-theme="${id}"><b>${n}</b><div style="display:flex;gap:4px;margin-top:10px">${cs.map(c=>`<span style="height:35px;flex:1;border-radius:9px;background:${c};border:1px solid #ddd"></span>`).join("")}</div>${state.tema?.tema===id?`<div class="badge ok" style="margin-top:8px">Atual</div>`:""}</button>`).join("")}</div>`,"Cores");}
  function renderBiblioteca(){return shell(`${pageHead("Biblioteca","Materiais já sincronizados continuam acessíveis.")}${statusNotice()}<div class="card"><h3>Acervo Litúrgico</h3><p>O pacote anual da Liturgia está dentro do APK. Outros materiais baixados ficam associados à sincronização local.</p><div class="btn-row"><button class="btn" data-go="liturgia">Abrir Liturgia</button></div></div>`,"Biblioteca");}

  function renderLogin(){return `<div class="login-wrap"><section class="login-card"><div class="seal">SL</div><h1>Santa Luzia</h1><p>Entre uma vez com internet. Depois, o aplicativo permanece utilizável offline.</p>${!state.online?`<div class="notice offline">Sem internet. Se já existe uma sessão local, volte e use o aplicativo normalmente.</div>`:""}<form id="loginForm" class="form-grid"><label class="field">Usuário ou e-mail<input name="usuario" autocomplete="username" required></label><label class="field">Senha<input name="senha" type="password" autocomplete="current-password" required></label><button class="btn" type="submit">Entrar e sincronizar</button><button class="btn secondary" type="button" data-go="home">Voltar</button></form></section></div>`;}
  async function login(form){const fd=new FormData(form);try{const r=await server("/api/auth/login","POST",{usuario:String(fd.get("usuario")||""),senha:String(fd.get("senha")||"")});if(!r.ok){toast(r.json?.erro||"Não foi possível entrar.");return;}state.online=true;state.session={usuario:r.json.usuario,tipo:r.json.usuario?.tipo||(/moderador/.test(r.json.destino||"")?"moderador":"membro"),savedAt:Date.now()};await docSave(DOCS.session,state.session);await syncNow({silent:true});go(isMod()?"painel":"perfil");}catch{toast("Sem conexão. O login novo exige internet; sessões já salvas continuam funcionando offline.");}}

  async function editBio(){const p=state.perfil?.perfil||{};const bio=prompt("Bio / recado:",p.bio||"");if(bio===null)return;if(!state.perfil)state.perfil={perfil:{...currentUser()}};state.perfil.perfil={...(state.perfil.perfil||{}),bio,offline_pendente:true};await docSave(DOCS.perfil,state.perfil);render();await enqueue("/api/perfil","PATCH",{bio},"Atualização da bio");}
  async function chooseTheme(id){state.tema={...(state.tema||{}),tema:id,offline_pendente:true};await docSave(DOCS.tema,state.tema);render();await enqueue("/api/configuracao/tema","POST",{tema:id},"Alteração de tema");}

  function render(){state.route=routeFromHash();let html="";switch(state.route){case"home":html=renderHome();break;case"escala":html=renderEscala();break;case"formacao":html=renderFormacao();break;case"jornada":html=renderJornada();break;case"liturgia":html=renderLiturgia();break;case"perfil":html=state.session?renderPerfil():renderLogin();break;case"painel":html=state.session?renderPainel():renderLogin();break;case"atrasos":html=state.session?renderAtrasos():renderLogin();break;case"gerenciar-escala":html=isMod()?renderManageScale():renderHome();break;case"gerenciar-formacao":html=isMod()?renderManageFormation():renderHome();break;case"presencas":html=isMod()?renderPresencas():renderHome();break;case"registro":html=isMod()?renderRegistro():renderHome();break;case"quizzes-admin":html=isMod()?renderQuizAdmin():renderHome();break;case"tema":html=isMod()?renderTema():renderHome();break;case"biblioteca":html=renderBiblioteca();break;case"login":html=renderLogin();break;default:html=renderHome();}ROOT.innerHTML=html;bind();}
  function renderChromeOnly(){const dot=document.getElementById("syncDot");if(dot)dot.className=`sync-dot ${state.syncing?"syncing":state.online?"online":"offline"}`;}

  async function openAdminPresence(formacaoId){try{let data=await docLoad(`pres:${formacaoId}`);try{const r=await server(`/api/formacoes/${encodeURIComponent(formacaoId)}/presencas`,"GET");if(r.ok){data=r.json;await docSave(`pres:${formacaoId}`,data);state.online=true;}}catch{}if(!data){toast("Essa lista ainda não foi sincronizada neste aparelho.");return;}const participantes=data.participantes||data.presencas||[];const modal=document.createElement("div");modal.className="nav-modal";modal.innerHTML=`<div class="nav-panel"><div class="row between"><div><b>Lista de presença</b><div class="tiny muted">Alterações ficam pendentes offline</div></div><button class="icon-btn" id="closePres">×</button></div><div style="margin-top:10px">${participantes.map(p=>`<div class="row" style="margin:7px 0"><div class="grow"><b style="font-size:10px">${esc(p.nome)}</b></div><select data-part="${esc(p.id)}" style="border:1px solid var(--line);border-radius:9px;padding:7px"><option value="presente" ${p.situacao==="presente"||p.status==="presente"?"selected":""}>Presente</option><option value="falta" ${p.situacao==="falta"||p.status==="falta"?"selected":""}>Falta</option><option value="justificada" ${p.situacao==="justificada"||p.status==="justificada"?"selected":""}>Justificada</option></select></div>`).join("")}</div><div class="btn-row"><button class="btn" id="savePres">Salvar lista</button></div></div>`;document.body.appendChild(modal);modal.querySelector("#closePres").onclick=()=>modal.remove();modal.querySelector("#savePres").onclick=async()=>{const presencas=[...modal.querySelectorAll("[data-part]")].map(s=>({usuarioId:s.dataset.part,situacao:s.value,justificativa:""}));await enqueue(`/api/formacoes/${encodeURIComponent(formacaoId)}/presencas`,"PUT",{presencas},"Lista de presença");modal.remove();};}catch(e){toast(e?.message||"Não foi possível abrir a lista.");}}

  function bind(){
    document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",()=>go(el.dataset.go)));
    document.querySelectorAll("[data-action='sync']").forEach(el=>el.addEventListener("click",()=>void syncNow()));
    document.querySelectorAll("[data-action='menu']").forEach(el=>el.addEventListener("click",()=>{state.menu=true;render();}));
    document.querySelectorAll("[data-action='close-menu']").forEach(el=>el.addEventListener("click",()=>{state.menu=false;render();}));
    document.querySelectorAll("[data-action='edit-bio']").forEach(el=>el.addEventListener("click",()=>void editBio()));
    document.querySelectorAll("[data-presence]").forEach(el=>el.addEventListener("click",()=>{const [id,s]=el.dataset.presence.split(":");void presenceAction(id,s);}));
    document.querySelectorAll("[data-delay]").forEach(el=>el.addEventListener("click",()=>{const [id,s]=el.dataset.delay.split(":");void moderateDelay(id,s);}));
    document.querySelectorAll("[data-game]").forEach(el=>el.addEventListener("click",()=>void openGame(el.dataset.game)));
    document.querySelectorAll("[data-tab]").forEach(el=>el.addEventListener("click",()=>{state.journeyTab=el.dataset.tab;render();}));
    document.querySelectorAll("[data-theme]").forEach(el=>el.addEventListener("click",()=>void chooseTheme(el.dataset.theme)));
    document.querySelectorAll("[data-pres-admin]").forEach(el=>el.addEventListener("click",()=>void openAdminPresence(el.dataset.presAdmin)));
    document.getElementById("delayForm")?.addEventListener("submit",e=>{e.preventDefault();void reportDelay(e.currentTarget);});
    document.getElementById("scaleForm")?.addEventListener("submit",e=>{e.preventDefault();void createScale(e.currentTarget);});
    document.getElementById("formationForm")?.addEventListener("submit",e=>{e.preventDefault();void createFormation(e.currentTarget);});
    document.getElementById("recordForm")?.addEventListener("submit",e=>{e.preventDefault();void saveRecord(e.currentTarget);});
    document.getElementById("loginForm")?.addEventListener("submit",e=>{e.preventDefault();void login(e.currentTarget);});
  }

  async function initNetwork(){
    const n=plugin("Network");
    if(n?.getStatus){try{const s=await n.getStatus();state.online=!!s.connected;}catch{}}
    if(n?.addListener){try{await n.addListener("networkStatusChange",async s=>{state.online=!!s.connected;renderChromeOnly();if(s.connected)void syncNow({silent:true});});}catch{}}
    window.addEventListener("online",()=>{state.online=true;renderChromeOnly();void syncNow({silent:true});});
    window.addEventListener("offline",()=>{state.online=false;renderChromeOnly();});
  }

  async function boot(){
    document.documentElement.dataset.localFirst=VERSION;
    await loadAllLocal();
    await initNetwork();
    state.route=routeFromHash();
    render();
    if(state.online) void syncNow({silent:true});
    else if(!state.session){try{const r=await server("/api/auth/me","GET");if(r.ok){state.online=true;const sess=sessionFromAuth(r.json);if(sess){state.session=sess;await docSave(DOCS.session,sess);await syncNow({silent:true});}}}catch{}}
  }

  window.addEventListener("hashchange",render);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.online)void syncNow({silent:true});});
  boot().catch(err=>{ROOT.innerHTML=`<div class="login-wrap"><div class="login-card"><h1>Santa Luzia</h1><div class="notice error">Falha ao iniciar o armazenamento local: ${esc(err?.message||err)}</div><button class="btn" onclick="location.reload()">Reabrir</button></div></div>`;});
})();
