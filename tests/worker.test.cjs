'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RolePortal, createBootstrap, sign, credentialRevision } = require('../role-backend.js');
const { createTeacherDirectory } = require('../scripts/bootstrap-portal.cjs');
const { generateLoginKey } = require('../backend.js');
const workerModule = import('../worker/index.mjs');
const config = { owner:'test-school', repo:'portal', branch:'main', dataPath:'data/portal.json', apiVersion:'2026-03-10' };
const password = 'worker auth test password';
class Store { constructor(){this.values=new Map();} async get(k){return structuredClone(this.values.get(k)??null);} async set(k,v){this.values.set(k,structuredClone(v));} async delete(k){this.values.delete(k);} }
class Repository {
  constructor(seed){this.catalog=seed.catalog;this.files=new Map(seed.files.map(file=>[file.path,JSON.parse(file.content)]));this.files.set('data/teachers/teacher.json',createTeacherDirectory(seed.catalog));}
  async connect(){return{};} disconnect(){}
  async readPublic(path){if(path===config.dataPath)return structuredClone(this.catalog);if(this.files.has(path))return structuredClone(this.files.get(path));const error=new Error('missing');error.code='NOT_FOUND';throw error;}
}
async function setup(){
  const loginKey=generateLoginKey();
  const seed=await createBootstrap(config,{loginKey,password,name:'Principal'});
  const repository=new Repository(seed);
  const portal=new RolePortal(config,{repository,store:new Store()});
  await portal.login(loginKey,password);
  const cfg={owner:config.owner,repo:config.repo,branch:config.branch,dataPath:config.dataPath,scope:portal.scope};
  return {portal,repository,cfg};
}
function request(portal,action='snapshot'){
  return {format:'SalehinSc worker request',version:1,action,scope:portal.scope,actorId:portal.account.id,actorRevision:credentialRevision(portal.account),createdAt:new Date().toISOString(),nonce:'test-nonce'};
}
test('Worker authorization accepts only a current signed primary-teacher credential proof',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const proof=request(portal);proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const actor=await workerInternals.authorize(proof,repository.catalog,cfg,['admin'],'SalehinSc worker request','snapshot');
  assert.equal(actor.id,portal.account.id);
  const tampered={...proof,actorRevision:'0'.repeat(32)};
  await assert.rejects(workerInternals.authorize(tampered,repository.catalog,cfg,['admin'],'SalehinSc worker request','snapshot'));
  const forged={...proof,action:'commit'};
  await assert.rejects(workerInternals.authorize(forged,repository.catalog,cfg,['admin'],'SalehinSc worker request','snapshot'));
});
test('Worker primary-teacher authorization requires the active teacher.json identity',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const proof=request(portal);proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const directory=repository.files.get('data/teachers/teacher.json');
  const accepted=await workerInternals.authorizePrimaryTeacher(proof,repository.catalog,directory,cfg,'SalehinSc worker request','snapshot');
  assert.equal(accepted.id,directory.primaryTeacherId);
  const inactive=structuredClone(directory);inactive.teachers[0].active=false;
  await assert.rejects(workerInternals.authorizePrimaryTeacher(proof,repository.catalog,inactive,cfg,'SalehinSc worker request','snapshot'));
  const mismatched=structuredClone(directory);mismatched.primaryTeacherId='f'.repeat(64);
  await assert.rejects(workerInternals.authorizePrimaryTeacher(proof,repository.catalog,mismatched,cfg,'SalehinSc worker request','snapshot'));
});

test('another admin-shaped account cannot act as the primary teacher',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const primary=repository.catalog.students[0];
  const other=structuredClone(primary);other.id='e'.repeat(64);repository.catalog.students.push(other);
  const proof={...request(portal),actorId:other.id};proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  await assert.rejects(workerInternals.authorizePrimaryTeacher(proof,repository.catalog,repository.files.get('data/teachers/teacher.json'),cfg,'SalehinSc worker request','snapshot'));
});


test('primary teacher is allowed through the signed attachment staging authorization path',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const proof={format:'SalehinSc staging request',version:1,scope:portal.scope,actorId:portal.account.id,actorRevision:credentialRevision(portal.account),createdAt:new Date().toISOString(),requestId:'a'.repeat(32),files:[]};
  proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const actor=await workerInternals.authorizeStaff(proof,repository.catalog,repository.files.get('data/teachers/teacher.json'),cfg,'SalehinSc staging request');
  assert.equal(actor.id,portal.account.id);
  const directory=structuredClone(repository.files.get('data/teachers/teacher.json'));
  directory.teachers[0].active=false;
  await assert.rejects(workerInternals.authorizeStaff(proof,repository.catalog,directory,cfg,'SalehinSc staging request'));
});


