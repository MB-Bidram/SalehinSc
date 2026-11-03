'use strict';
// Create the public primary-teacher identity directory for an already bootstrapped v4 school.
// This file contains only a public account ID and status; it never extracts QR or dossier keys.
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'portal.json');
const TEACHER_PATH = path.join(ROOT, 'data', 'teachers', 'teacher.json');

function createDirectory(catalog) {
  if (!catalog || catalog.format !== 'SalehinSc portal' || catalog.version !== 4 || !Array.isArray(catalog.students)) {
    throw new Error('data/portal.json is not a valid SalehinSc v4 catalogue.');
  }
  const accounts = catalog.students.filter(account => account?.role === 'admin');
  if (accounts.length !== 1 || accounts[0].disabled || !/^[a-f0-9]{64}$/.test(accounts[0].id || '')) {
    throw new Error('Expected exactly one active primary administrator account. Existing records were not changed.');
  }
  const teachers = catalog.students
    .filter(account => account?.role === 'teacher' && /^[a-f0-9]{64}$/.test(account.id || ''))
    .map(account => ({ id: account.id, kind: 'teacher', active: false }));
  return {
    format: 'SalehinSc teacher directory',
    version: 1,
    primaryTeacherId: accounts[0].id,
    teachers: [{ id: accounts[0].id, kind: 'primary', active: true }, ...teachers],
    updatedAt: new Date().toISOString()
  };
}

async function main(argv = process.argv.slice(2)) {
  const replace = argv.includes('--replace');
  if (argv.some(arg => arg !== '--replace')) throw new Error('Usage: npm run migrate:primary-teacher [-- --replace]');
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  const directory = createDirectory(catalog);
  let current = null;
  try { current = JSON.parse(await fs.readFile(TEACHER_PATH, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current) {
    if (current.primaryTeacherId === directory.primaryTeacherId && current.format === directory.format && current.version === directory.version) {
      console.log('Primary-teacher directory already matches this school. No changes made.');
      return;
    }
    if (!replace) throw new Error('A different teacher directory already exists. Review it; use --replace only when intentionally changing the primary teacher.');
  }
  await fs.mkdir(path.dirname(TEACHER_PATH), { recursive: true });
  const temporary = `${TEACHER_PATH}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(directory, null, 2)}\n`, { flag: 'wx' });
  await fs.rename(temporary, TEACHER_PATH);
  console.log('Created data/teachers/teacher.json. It contains no QR credential or private key.');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createDirectory, main };
