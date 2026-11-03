'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { RolePortal, createBootstrap, validateRequest, sign, verify, digest, credentialRevision } = require('../role-backend.js');
const { cryptography: C, generateLoginKey } = require('../backend.js');
const { publish } = require('../scripts/publish-request.cjs');
const { createTeacherDirectory } = require('../scripts/bootstrap-portal.cjs');
const config = { owner:'test-school', repo:'portal', branch:'main', dataPath:'data/portal.json', apiVersion:'2026-03-10' };
const password = 'a strong test password';
class Store {
  constructor(){this.values=new Map();}
  async get(key){return structuredClone(this.values.get(key)??null);}
  async set(key,value){this.values.set(key,structuredClone(value));}
  async delete(key){this.values.delete(key);}
}
class Repository {
  constructor(catalog,files=[]){this.catalog=catalog;this.head=0;this.files=new Map(files.map(file=>[file.path,JSON.parse(file.content)]));this.files.set('data/teachers/teacher.json',createTeacherDirectory({ ...catalog, students:catalog.students.filter(account=>account.role==='admin') }));this.api='https://api.github.com/repos/test-school/portal';this.issues=new Map();this.comments=new Map();this.calls=[];}
  async connect(){return {};}
  disconnect(){}
  async snapshot(){return {head:this.head,catalog:structuredClone(this.catalog)};}
  async commit(snapshot,catalog,files=[]){if(snapshot.head!==this.head){const e=new Error('conflict');e.code='CONFLICT';throw e;}this.catalog=structuredClone(catalog);this.head++;for(const file of files)this.files.set(file.path,file.binary?new Uint8Array(file.content):JSON.parse(file.content));return {head:this.head};}
  async readPublic(path){if(path===config.dataPath)return structuredClone(this.catalog);if(this.files.has(path))return structuredClone(this.files.get(path));const e=new Error('missing');e.code='NOT_FOUND';throw e;}
  async request(url){this.calls.push(url);if(url.includes('/contents/'))return this.readPublic(url.split('/contents/')[1].split('?')[0]);if(url.includes('/issues/comments/'))return this.comments.get(Number(url.split('/').at(-1)));return this.issues.get(Number(url.split('/').at(-1)));}
}
function createTestWorker(repository){
  let nextIssue=300;
  async function assertProof(payload,format,role,action){
    const {signature,...unsigned}=payload;
    const actor=repository.catalog.students.find(item=>item.id===payload.actorId);
    if(!actor||actor.disabled){const error=new Error('actor is not permitted');error.code='FORBIDDEN';throw error;}
    assert.equal(actor.role||'student',role);
    assert.equal(payload.scope,`SalehinSc:v4:${config.owner}/${config.repo}:${config.branch}:${config.dataPath}`);
    assert.equal(payload.format,format);
    if(action)assert.equal(payload.action,action);
    assert.equal(payload.actorRevision,credentialRevision(actor));
    assert.ok(await verify(unsigned,signature,actor.signingKey),'worker signature must verify');
    return actor;
  }
  return {
    async snapshot(payload){await assertProof(payload,'SalehinSc worker request','admin','snapshot');return repository.snapshot();},
    async commit(payload){
      const actor=await assertProof(payload,'SalehinSc admin commit','admin');
      assert.equal(repository.catalog.students.find(item=>item.id===actor.id)?.role,'admin');
      if(payload.expectedHead!==repository.head){const error=new Error('conflict');error.code='CONFLICT';throw error;}
      const files=(payload.files||[]).map(file=>({path:file.path,binary:file.path.endsWith('.bin'),content:file.encoding==='base64'?Buffer.from(file.content,'base64').toString(file.path.endsWith('.bin')?'binary':'utf8'):file.content}));
      for(const file of files)if(file.binary)file.content=Uint8Array.from(Buffer.from(file.content,'binary'));
      return repository.commit({head:payload.expectedHead},payload.catalog,files);
    },
    async stage(payload){
      const actor=await assertProof(payload.proof,'SalehinSc staging request','teacher');
      assert.equal(payload.proof.requestId.length,32);
      const issue=++nextIssue;repository.issues.set(issue,{body:JSON.stringify({format:'SalehinSc test staging',actor:actor.id})});
      return {issue,files:[]};
    },
    async submit(payload){
      await assertProof(payload.request,'SalehinSc signed request','teacher');
      repository.issues.set(payload.issue,{body:JSON.stringify(payload.request)});
      return {issue:payload.issue,status:'pending'};
    }
  };
}
async function fixture(){
  const adminLogin=generateLoginKey(), seed=await createBootstrap(config,{loginKey:adminLogin,password,name:'Test administrator'}), repository=new Repository(seed.catalog,seed.files), store=new Store(),worker=createTestWorker(repository);
  const admin=new RolePortal(config,{repository,store,worker});await admin.login(adminLogin,password);await admin.connectAdmin();
  const studentLogin=generateLoginKey(), studentAccount=await admin.createAccount({role:'student',loginKey:studentLogin,password,profile:{name:'Private student',grade:'7'}});
  const outsiderLogin=generateLoginKey(), outsiderAccount=await admin.createAccount({role:'student',loginKey:outsiderLogin,password,profile:{name:'Other student',grade:'8'}});
  const teacherLogin=generateLoginKey(), teacherAccount=await admin.createAccount({role:'teacher',loginKey:teacherLogin,password,profile:{name:'Private teacher',grade:'Teacher',subject:'Math'},assignedIds:[studentAccount.id]});
  repository.files.get('data/teachers/teacher.json').teachers.push({id:teacherAccount.id,kind:'teacher',active:true});
  const teacher=new RolePortal(config,{repository,store:new Store(),worker}),student=new RolePortal(config,{repository,store:new Store()}),outsider=new RolePortal(config,{repository,store:new Store()});
  await teacher.login(teacherLogin,password);await student.login(studentLogin,password);await outsider.login(outsiderLogin,password);
  return {admin,teacher,student,outsider,repository,adminLogin,studentLogin,teacherLogin,studentAccount,outsiderAccount,teacherAccount,store,worker};
}
async function requestFor(portal,prepared){const request={format:'SalehinSc signed request',version:1,scope:portal.scope,id:prepared.id,actorId:portal.account.id,actorRevision:credentialRevision(portal.account),createdAt:new Date().toISOString(),operation:'message',message:prepared.message,files:[]};request.signature=await sign(request,portal.dossier.identity.signingKey);return request;}
const input = id => ({title:'Secret announcement',category:'announcement',blocks:[{type:'text',text:'Private body'}],recipients:[id],files:[]});
test('bootstrap and role records hide credentials, identity keys and private names',async()=>{
  const f=await fixture();await f.admin.saveSite({schoolName:'School',schoolYear:'2026'});
  const text=JSON.stringify(f.repository.catalog);for(const secret of [password,f.adminLogin,f.studentLogin,f.teacherLogin,'Private student','Private teacher','publisherToken','\"d\":'])assert.ok(!text.includes(secret),secret);
  await f.teacher.refreshStudent();assert.equal(f.teacher.dossier.publisherToken,undefined);assert.equal(f.student.dossier.publisherToken,undefined);
  assert.deepEqual((await f.teacher.loadDirectory()).map(s=>s.id),[f.studentAccount.id]);
  const otherAdmin=new RolePortal(config,{repository:f.repository,store:new Store(),worker:f.worker});await otherAdmin.login(f.adminLogin,password);await otherAdmin.connectAdmin();assert.equal((await otherAdmin.loadDirectory()).length,4);
});
test('student QR export returns access keys for active students only',async()=>{
  const f=await fixture();
  const entries=await f.admin.exportQrCredentials();
  assert.equal(entries.length,2);
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  assert.equal(byId.get(f.studentAccount.id).name,'Private student');
  assert.equal(byId.get(f.outsiderAccount.id).name,'Other student');
  assert.equal(byId.has(f.teacherAccount.id),false);
  for(const entry of entries){
    assert.match(entry.key,/^[A-Za-z0-9_+/]{43}=$/);
    assert.equal(entry.role,'student');
  }
  assert.ok(!entries.some(entry=>entry.id===f.admin.account.id));
  assert.ok(!JSON.stringify(entries).includes(password));
});

