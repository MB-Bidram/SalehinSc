'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateTarget, pagesUrl, updateWrangler, setMeta, setTitle, updateBrandAssets } = require('../scripts/setup-salehinsc.cjs');

test('setup validates different GitHub owners, repositories and branch names',()=>{
  assert.deepEqual(validateTarget('another-school','Science_Portal','release/2027'),{owner:'another-school',repo:'Science_Portal',branch:'release/2027'});
  assert.throws(()=>validateTarget('bad owner','portal','main'));
  assert.throws(()=>validateTarget('school','../portal','main'));
  assert.throws(()=>validateTarget('school','portal','release//main'));
});

test('Pages URLs include the repository path and handle user-site repositories',()=>{
  assert.equal(pagesUrl('another-school','SciencePortal'),'https://another-school.github.io/SciencePortal/');
  assert.equal(pagesUrl('another-school','another-school.github.io'),'https://another-school.github.io/');
});

test('wrangler updates repository, branch and origin without deleting unrelated configuration',()=>{
  const before='name = "salehinsc-api"\nmain = "worker/index.mjs"\n\n[vars]\nGITHUB_REPOSITORY = "old/repo"\nGITHUB_BRANCH = "main"\nDATA_PATH = "data/portal.json"\nALLOWED_ORIGIN = "https://old.github.io"\n';
  const after=updateWrangler(before,{owner:'new-school',repo:'Portal2',branch:'production'},'https://new-school.github.io');
  assert.ok(after.includes('GITHUB_REPOSITORY = "new-school/Portal2"'));
  assert.ok(after.includes('GITHUB_BRANCH = "production"'));
  assert.ok(after.includes('ALLOWED_ORIGIN = "https://new-school.github.io"'));
  assert.ok(after.includes('DATA_PATH = "data/portal.json"'));
  assert.ok(after.includes('main = "worker/index.mjs"'));
});

test('HTML metadata is updated without putting secrets in public config',()=>{
  let html='<!doctype html><html><head><meta name="salehin-api" content=""><title>Old</title></head></html>';
  html=setMeta(html,'salehin-repository','org/project');
  html=setMeta(html,'salehin-branch','release');
  html=setMeta(html,'salehin-school-name','School & Academy');
  html=setMeta(html,'salehin-api','https://worker.example.workers.dev');
  html=setTitle(html,'School & Academy');
  assert.match(html,/salehin-repository" content="org\/project"/);
  assert.match(html,/salehin-api" content="https:\/\/worker\.example\.workers\.dev"/);
  assert.match(html,/<title>School &amp; Academy \| سامانه مدرسه<\/title>/);
  assert.doesNotMatch(html,/GITHUB_TOKEN|ghp_[A-Za-z0-9]+/);
});

test('logo importer preserves source bytes and installs both original variants when available',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'salehin-logos-'));
  try{
    fs.mkdirSync(path.join(root,'assets'),{recursive:true});
    fs.writeFileSync(path.join(root,'Salehin-Noback.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
    fs.writeFileSync(path.join(root,'Salehin-NobackText.png'),Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const result=updateBrandAssets(root,'<head></head><img id="modernBrandLogo" alt="" hidden><img id="modernBrandLogoFull" class="modern-brand-full" alt="" hidden><p class="eyebrow" id="modernGateBrandFallback">مدرسه صالحین</p><span id="modernBrandFallback">ص</span>');
    assert.equal(result.manifest['Salehin-Noback'],'assets/salehin-logo-mark.svg');
    assert.equal(result.manifest['Salehin-NobackText'],'assets/salehin-logo-full.png');
    assert.ok(fs.existsSync(path.join(root,'assets','salehin-logo-mark.svg')));
    assert.ok(fs.existsSync(path.join(root,'assets','salehin-logo-full.png')));
    assert.match(result.html,/salehin-logo-mark\.svg/);
    assert.match(result.html,/salehin-logo-full\.png/);
    assert.match(result.html,/modernBrandFallback" hidden/);
    assert.match(result.html,/modernGateBrandFallback" hidden/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
