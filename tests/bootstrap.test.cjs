'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSeed, parseArgs, normalizeTarget } = require('../scripts/bootstrap-portal.cjs');

test('portable bootstrap creates a repo-scoped encrypted admin seed and emits no plaintext credentials in the catalog', async () => {
  const result = await createSeed({ owner: 'other-school', repo: 'school-portal', branch: 'main', name: 'New administrator' });
  assert.equal(result.catalog.scope, 'SalehinSc:v4:other-school/school-portal:main:data/portal.json');
  assert.equal(result.catalog.students.length, 1);
  assert.equal(result.catalog.students[0].role, 'admin');
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
