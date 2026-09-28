import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {dumpSql,SEED_TABLES} from '../tools/platform/export-sql.mjs';

test('seed SQL for D1 restores the whole graph and search index into a freshly migrated database',{skip:!sqliteAvailable},async()=>{
 const a=D1Shim.migrated();await seedDatabase(a,undefined,Date.UTC(2026,8,26));
 const sql=dumpSql(a);
 assert(!/INSERT INTO (users|discussions|comments|community_reports)\b/.test(sql),'never user content');
 const b=D1Shim.migrated();b.raw.exec(sql);
 for(const t of [...SEED_TABLES,'search_docs'])assert.equal(b.raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n,a.raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n,t);
 b.raw.exec(sql);
 assert.equal(b.raw.prepare('SELECT COUNT(*) n FROM entities').get().n,a.raw.prepare('SELECT COUNT(*) n FROM entities').get().n,'re-running adds nothing');
});
