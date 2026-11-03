'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorizeTeacherDirectory } = require('../scripts/publish-request.cjs');
const primary='a'.repeat(64), teacher='b'.repeat(64);
const catalog={students:[{id:primary,role:'admin',disabled:false},{id:teacher,role:'teacher',disabled:false}]};
const directory={format:'SalehinSc teacher directory',version:1,primaryTeacherId:primary,teachers:[{id:primary,kind:'primary',active:true},{id:teacher,kind:'teacher',active:true}]};

test('publishing workflow accepts the active primary teacher and listed future teachers',()=>{
  assert.equal(authorizeTeacherDirectory({actorId:primary},catalog,directory).id,primary);
  assert.equal(authorizeTeacherDirectory({actorId:teacher},catalog,directory).id,teacher);
});

test('publishing workflow rejects accounts absent from or inactive in the teacher directory',()=>{
  assert.throws(()=>authorizeTeacherDirectory({actorId:teacher},catalog,{...directory,teachers:[directory.teachers[0]]}),/not listed/);
  const disabled={...directory,teachers:directory.teachers.map(entry=>entry.id===teacher?{...entry,active:false}:entry)};
  assert.throws(()=>authorizeTeacherDirectory({actorId:teacher},catalog,disabled),/not listed/);
  assert.throws(()=>authorizeTeacherDirectory({actorId:primary},catalog,{...directory,teachers:[{...directory.teachers[0],active:false},directory.teachers[1]]}),/primary teacher is not active/);
});
