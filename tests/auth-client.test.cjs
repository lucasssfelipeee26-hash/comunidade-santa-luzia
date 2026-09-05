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
test('native transport sends API methods to SyncHttp and keeps assets local',async()=>{
 const native=[],local=[];const w={fetch:async(...args)=>{local.push(args);return new Response('asset')},Capacitor:{Plugins:{SyncHttp:{request:async x=>{native.push(x);return {status:x.method==='DELETE'?204:200,body:'{}',contentType:'application/json'}}}}}};
 const ctx={window:w,document:{documentElement:{dataset:{}}},location:{href:'https://localhost/',origin:'https://localhost'},URL,URLSearchParams,Request,Response,Headers,FormData,Blob,File,ArrayBuffer,Uint8Array,DOMException,Intl,Date,btoa,atob};
 vm.runInNewContext(fs.readFileSync('android-web/motion/android-native-fetch-beta10.js','utf8'),ctx);
 for(const method of ['GET','POST','PATCH','PUT','DELETE']) {const r=await w.fetch('/api/test',{method,...(method==='GET'?{}:{body:'{}'})});assert.equal(r.status,method==='DELETE'?204:200)}
 await w.fetch('/logo.png');assert.equal(native.length,5);assert.equal(local.length,1);assert.equal(native[0].path,'/api/test');assert.equal(w.__santaLuziaNativeApiFetch,w.fetch);
});
