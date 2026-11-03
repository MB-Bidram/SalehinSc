#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function cleanupRetiredTeacherQr(root = path.resolve(__dirname, '..')) {
  const retiredFiles = [
    'teacher/index.html',
    'tools/staff-qr-maker.html'
  ];
  let removed = 0;

  for (const relative of retiredFiles) {
    const target = path.join(root, relative);
    let stat;
    try { stat = fs.lstatSync(target); }
    catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) {
      throw new Error(`Refusing to remove non-file legacy path: ${relative}`);
    }
    fs.unlinkSync(target);
    console.log(`Removed retired teacher QR artifact: ${relative}`);
    removed++;
  }

  // Remove only empty retired folders. Other tools or files are preserved.
  for (const relative of ['teacher', 'tools']) {
    const directory = path.join(root, relative);
    try { fs.rmdirSync(directory); }
    catch (error) {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
    }
  }

  return removed;
}

if (require.main === module) {
  const removed = cleanupRetiredTeacherQr();
  console.log(removed ? `Removed ${removed} retired artifact(s).` : 'No retired teacher QR artifacts found.');
}

module.exports = { cleanupRetiredTeacherQr };
