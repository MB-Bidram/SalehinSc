'use strict';
// One-time, lossless migration from inline encrypted profiles to per-student files.
// Run against a local checkout after making a Git backup of data/portal.json.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'data', 'portal.json');
const DRY_RUN = process.argv.includes('--dry-run');
const digest = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

async function main() {
  const catalog = JSON.parse(await fs.readFile(CATALOG, 'utf8'));
  if (catalog?.format !== 'SalehinSc portal' || !Array.isArray(catalog.students)) {
    throw new Error('data/portal.json is not a supported SalehinSc catalogue.');
  }

  const outputs = [];
  for (const student of catalog.students) {
    if (!/^[a-f0-9]{64}$/.test(student.id || '')) {
      throw new Error(`Student ${String(student.id || '(unknown)')} has an invalid ID. Nothing was changed.`);
    }
    const relative = `data/students/${student.id}.json`;
    const destination = path.join(ROOT, relative);
    if (student.payloadRef) {
      if (student.payloadRef.path !== relative || !/^[a-f0-9]{64}$/.test(student.payloadRef.revision || '')) {
        throw new Error(`Student ${student.id} has an invalid profile reference. Nothing was changed.`);
      }
      let existing;
      try { existing = JSON.parse(await fs.readFile(destination, 'utf8')); }
      catch { throw new Error(`Referenced student file is missing or unreadable: ${relative}`); }
      if (existing?.algorithm !== 'A256GCM' || digest(existing.ciphertext || '') !== student.payloadRef.revision) {
        throw new Error(`Referenced student file failed revision verification: ${relative}`);
      }
      continue;
    }
    if (student.payload?.algorithm !== 'A256GCM' || typeof student.payload.ciphertext !== 'string') {
      throw new Error(`Student ${student.id} has no valid encrypted profile. Nothing was changed.`);
    }
    try {
      const existing = JSON.parse(await fs.readFile(destination, 'utf8'));
      if (existing.ciphertext !== student.payload.ciphertext || existing.iv !== student.payload.iv) {
        throw new Error(`Refusing to overwrite a different existing file: ${relative}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    outputs.push({ student, destination, relative, envelope: student.payload, revision: digest(student.payload.ciphertext) });
  }

  if (DRY_RUN) {
    console.log(`Dry run: ${outputs.length} student file(s) would be created; catalogue unchanged.`);
    return;
  }

  // Write all encrypted profile files first. Only after they exist do we update the
  // catalogue pointers, so a partial interruption cannot publish dangling references.
  for (const item of outputs) {
    await fs.mkdir(path.dirname(item.destination), { recursive: true });
    const temp = `${item.destination}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(item.envelope)}\n`, { flag: 'wx' });
    await fs.rename(temp, item.destination);
  }
  for (const item of outputs) {
    item.student.payloadRef = { path: item.relative, revision: item.revision };
    delete item.student.payload;
  }
  const tempCatalog = `${CATALOG}.${process.pid}.tmp`;
  await fs.writeFile(tempCatalog, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
  await fs.rename(tempCatalog, CATALOG);
  console.log(`Migrated ${outputs.length} student record(s) into data/students/.`);
  console.log('Review the Git diff, then commit the catalogue and student files together.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