test('shared staff roster can read one student record with independently stored scores and messages',async()=>{
  const f=await fixture();
  await f.admin.publishMessage({title:'Math quiz',category:'score',blocks:[{type:'text',text:'Good work'}],recipients:[f.studentAccount.id],files:[],score:{title:'Math quiz',score:18,total:20,feedback:'Good work'}});
  await f.admin.publishMessage({title:'Class note',category:'message',blocks:[{type:'text',text:'Bring your notebook.'}],recipients:[f.studentAccount.id],files:[]});
  const record=await f.admin.loadStudentRecord(f.studentAccount.id);
  assert.equal(record.profile.name,'Private student');
  assert.equal(record.scores.length,1);
  assert.equal(record.scores[0].score.score,18);
  assert.equal(record.messages.length,1);
  assert.equal(record.messages[0].title,'Class note');
  const other=await f.admin.loadStudentRecord(f.outsiderAccount.id);
  assert.equal(other.profile.name,'Other student');
  assert.equal(other.scores.length,0);
});

test('student QR rotation re-keys the dossier, revokes the old QR, and preserves encrypted history',async()=>{
  const f=await fixture();
  await f.admin.publishMessage({...input(f.studentAccount.id),title:'Before rotation'});
  await f.admin.publishMessage({title:'Earlier exam',category:'score',score:{title:'Earlier exam',score:17,total:20,feedback:'Well done'},blocks:[{type:'text',text:'Well done'}],recipients:[f.studentAccount.id],files:[]});
  const initial=await f.admin.exportQrCredentials();
  const studentQr=initial.find(item=>item.id===f.studentAccount.id);
  const otherQr=initial.find(item=>item.id===f.outsiderAccount.id);
  const vault=await f.admin.vault();
  const originalStudent=f.repository.catalog.students.find(item=>item.id===f.studentAccount.id);
  const oldRootKey=f.admin.adminKey(vault,f.studentAccount.id,originalStudent.auth.revision);
  const qrPortal=new RolePortal(config,{repository:f.repository,store:new Store()});
  const firstView=await qrPortal.loginWithQr(studentQr.id,studentQr.key,studentQr.revision);
  assert.equal(firstView.profile.name,'Private student');
  await assert.rejects(new RolePortal(config,{repository:f.repository,store:new Store()}).loginWithQr(otherQr.id,studentQr.key,studentQr.revision),{code:'QR_INVALID'});
  const replacement=await f.admin.rotateQr(f.studentAccount.id);
  const latest=f.repository.catalog.students.find(item=>item.id===f.studentAccount.id);
  await assert.rejects(f.admin.decodeStudent(latest,oldRootKey));
  await assert.rejects(qrPortal.refreshStudent(),{code:'SESSION_REVOKED'});
  await assert.rejects(new RolePortal(config,{repository:f.repository,store:new Store()}).loginWithQr(studentQr.id,studentQr.key,studentQr.revision),{code:'QR_INVALID'});
  const replacementPortal=new RolePortal(config,{repository:f.repository,store:new Store()});
  const after=await replacementPortal.loginWithQr(replacement.id,replacement.key,replacement.revision);
  assert.equal(after.profile.name,'Private student');
  const refreshed=await replacementPortal.refreshStudent();
  assert.equal(refreshed.messages.length,1);
  assert.equal(refreshed.messages[0].title,'Before rotation');
  assert.equal(refreshed.scores.length,1);
  assert.equal(refreshed.scores[0].score.score,17);
});

