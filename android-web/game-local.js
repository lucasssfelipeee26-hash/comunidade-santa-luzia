"use strict";
(() => {
  const plugins = () => window.Capacitor?.Plugins || {};
  const parse = (v,f=[]) => { try { return JSON.parse(v); } catch { return f; } };
  const id = () => `whatajong-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  function toast(text){const old=document.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast';el.textContent=text;document.body.appendChild(el);setTimeout(()=>el.remove(),3400);}
  async function save(item){const p=plugins().OfflineStore;let list=[];try{const r=await p?.loadQueue();list=parse(r?.queue||'[]',[]);if(!Array.isArray(list))list=[];}catch{}list.push(item);try{await p?.saveQueue({queue:JSON.stringify(list)});}catch{}toast('Resultado salvo no aparelho. Será sincronizado quando houver internet.');}
  async function open(){const p=plugins().Whatajong;if(!p?.open){toast('Whatajong nativo indisponível.');return;}try{const r=await p.open();if(r?.cancelled)return;const completedRound=Math.max(0,Number(r.completedRound||0));if(completedRound<1){toast('Nenhuma rodada concluída para sincronizar.');return;}await save({id:id(),path:'/api/jogo/whatajong/resultado',method:'POST',body:JSON.stringify({score:Math.max(0,Number(r.score||0)),completedRound,difficulty:String(r.difficulty||'facil')}),contentType:'application/json; charset=utf-8',label:'Resultado do Whatajong',createdAt:Date.now(),attempts:0,acceptConflict:true});}catch(e){toast(e?.message||'Não foi possível abrir o Whatajong.');}}
  document.addEventListener('click',event=>{const el=event.target instanceof Element?event.target.closest('[data-game="Whatajong"]'):null;if(!el)return;event.preventDefault();event.stopImmediatePropagation();void open();},true);
})();
