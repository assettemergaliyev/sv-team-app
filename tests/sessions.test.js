const assert=require('node:assert/strict'),S=require('../prototypes/sessions.js');const e=S.demo();
assert.equal(e.sessions.length,4);assert.equal(new Set(e.sessions.map(s=>s.date)).size,2);
assert.equal(S.leaderboard(e).length,2);assert.equal(S.leaderboard(e).find(r=>r.athlete==='a1').time,3420);
S.publish(e,'s2');assert.equal(S.leaderboard(e).length,2);assert.equal(S.leaderboard(e).find(r=>r.athlete==='a1').time,3310);assert.equal(S.leaderboard(e).find(r=>r.athlete==='a1').count,3);
S.publish(e,'s2');assert.equal(S.leaderboard(e).find(r=>r.athlete==='a1').count,3);assert.throws(()=>S.close(e));
S.publish(e,'s3');S.publish(e,'s4');assert.deepEqual(S.leaderboard(e).map(r=>r.rank),[1,2,2,4]);S.close(e);assert.equal(e.closed,true);assert.throws(()=>S.publish(e,'s1'));
const invalid=S.demo();invalid.sessions[1].entries[0].attempts=['00:69.00'];assert.throws(()=>S.publish(invalid,'s2'));assert.equal(invalid.sessions[1].published,false);
assert.equal(S.parse('99:01:01.00'),null);assert.equal(S.parse('99:01.00'),null);assert.equal(S.parse('00:00.00'),null);assert.equal(S.parse('00:33,10'),3310);assert.equal(S.format(3310),'00:33.10');
console.log('Session scenario checks passed: four sessions, two days, repeat athlete, drafts, ties, idempotent publication, closing and validation');

const fifth=S.demo();const added=S.addSession(fifth,{date:'2026-10-03',time:'08:00',group:'Плавание · дополнительно'});assert.equal(fifth.sessions.length,5);assert.equal(added.id,'s5');assert.equal(added.published,false);assert.equal(added.entries.length,0);assert.throws(()=>S.addSession(fifth,{date:'2026-10-03',time:'08:00',group:' '}));assert.equal(fifth.sessions.length,5);assert.throws(()=>S.addSession(fifth,{date:'2026-02-30',time:'08:00',group:'Группа'}));assert.throws(()=>S.addSession(fifth,{date:'2026-10-03',time:'24:00',group:'Группа'}));fifth.closed=true;assert.throws(()=>S.addSession(fifth,{date:'2026-10-03',time:'08:00',group:'Группа'}));console.log('Fifth-session creation and invalid input checks passed');