test('local teacher-file credential rotation re-keys the admin and keeps old message signatures readable',async()=>{
  const f=await fixture();
  await f.admin.publishMessage({...input(f.studentAccount.id),title:'Old admin announcement'});
  const oldRootKey=f.admin.session.key;
  const oldLocalCredential=await f.admin.rotateLocalTeacherAccess();
  const previousSigningKey=f.admin.account.signingKey;
  const replacement=await f.admin.rotateQr(f.admin.account.id);
  assert.notEqual(f.admin.session.key,oldRootKey);
  assert.notDeepEqual(f.admin.account.signingKey,previousSigningKey);
  await assert.rejects(f.admin.decodeStudent(f.admin.account,oldRootKey));
  await assert.rejects(new RolePortal(config,{repository:f.repository,store:new Store(),worker:f.worker}).loginWithQr(oldLocalCredential.id,oldLocalCredential.key,oldLocalCredential.revision),{code:'QR_INVALID'});
  await f.admin.publishMessage({...input(f.studentAccount.id),title:'New admin announcement'});
  const studentView=await f.student.refreshStudent();
  assert.deepEqual(studentView.messages.map(message=>message.title).sort(),['New admin announcement','Old admin announcement']);
  const qrAdmin=new RolePortal(config,{repository:f.repository,store:new Store(),worker:f.worker});
  const adminView=await qrAdmin.loginWithQr(replacement.id,replacement.key,replacement.revision);
  assert.equal(adminView.role,'admin');
  assert.equal(qrAdmin.admin,true);
});

