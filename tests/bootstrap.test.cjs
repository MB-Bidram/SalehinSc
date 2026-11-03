'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSeed, parseArgs, normalizeTarget } = require('../scripts/bootstrap-portal.cjs');
const { buildTeacherLauncherHtml } = require('../teacher-local.js');

test('portable bootstrap creates a repo-scoped encrypted admin seed and emits no plaintext credentials in the catalog', async () => {
  const result = await createSeed({ owner: 'other-school', repo: 'school-portal', branch: 'main', name: 'New administrator' });
  assert.equal(result.catalog.scope, 'SalehinSc:v4:other-school/school-portal:main:data/portal.json');
  assert.equal(result.catalog.students.length, 1);
  assert.equal(result.catalog.students[0].role, 'admin');
  assert.equal(result.teacherDirectory.format, 'SalehinSc teacher directory');
  assert.equal(result.teacherDirectory.primaryTeacherId, result.catalog.students[0].id);
  assert.deepEqual(result.teacherDirectory.teachers, [{ id: result.catalog.students[0].id, kind: 'primary', active: true }]);
  assert.equal(JSON.stringify(result.teacherDirectory).includes(result.qrFragment), false);
  const parts = /^#s=([a-f0-9]{64})&k=([A-Za-z0-9_-]{40,48})&r=([a-f0-9]{32})$/.exec(result.qrFragment);
  assert.ok(parts);
  const launcher = buildTeacherLauncherHtml({ appUrl: 'https://other-school.github.io/school-portal/', id: parts[1], key: parts[2], revision: parts[3] });
  assert.match(launcher, /school-portal\/#s=/);
  assert.ok(result.loginKey.length >= 8);
  assert.ok(result.password.length >= 24);
  const text = JSON.stringify(result.catalog);
  assert.ok(!text.includes(result.loginKey));
  assert.ok(!text.includes(result.password));
  assert.ok(!text.includes('New administrator'));
});

test('bootstrap arguments require explicit replacement for a copied seed and accept normal repository arguments', () => {
  assert.deepEqual(parseArgs(['--owner', 'owner', '--repo', 'repo', '--branch', 'main', '--replace-seed']), {
    replaceSeed: true, name: 'School administrator', owner: 'owner', repo: 'repo', branch: 'main'
  });
  assert.throws(() => parseArgs(['--owner']), /Missing value/);
  assert.throws(() => parseArgs(['--unsafe']), /Unknown option/);
});


test('bootstrap normalizes GitHub repository URLs and SSH remotes without binding to one account', () => {
  assert.deepEqual(normalizeTarget('MB-Bidram', 'https://github.com/MB-Bidram/Hamdars-SalehinSc'), {
    owner: 'MB-Bidram', repo: 'Hamdars-SalehinSc'
  });
  assert.deepEqual(normalizeTarget('another-school', 'git@github.com:another-school/school-portal.git'), {
    owner: 'another-school', repo: 'school-portal'
  });
  assert.deepEqual(normalizeTarget('another-school', 'another-school/school-portal'), {
    owner: 'another-school', repo: 'school-portal'
  });
  assert.throws(() => normalizeTarget('another-school', 'https://github.com/someone-else/school-portal'), /does not match/);
  assert.throws(() => normalizeTarget('owner', 'https://github.com/owner/repo/tree/main'), /repository URL/);
});
