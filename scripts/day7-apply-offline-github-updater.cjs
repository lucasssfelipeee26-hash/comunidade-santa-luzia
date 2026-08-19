const fs = require('node:fs')
const path = 'android-web/offline.html'
let text = fs.readFileSync(path, 'utf8')
function replace(from,to){if(!text.includes(from))throw new Error('Padrão não encontrado: '+from.slice(0,120));text=text.replace(from,to)}
replace(
  '<header class="top"><div class="seal">SL</div><div class="brand"><strong>SANTA LUZIA</strong><small>Acólitos e Coroinhas São Padre Pio</small></div></header>',
  '<header class="top"><div class="seal">SL</div><div class="brand"><strong>SANTA LUZIA</strong><small>Acólitos e Coroinhas São Padre Pio</small></div></header><div id="githubUpdate" hidden style="margin:10px 2px 2px;border:1px solid #d4af3766;border-radius:16px;background:#fff6dd;padding:11px;color:#521123;font-size:11px;line-height:1.45"></div>'
)
replace(
  'const SERVER="https://comunidade-santa-luzia-production.up.railway.app",FALLBACK_SNAPSHOT="santa-luzia:android-offline:snapshot:v1",FALLBACK_QUEUE="santa-luzia:android-offline:queue:v1";',
  'const SERVER="https://comunidade-santa-luzia-production.up.railway.app",UPDATE_MANIFEST="https://raw.githubusercontent.com/lucasssfelipeee26-hash/comunidade-santa-luzia/main/config/android-release.json",UPDATE_APK="https://github.com/lucasssfelipeee26-hash/comunidade-santa-luzia/releases/latest/download/santa-luzia.apk",FALLBACK_SNAPSHOT="santa-luzia:android-offline:snapshot:v1",FALLBACK_QUEUE="santa-luzia:android-offline:queue:v1";'
)
replace(
  'function progress(){const el=document.getElementById("progress");el.classList.add("on");setTimeout(()=>el.classList.remove("on"),480)}',
  `function progress(){const el=document.getElementById("progress");el.classList.add("on");setTimeout(()=>el.classList.remove("on"),480)}
async function checkGithubUpdate(){
  if(!navigator.onLine)return;
  const host=document.getElementById("githubUpdate");
  try{
    const r=await fetch(UPDATE_MANIFEST+"?t="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});if(!r.ok)return;
    const m=await r.json();
    if(!Number.isInteger(m?.versionCode)||!Number.isInteger(m?.apkSize)||!/^[a-f0-9]{64}$/i.test(String(m?.apkSha256||"")))return;
    const app=window.Capacitor?.Plugins?.App;if(!app?.getInfo)return;
    const info=await app.getInfo(),build=parseInt(info?.build||"0",10);if(!Number.isFinite(build)||m.versionCode<=build){host.hidden=true;return}
    host.hidden=false;host.innerHTML='<strong>Atualização '+esc(m.versionName||"")+' disponível</strong><br>Encontrada diretamente no GitHub. <button id="installGithubUpdate" class="action primary" style="margin-left:6px;min-height:34px;padding:6px 10px">Baixar e instalar</button>';
    document.getElementById("installGithubUpdate").onclick=async()=>{
      const btn=document.getElementById("installGithubUpdate");btn.disabled=true;btn.textContent="Preparando…";
      try{
        const updater=window.Capacitor?.Plugins?.AppUpdater;
        if(updater?.downloadAndInstall){await updater.downloadAndInstall({url:UPDATE_APK,fileName:'Santa-Luzia-'+String(m.versionName||'atualizacao')+'-code'+m.versionCode+'.apk',expectedSha256:String(m.apkSha256).toLowerCase(),expectedSize:Number(m.apkSize)});return}
        const browser=window.Capacitor?.Plugins?.Browser;if(browser?.open){await browser.open({url:UPDATE_APK});return}
        location.href=UPDATE_APK;
      }catch{btn.disabled=false;btn.textContent="Tentar novamente"}
    };
  }catch{}
}
async function tryRemoteServer(){if(!navigator.onLine)return;void checkGithubUpdate();try{const c=new AbortController(),t=setTimeout(()=>c.abort(),3500);const r=await fetch(SERVER+"/api/app/status?local="+Date.now(),{cache:"no-store",signal:c.signal});clearTimeout(t);if(r.ok)location.href=SERVER}catch{}}`
)
replace(
  'window.addEventListener("online",()=>{setTimeout(()=>{location.href=SERVER},300)});navs();loadNative().then(()=>{renderAll();setActive("inicio");void loadLiturgia()});',
  'window.addEventListener("online",()=>{setTimeout(()=>{void tryRemoteServer()},300)});navs();loadNative().then(()=>{renderAll();setActive("inicio");void loadLiturgia();void checkGithubUpdate();setInterval(()=>{void checkGithubUpdate()},5*60*1000)});'
)
fs.writeFileSync(path,text)
console.log('Modo local agora verifica GitHub diretamente e só retorna ao servidor quando ele responde.')