test('first local teacher-file creation upgrades a legacy admin credential without losing the active session',async()=>{
  const f=await fixture();
  const previous=f.repository.catalog.students.find(item=>item.id===f.admin.account.id);
  const oldRootKey=f.admin.session.key;
  const oldFragment=require('../backend.js').makeQrFragment(previous.id,oldRootKey);
  delete previous.qrAccess;
  delete f.admin.account.qrAccess; // Model an administrator who signed in before QR grants existed.
  const entry=await f.admin.rotateLocalTeacherAccess();
  assert.notEqual(f.admin.session.key,oldRootKey);
  assert.ok(entry.revision);
  const latest=f.repository.catalog.students.find(item=>item.id===entry.id);
  await assert.rejects(f.admin.decodeStudent(latest,oldRootKey));
  const old=new RolePortal(config,{repository:f.repository,store:new Store(),worker:f.worker});
  const params=new URLSearchParams(oldFragment.slice(1));
  await assert.rejects(old.loginWithQr(params.get('s'),params.get('k')),{code:'QR_INVALID'});
  const current=new RolePortal(config,{repository:f.repository,store:new Store(),worker:f.worker});
  const view=await current.loginWithQr(entry.id,entry.key,entry.revision);
  assert.equal(view.role,'admin');
  assert.equal(current.admin,true);
});

test('last decrypted view survives a network outage as read-only local data',async()=>{
  const f=await fixture();
  await f.student.refreshStudent();
  f.repository.readPublic=async()=>{const error=new Error('offline');error.code='NETWORK';throw error;};
  const cached=await f.student.refreshStudent();
  assert.equal(cached.offline,true);
  assert.equal(cached.profile.name,'Private student');
  assert.equal(f.student.offline,true);
  await assert.rejects(f.student.makeMessage(input(f.studentAccount.id)),{code:'NETWORK'});
});
test('administrator connection is re-established through the signed Worker after reload',async()=>{
  const f=await fixture();
  assert.equal(await f.store.get('admin-github-token'),null);
  const reloaded=new RolePortal(config,{repository:f.repository,store:f.store,worker:f.worker});
  const view=await reloaded.refreshStudent();
  assert.equal(view.role,'admin');
  assert.equal(reloaded.admin,true);
});
test('role gates protect administration and teachers cannot target unassigned students',async()=>{
  const f=await fixture();await assert.rejects(f.teacher.connectAdmin('token'),{code:'FORBIDDEN'});await assert.rejects(f.student.createAccount({}),{code:'FORBIDDEN'});
  await assert.rejects(f.teacher.makeMessage(input(f.outsiderAccount.id)),{code:'FORBIDDEN'});
  await assert.rejects(f.admin.createAccount({role:'teacher',password,profile:{name:'Name'},assignedIds:['f'.repeat(64)]}));
  await assert.rejects(f.admin.updateAccount(f.admin.account.id,{disabled:true,expectedRevision:f.admin.studentRevision(f.admin.account)}));
});
test('publishing a new pinned message replaces the single active pinned message',async()=>{
  const f=await fixture();
  const first=await f.admin.publishMessage({...input(f.studentAccount.id),title:'First pinned message',pinned:true});
  const second=await f.admin.publishMessage({...input(f.studentAccount.id),title:'Second pinned message',pinned:true});
  assert.equal(f.repository.catalog.site.pinnedMessage,second.id);
  const view=await f.student.refreshStudent();
  assert.deepEqual(view.messages.filter(message=>message.pinned).map(message=>message.id),[second.id]);
  assert.ok(view.messages.some(message=>message.id===first.id&&!message.pinned));
});
test('teacher publishing workflow updates the same single active-pin pointer',async()=>{
  const f=await fixture();
  const prepared=await f.teacher.makeMessage({...input(f.studentAccount.id),title:'Teacher-pinned message',pinned:true});
  const request=await requestFor(f.teacher,prepared);
  f.repository.issues.set(11,{body:JSON.stringify(request)});
  const receipt=await publish({repository:f.repository,config,issueNumber:11});
  assert.equal(receipt.status,'published');
  assert.equal(f.repository.catalog.site.pinnedMessage,prepared.id);
  const view=await f.student.refreshStudent();
  assert.deepEqual(view.messages.filter(message=>message.pinned).map(message=>message.id),[prepared.id]);
});
test('teacher scores publish as a separate encrypted data/scores record',async()=>{
  const f=await fixture();
  const prepared=await f.teacher.makeMessage({title:'Math exam',category:'score',score:{title:'Math exam',score:18,total:20,feedback:'Good work'},blocks:[{type:'text',text:'Good work'}],recipients:[f.studentAccount.id],files:[]});
  const request=await requestFor(f.teacher,prepared);
  f.repository.issues.set(12,{body:JSON.stringify(request)});
  const receipt=await publish({repository:f.repository,config,issueNumber:12});
  assert.equal(receipt.status,'published');
  assert.ok(f.repository.files.has(`data/scores/${prepared.id}.json`));
  assert.ok(!f.repository.files.has(`data/messages/${prepared.id}.json`));
  assert.equal(f.repository.catalog.scores.length,1);
  const view=await f.student.refreshStudent();
  assert.equal(view.scores.length,1);
  assert.equal(view.scores[0].score.score,18);
  assert.equal(view.scores[0].score.total,20);
  assert.equal(view.messages.length,0);
  assert.equal((await f.outsider.refreshStudent()).scores.length,0);
});

