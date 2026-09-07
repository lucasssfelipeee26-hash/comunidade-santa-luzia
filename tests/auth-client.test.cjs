const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const esbuild=require('esbuild');
const code=esbuild.transformSync(fs.readFileSync('lib/auth-client.ts','utf8'),{loader:'ts',format:'cjs'}).code;
function client(responses){
 const calls=[];const context={exports:{},module:{exports:{}},Error,TypeError,fetch:()=>{throw Error('cached fetch must not be used')},window:{__santaLuziaNativeApiFetch:async(path,init)=>{calls.push({path,init});const r=responses.shift();if(r instanceof Error)throw r;return r;}}};
 vm.runInNewContext(code,context);return {...context.module.exports,calls};
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const session=type=>({sessao:{tipo:type,usuario:{id:'test-user',nome:'Teste'}}});
for(const tipo of ['membro','moderador'])test(`login ${tipo} checks live session before routing`,async()=>{
 const c=client([json({ok:true,usuario:{id:'test-user'}}),json(session(tipo))]);
 const result=await c.loginConfirmed('teste','senha-teste');assert.equal(result.ok,true);assert.equal(result.destino,`/area-restrita/${tipo}`);
 assert.deepEqual(c.calls.map(x=>x.path),['/api/auth/login','/api/auth/me']);assert(c.calls.every(x=>x.init.cache==='no-store'));
});
test('login success without cookie session must not redirect',async()=>{const c=client([json({ok:true}),json({sessao:null})]);assert.equal((await c.loginConfirmed('x','y')).ok,false)});
test('cached session of another user cannot confirm login',async()=>{const c=client([json({ok:true,usuario:{id:'other'}}),json(session('membro'))]);assert.equal((await c.loginConfirmed('x','y')).ok,false)});
for(const response of [json({status:'error',message:'Application not found'},404),new Response('<html>unavailable</html>',{status:502})])test(`server failure ${response.status} is explicit`,async()=>{const c=client([response]);const r=await c.loginConfirmed('x','y');assert.equal(r.ok,false);assert.match(r.erro,/servidor de acesso está indisponível/)});
test('invalid password preserves server message',async()=>{const c=client([json({erro:'Senha inválida'},401)]);assert.equal((await c.loginConfirmed('x','y')).erro,'Senha inválida')});
test('network failure does not log in or queue credentials',async()=>{const c=client([new TypeError('offline')]);assert.equal((await c.loginConfirmed('x','y')).ok,false);assert.equal(c.calls.length,1)});
test('malformed session is not an anonymous session',()=>{const c=client([]);assert.equal(c.validSession({error:'not found'}),false);assert.equal(c.validSession({sessao:null}),true)});

test('auth/me shares exactly one request while it is in flight and refreshes after settle',async()=>{
 let release;
 const firstResponse=new Promise(resolve=>{release=resolve});
 const c=client([firstResponse,json(session('moderador'))]);
 const a=c.authJson('/api/auth/me');
 const b=c.authJson('/api/auth/me');
 assert.equal(c.calls.length,1);
 release(json(session('membro')));
 const [first,second]=await Promise.all([a,b]);
 assert.equal(first.sessao.usuario.id,'test-user');
 assert.equal(second.sessao.usuario.id,'test-user');
 assert.equal(c.calls.length,1);
 const fresh=await c.authJson('/api/auth/me');
 assert.equal(fresh.sessao.tipo,'moderador');
 assert.equal(c.calls.length,2);
});

test('auth/me failure clears in-flight state so retry can perform a fresh request',async()=>{
 const c=client([new TypeError('offline'),json(session('membro'))]);
 await assert.rejects(()=>c.authJson('/api/auth/me'));
 const retry=await c.authJson('/api/auth/me');
 assert.equal(retry.sessao.tipo,'membro');
 assert.equal(c.calls.length,2);
});

test('auth mutation invalidates an older auth/me generation before post-login confirmation',async()=>{
 let releaseOld;
 const oldResponse=new Promise(resolve=>{releaseOld=resolve});
 const c=client([oldResponse,json({ok:true,usuario:{id:'test-user'}}),json(session('moderador'))]);
 const old=c.authJson('/api/auth/me');
 const login=c.loginConfirmed('teste','senha-teste');
 releaseOld(json({sessao:null}));
 await old;
 const result=await login;
 assert.equal(result.ok,true);
 assert.equal(result.destino,'/area-restrita/moderador');
 assert.deepEqual(c.calls.map(x=>x.path),['/api/auth/me','/api/auth/login','/api/auth/me']);
});

test('native transport sends API methods to SyncHttp and keeps assets local',async()=>{
 const native=[],local=[];const w={fetch:async(...args)=>{local.push(args);return new Response('asset')},Capacitor:{Plugins:{SyncHttp:{request:async x=>{native.push(x);return {status:x.method==='DELETE'?204:200,body:'{}',contentType:'application/json'}}}}}};
 const ctx={window:w,document:{documentElement:{dataset:{}}},location:{href:'https://localhost/',origin:'https://localhost'},URL,URLSearchParams,Request,Response,Headers,FormData,Blob,File,ArrayBuffer,Uint8Array,DOMException,Intl,Date,btoa,atob};
 vm.runInNewContext(fs.readFileSync('android-web/motion/android-native-fetch-beta10.js','utf8'),ctx);
 for(const method of ['GET','POST','PATCH','PUT','DELETE']) {const r=await w.fetch('/api/test',{method,...(method==='GET'?{}:{body:'{}'})});assert.equal(r.status,method==='DELETE'?204:200)}
 await w.fetch('/logo.png');assert.equal(native.length,5);assert.equal(local.length,1);assert.equal(native[0].path,'/api/test');assert.equal(w.__santaLuziaNativeApiFetch,w.fetch);
});

test('native transport keeps auth/me coalesced for the full in-flight lifetime',async()=>{
 let release;let clock=0;const native=[];
 const pending=new Promise(resolve=>{release=resolve});
 const w={fetch:async()=>new Response('asset'),Capacitor:{Plugins:{SyncHttp:{request:x=>{native.push(x);return native.length===1?pending:Promise.resolve({status:200,body:JSON.stringify(session('moderador')),contentType:'application/json'});}}}}};
 const ctx={window:w,document:{documentElement:{dataset:{}}},location:{href:'https://localhost/',origin:'https://localhost'},performance:{now:()=>clock},URL,URLSearchParams,Request,Response,Headers,FormData,Blob,File,ArrayBuffer,Uint8Array,DOMException,Intl,Date,btoa,atob};
 vm.runInNewContext(fs.readFileSync('android-web/motion/android-native-fetch-beta10.js','utf8'),ctx);
 const first=w.fetch('/api/auth/me');
 await new Promise(resolve=>setImmediate(resolve));
 clock=1000;
 const second=w.fetch('/api/auth/me');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(native.length,1);
 release({status:200,body:JSON.stringify(session('membro')),contentType:'application/json'});
 const [a,b]=await Promise.all([first,second]);
 assert.equal((await a.json()).sessao.tipo,'membro');
 assert.equal((await b.json()).sessao.tipo,'membro');
 await w.fetch('/api/auth/me');
 assert.equal(native.length,2);
});

test('native transport surfaces AbortError immediately for a signaled request',async()=>{
 const never=new Promise(()=>{});const native=[];
 const w={fetch:async()=>new Response('asset'),Capacitor:{Plugins:{SyncHttp:{request:x=>{native.push(x);return never;}}}}};
 const ctx={window:w,document:{documentElement:{dataset:{}}},location:{href:'https://localhost/',origin:'https://localhost'},URL,URLSearchParams,Request,Response,Headers,FormData,Blob,File,ArrayBuffer,Uint8Array,DOMException,Intl,Date,btoa,atob};
 vm.runInNewContext(fs.readFileSync('android-web/motion/android-native-fetch-beta10.js','utf8'),ctx);
 const controller=new AbortController();
 const request=w.fetch('/api/notificacoes',{signal:controller.signal});
 await new Promise(resolve=>setImmediate(resolve));
 controller.abort();
 await assert.rejects(request,error=>error?.name==='AbortError');
 assert.equal(native.length,1);
});
