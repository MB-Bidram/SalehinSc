'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Pages deployment is data-path filtered and follows the repository default branch', () => {
  const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  assert.match(workflow, /paths-ignore:\s*\n\s*- ['"]data\/\*\*['"]/);
  assert.match(workflow, /if:\s*github\.ref_name == github\.event\.repository\.default_branch/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /refs\/heads\/(?:main|master)/);
  assert.match(workflow, /--exclude='teacher\.html'/);
});

test('image downscaling keeps aspect ratio and never enlarges smaller images', () => {
  const source = fs.readFileSync('app.js', 'utf8');
  const helper = source.match(/const fitWithin=\(width,height,maxEdge=768\)=>\{[^\n]+\};/);
  assert.ok(helper, 'the shared dimension helper exists');
  const fitWithin = vm.runInNewContext(`${helper[0]}\nfitWithin`, {});
  assert.deepEqual(JSON.parse(JSON.stringify(fitWithin(1980, 1080))), { width: 768, height: 419, scale: 768 / 1980 });
  assert.deepEqual(JSON.parse(JSON.stringify(fitWithin(400, 1000))), { width: 307, height: 768, scale: 0.768 });
  assert.deepEqual(JSON.parse(JSON.stringify(fitWithin(400, 300))), { width: 400, height: 300, scale: 1 });
});

test('profile crop UI provides keyboard-accessible entry and zoom/drag controls', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(html, /id="profileAvatar"[^>]+tabindex="0"/);
  assert.match(html, /id="avatarCropDialog"/);
  assert.match(html, /id="cropZoom" type="range"/);
  assert.match(html, /id="applyAvatarCrop"/);
  assert.match(app, /addEventListener\('pointermove',event=>this\.moveCropDrag\(event\)\)/);
  assert.match(app, /async applyAvatarCrop\(\)/);
});