test('future teacher entry requires an explicit active teacher-directory entry',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const primary=repository.catalog.students[0];
  const teacher=structuredClone(primary);teacher.id='c'.repeat(64);teacher.role='teacher';teacher.qrAccess={...teacher.qrAccess,revision:'d'.repeat(32)};repository.catalog.students.push(teacher);
  const directory=structuredClone(repository.files.get('data/teachers/teacher.json'));
  directory.teachers.push({id:teacher.id,kind:'teacher',active:true});
  const proof={format:'SalehinSc worker request',version:1,action:'teacher-entry',scope:portal.scope,actorId:teacher.id,actorRevision:teacher.qrAccess.revision,createdAt:new Date().toISOString(),nonce:'future-teacher'};
  proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const allowed=await workerInternals.authorizeListedTeacher(proof,repository.catalog,directory,cfg,'SalehinSc worker request','teacher-entry');
  assert.equal(allowed.id,teacher.id);
  const removed=structuredClone(directory);removed.teachers.pop();
  await assert.rejects(workerInternals.authorizeListedTeacher(proof,repository.catalog,removed,cfg,'SalehinSc worker request','teacher-entry'));
});

test('Worker authorization rejects non-admin roles for administrative routes',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const proof=request(portal);proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const downgraded=structuredClone(repository.catalog);
  downgraded.students[0].role='teacher';
  await assert.rejects(workerInternals.authorize(proof,downgraded,cfg,['admin'],'SalehinSc worker request','snapshot'));
});
test('Rotating the private teacher-file revision immediately invalidates a previously signed proof',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const proof=request(portal);proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const account=repository.catalog.students[0];account.qrAccess.revision='f'.repeat(32);
  await assert.rejects(workerInternals.authorize(proof,repository.catalog,cfg,['admin'],'SalehinSc worker request','snapshot'));
});

test('teacher publishing dispatches the root workflow filename expected by GitHub',async()=>{
  const {workerInternals}=await workerModule;
  assert.equal(workerInternals.publishWorkflow,'portal-publish.yml');
});

test('connection test is signed, checks the configured repository and never returns credentials',async()=>{
  const {portal}=await setup();
  const proof=request(portal,'connection-test');
  proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const worker=(await workerModule).default;
  const originalFetch=global.fetch;
  const sha='a'.repeat(40);
  const repository={full_name:'test-school/portal',permissions:{push:true}};
  global.fetch=async input=>{
    const url=new URL(String(input));
    let value={};
    if(url.pathname.endsWith('/contents/data/portal.json')) value={encoding:'base64',content:Buffer.from(JSON.stringify(portal.catalog)).toString('base64')};
    else if(url.pathname.endsWith('/contents/data/teachers/teacher.json')) value={encoding:'base64',content:Buffer.from(JSON.stringify(createTeacherDirectory(portal.catalog))).toString('base64')};
    else if(url.pathname.endsWith('/git/ref/heads/main')) value={object:{sha}};
    else if(url.pathname==='/repos/test-school/portal') value=repository;
    else if(url.pathname.endsWith('/issues')) value=[];
    else if(url.pathname.endsWith('/actions/workflows/portal-publish.yml')) value={id:42,name:'Publish portal'};
    else throw new Error(`Unexpected GitHub API path: ${url.pathname}`);
    return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const env={GITHUB_REPOSITORY:'test-school/portal',GITHUB_BRANCH:'main',DATA_PATH:'data/portal.json',GITHUB_TOKEN:'token-value-that-is-never-returned',ALLOWED_ORIGIN:'https://test-school.github.io'};
    const response=await worker.fetch(new Request('https://worker.test/v1/connection-test',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(proof)}),env);
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.ok,true);
    assert.equal(result.repository,'test-school/portal');
    assert.equal(result.branch,'main');
    assert.equal(result.checks.tokenAccepted,true);
    assert.equal(result.checks.publishWorkflowReadable,true);
    assert.equal(JSON.stringify(result).includes(env.GITHUB_TOKEN),false);
  }finally{global.fetch=originalFetch;}
});

test('connection test rejects a non-primary-teacher credential proof',async()=>{
  const {portal,repository}=await setup();
  const {workerInternals}=await workerModule;
  const proof=request(portal,'connection-test');
  proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const modified=structuredClone(repository.catalog);
  modified.students[0].role='teacher';
  await assert.rejects(workerInternals.authorize(proof,modified,{...portal.config,scope:portal.scope},['admin'],'SalehinSc worker request','connection-test'));
});


test('Worker catalogue validation accepts the actual 32-character auth revision format',async()=>{
  const {portal}=await setup();
  const {workerInternals}=await workerModule;
  assert.equal(portal.account.auth.revision.length,32);
  assert.equal(workerInternals.validateCatalog(portal.catalog,portal.scope),undefined);
  const invalid=structuredClone(portal.catalog);
  invalid.students[0].auth.revision='f'.repeat(64);
  assert.throws(()=>workerInternals.validateCatalog(invalid,portal.scope));
});