test('admin publishes end-to-end encrypted inline arbitrary files; outsiders receive no message',async()=>{
  const f=await fixture();const bytes=new TextEncoder().encode('confidential worksheet');
  await f.admin.publishMessage({...input(f.studentAccount.id),blocks:[{type:'text',text:'Private body'},{type:'attachment',fileIndex:0}],files:[new File([bytes],'secret-worksheet.txt',{type:'text/plain'})]});
  const view=await f.student.refreshStudent();assert.equal(view.messages.length,1);assert.equal(view.messages[0].title,'Secret announcement');assert.equal((await f.outsider.refreshStudent()).messages.length,0);
  const descriptor=view.messages[0].attachments[0];assert.equal(descriptor.inline,false);assert.equal(await(await f.student.readFile(descriptor)).text(),'confidential worksheet');
  const remote=f.repository.files.get(descriptor.path);assert.notDeepEqual(remote,bytes);assert.ok(!JSON.stringify(f.repository.catalog).includes(descriptor.key));assert.ok(!JSON.stringify([...f.repository.files.values()]).includes('secret-worksheet.txt'));
  remote[0]^=1;await assert.rejects(f.student.readFile(descriptor),{code:'TAMPERED'});
});
test('workflow validates signatures and roles, checks chunks and publishes atomically and idempotently',async()=>{
  const f=await fixture();const prepared=await f.teacher.makeMessage({...input(f.studentAccount.id),files:[new File(['test file'],'test.html',{type:'text/html'})],blocks:[{type:'attachment',fileIndex:0}]});
  const request=await requestFor(f.teacher,prepared);const file=prepared.files[0];request.files=[{path:file.path,size:file.content.length,hash:await digest(file.content),chunks:[123]}];delete request.signature;request.signature=await sign(request,f.teacher.dossier.identity.signingKey);
  f.repository.issues.set(10,{body:JSON.stringify(request)});f.repository.comments.set(123,{issue_url:`${f.repository.api}/issues/10`,body:`salehin-chunk-v1:${C.base64(file.content)}`});
  const result=await publish({repository:f.repository,config,issueNumber:10});assert.equal(result.status,'published');assert.equal((await f.student.refreshStudent()).messages[0].title,'Secret announcement');assert.equal((await f.teacher.refreshStudent()).messages.length,1);
  const head=f.repository.head;await publish({repository:f.repository,config,issueNumber:10});assert.equal(f.repository.head,head);
  const tampered=structuredClone(request);tampered.message.pinned=true;await assert.rejects(validateRequest(tampered,f.repository.catalog,f.teacher.scope),{code:'FORBIDDEN'});
  const forged=structuredClone(request);forged.message.recipients.push({id:f.outsiderAccount.id});delete forged.message.signature;forged.message.signature=await sign(forged.message,f.teacher.dossier.identity.signingKey);delete forged.signature;forged.signature=await sign(forged,f.teacher.dossier.identity.signingKey);await assert.rejects(validateRequest(forged,f.repository.catalog,f.teacher.scope),{code:'FORBIDDEN'});
  f.repository.comments.get(123).body='salehin-chunk-v1:YWJjZA==';await assert.rejects(publish({repository:f.repository,config,issueNumber:10}),/hash/);
});
test('teacher profile changes are signed CAS requests and cannot change another account',async()=>{
  const f=await fixture();let staged;f.teacher.stageRequest=async operation=>{staged=operation;return {status:'pending'};};
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);await f.teacher.updateOwnProfile({name:'New teacher',subject:'Physics',title:'Teacher',avatarFile:new File([png],'avatar.png',{type:'image/png'})});
  const request={format:'SalehinSc signed request',version:1,scope:f.teacher.scope,id:'a'.repeat(32),actorId:f.teacher.account.id,actorRevision:credentialRevision(f.teacher.account),createdAt:new Date().toISOString(),...staged,files:[]};request.signature=await sign(request,f.teacher.dossier.identity.signingKey);
  assert.equal((await validateRequest(request,f.repository.catalog,f.teacher.scope)).id,f.teacher.account.id);
  const changed=structuredClone(request);changed.accountId=f.studentAccount.id;delete changed.signature;changed.signature=await sign(changed,f.teacher.dossier.identity.signingKey);await assert.rejects(validateRequest(changed,f.repository.catalog,f.teacher.scope),{code:'CONFLICT'});
  const row=f.repository.catalog.students.find(a=>a.id===f.teacher.account.id);row.payload=staged.payload;assert.equal((await f.teacher.refreshStudent()).profile.name,'New teacher');
});
test('password resets revoke sessions and disabled teachers lose publishing rights',async()=>{
  const f=await fixture();const prepared=await f.teacher.makeMessage(input(f.studentAccount.id)),request=await requestFor(f.teacher,prepared);
  let account=(await f.admin.loadDirectory()).find(a=>a.id===f.teacherAccount.id);await f.admin.resetAccountPassword(account.id,'replacement password 123',account.revision);await assert.rejects(f.teacher.refreshStudent(),{code:'SESSION_REVOKED'});await assert.rejects(validateRequest(request,f.repository.catalog,f.teacher.scope),{code:'FORBIDDEN'});
  await f.teacher.login(f.teacherLogin,'replacement password 123');account=(await f.admin.loadDirectory()).find(a=>a.id===f.teacherAccount.id);await f.admin.updateAccount(account.id,{disabled:true,expectedRevision:account.revision});await assert.rejects(f.teacher.makeMessage(input(f.studentAccount.id)),{code:'SESSION_REVOKED'});
});
test('ordinary portal commits do not rotate unchanged admin and teacher payloads',async()=>{
  const f=await fixture();
  const before=new Map(f.repository.catalog.students.map(account=>[account.id,f.admin.studentRevision(account)]));
  await f.admin.publishMessage(input(f.studentAccount.id));
  for(const account of f.repository.catalog.students){
    if(before.has(account.id))assert.equal(f.admin.studentRevision(account),before.get(account.id),`unchanged payload rotated for ${account.role}`);
  }
});

