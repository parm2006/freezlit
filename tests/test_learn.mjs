import assert from 'node:assert/strict';
import {startLearn,advanceLearn} from '../web/learn.js';
import {DAY,validateLibrary} from '../web/engine.js';
import {encodeLibrary,decodeLibrary} from '../web/storage.js';

const now=new Date(2026,10,17,12).getTime();
const cards=n=>Array.from({length:n},(_,i)=>({id:String(i),term:'Term '+i,definition:'Answer '+i,schedule:{}}));
const step=(s,ok=true)=>advanceLearn(s,ok);
function round(s){
 const seen=new Set(Object.keys(s.mastered));let attempts=0;
 while(s.phase==='batch'){assert.ok(attempts++<2000);seen.add(s.list[0].id);step(s)}
 assert.equal(s.phase,'consolidation');assert.equal(seen.size,s.cards.length);
 const check=new Set();
 while(s.phase==='consolidation'){assert.ok(attempts++<3000);check.add(s.list[0].id);step(s)}
 assert.equal(check.size,s.cards.length);assert.equal(s.phase,'batch');assert.ok(s.list.length);
 assert.equal(Object.keys(s.mastered).length,0);
}

// Every batch still requires two consecutive recalls before advancing.
const deck=cards(7),s=startLearn(deck,'forward',now);
assert.equal(s.phase,'batch');assert.equal(s.list.length,5);
for(let i=0;i<9;i++)step(s);
assert.equal(s.list.length,1);assert.equal(s.pending.length,2);
step(s);assert.deepEqual(s.list.map(c=>c.id),['5','6']);
for(let i=0;i<4;i++)step(s);
assert.equal(s.phase,'consolidation');assert.equal(s.list.length,7);
const missed=s.list[0];step(s,false);assert.equal(s.list[2],missed);
for(let i=0;i<7;i++)step(s);
assert.equal(s.phase,'batch');assert.deepEqual(s.list.map(c=>c.id),['0','1','2','3','4']);
round(s);round(s);

// A mistake resets only that card's streak and returns after two other cards.
const mistakes=startLearn(cards(6),'forward',now),first=mistakes.list[0];
for(let i=0;i<5;i++)step(mistakes);
assert.equal(mistakes.list[0],first);step(mistakes,false);
assert.equal(mistakes.mastered[first.id],0);assert.equal(mistakes.list[2],first);
step(mistakes);step(mistakes);step(mistakes);
assert.equal(mistakes.mastered[first.id],1);round(mistakes);

// All cards remain available even when the old scheduler says they are done or due later.
const scheduled=cards(250);
for(const c of scheduled){
 c.learnSchedule={forward:{box:3,due:now+7*DAY,startedAt:now,learnedAt:now,checkedAt:now}};
 c.schedule={forward:{state:'review',due:now+7*DAY,interval:7,ease:2.5,reps:4,lapses:0}};
}
const before=structuredClone(scheduled);
for(const direction of ['forward','reverse']){
 const large=startLearn(scheduled,direction,now);assert.equal(large.cards.length,250);
 round(large);round(large);
 assert.deepEqual(startLearn(scheduled,direction,now).list.map(c=>c.id),['0','1','2','3','4']);
}
assert.deepEqual(scheduled,before,'Learn does not change saved scheduling or card content');

// Explicit suspension and burial still exclude cards, and selections stay scoped.
const excluded=cards(4);excluded[0].suspended=true;excluded[1].buriedUntil=now+DAY;excluded[2].buriedUntil=now;
const filtered=startLearn(excluded,'forward',now);assert.deepEqual(filtered.cards.map(c=>c.id),['2','3']);round(filtered);
const subset=startLearn([scheduled[200]],'forward',now);round(subset);round(subset);assert.equal(subset.list[0].id,'200');
const empty=startLearn([],'forward',now);step(empty);assert.deepEqual(empty.list,[]);
const single=startLearn(cards(1),'forward',now);step(single,false);step(single);assert.equal(single.mastered['0'],1);step(single);
assert.equal(single.phase,'consolidation');step(single);assert.equal(single.phase,'batch');round(single);

const library={version:1,settings:{newLimit:7,reviewLimit:200},decks:[{id:'deck',title:'Deck',cards:scheduled}]};
assert.deepEqual(validateLibrary(decodeLibrary(encodeLibrary(library))).decks[0].cards,scheduled);
assert.throws(()=>validateLibrary({...library,decks:[{id:'bad',title:'Bad',cards:[{...scheduled[0],learnSchedule:{forward:{box:4,due:now}}}]}]}),/Learn scheduling/);
console.log('PASS continuous Learn batches, streaks, mistakes, repeated 250-card rounds, legacy schedules, directions, filters, and backup preservation');
