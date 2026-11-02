'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RolePortal, createBootstrap, sign, credentialRevision } = require('../role-backend.js');
const { generateLoginKey } = require('../backend.js');
const workerModule = import('../worker/index.mjs');
const config = { owner:'test-school', repo:'portal', branch:'main', dataPath:'data/portal.json', apiVersion:'2026-03-10' };
const password = 'worker auth test password';
class Store { constructor(){this.values=new Map();} async get(k){return structuredClone(this.values.get(k)??null);} async set(k,v){this.values.set(k,structuredClone(v));} async delete(k){this.values.delete(k);} }
class Repository {
  constructor(seed){this.catalog=seed.catalog;this.files=new Map(seed.files.map(file=>[file.path,JSON.parse(file.content)]));}
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
test('Worker authorization accepts only a current signed admin QR proof',async()=>{
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
test('Worker authorization rejects non-admin roles for administrative routes',async()=>{
  const {portal,repository,cfg}=await setup();
  const {workerInternals}=await workerModule;
  const proof=request(portal);proof.signature=await sign(proof,portal.dossier.identity.signingKey);
  const downgraded=structuredClone(repository.catalog);
  downgraded.students[0].role='teacher';
  await assert.rejects(workerInternals.authorize(proof,downgraded,cfg,['admin'],'SalehinSc worker request','snapshot'));
});
test('Worker QR revision immediately invalidates a previously signed proof',async()=>{
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