test('admin profile saves merge the latest remote dossier instead of failing on a stale tab',async()=>{
  const f=await fixture();
  const secondStore=new Store(),secondAdmin=new RolePortal(config,{repository:f.repository,store:secondStore,worker:f.worker});
  await secondAdmin.login(f.adminLogin,password);await secondAdmin.connectAdmin();
  await secondAdmin.updateOwnProfile({name:'Changed in another tab',title:'Principal',subject:'General'});
  await f.admin.updateOwnProfile({name:'Saved from this tab',title:'Administrator',subject:'School'});
  const view=await f.admin.refreshStudent();assert.equal(view.profile.name,'Saved from this tab');
});

test('teacher can queue multiple signed messages through the Worker without a local rate limit',async()=>{
  const f=await fixture();
  await f.teacher.publishMessage(input(f.studentAccount.id));
  await f.teacher.publishMessage({...input(f.studentAccount.id),title:'Second message'});
  const pending=await f.teacher.store.get('pending-publishes');
  assert.equal(pending.length,2);assert.notEqual(pending[0].id,pending[1].id);
});

test('checking an older pending receipt cannot erase a message queued in another tab',async()=>{
  const f=await fixture();
  await f.teacher.publishMessage(input(f.studentAccount.id));
  let finishReceipt;
  const readPublic=f.teacher.repository.readPublic.bind(f.teacher.repository);
  f.teacher.repository.readPublic=async path=>{
    if(path.startsWith('data/requests/')){
      await new Promise(resolve=>{finishReceipt=resolve;});
      const error=new Error('not published yet');error.code='NOT_FOUND';throw error;
    }
    return readPublic(path);
  };
  f.teacher._lastPendingWorkflowCheck=Date.now();
  const checkPending=f.teacher.pendingStatus();
  await new Promise(resolve=>setImmediate(resolve));
  await f.teacher.publishMessage({...input(f.studentAccount.id),title:'Queued during refresh'});
  finishReceipt();
  await checkPending;
  const pending=await f.teacher.store.get('pending-publishes');
  assert.equal(pending.length,2);
  assert.equal(new Set(pending.map(item=>item.id)).size,2);
});

test('deployed catalog keeps role records encrypted and scoped after real accounts are added',{skip:!fs.existsSync('data/portal.json')},()=>{
  const text=fs.readFileSync('data/portal.json','utf8'),catalog=JSON.parse(text);
  assert.ok(catalog.students.length>=1);assert.equal(catalog.students.filter(account=>account.role==='admin').length,1);
  assert.ok(catalog.students.every(account=>account.payloadRef?.path===`data/students/${account.id}.json`&&account.auth?.wrappedKey));
  assert.ok(!text.includes('AdminSrc'));assert.ok(!text.includes('"d":'));
  assert.ok(catalog.students.every(account=>account.auth.kdf.iterations>=600000));
  const scoped=/^SalehinSc:v4:([^/]+)\/([^:]+):([^:]+):(.+)$/.exec(catalog.scope);assert.ok(scoped,'catalog has a repository-scoped identity');
  const seedConfig={...globalThis.SALEHIN_CONFIG,owner:scoped[1],repo:scoped[2],branch:scoped[3],dataPath:scoped[4]};
  const portal=new RolePortal(seedConfig,{repository:new Repository(catalog),store:new Store()});assert.equal(catalog.scope,portal.scope);
});
test('missing repository administrator fails before preparing a new account and disconnects management',async()=>{
  const f=await fixture(),head=f.repository.head,keys=Object.keys((await f.admin.vault()).students).sort();
  f.repository.catalog.students=f.repository.catalog.students.filter(account=>account.id!==f.admin.account.id);
  await assert.rejects(f.admin.createAccount({role:'student',password,profile:{name:'Never created',grade:'7'}}),{code:'FORBIDDEN'});
  assert.equal(f.repository.head,head);assert.deepEqual(Object.keys((await f.admin.vault()).students).sort(),keys);
  await assert.rejects(f.admin.connectAdmin(),{code:'FORBIDDEN'});assert.equal(f.admin.admin,false);
});
test('administrator disabled in the repository cannot continue with a stale signed-in role',async()=>{
  const f=await fixture();f.repository.catalog.students.find(account=>account.id===f.admin.account.id).disabled=true;
  await assert.rejects(f.admin.saveSite({schoolName:'Cannot save',schoolYear:'2026'}),{code:'FORBIDDEN'});
});
