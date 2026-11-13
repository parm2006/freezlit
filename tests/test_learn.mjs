import assert from 'node:assert/strict';
import {startLearn,advanceLearn} from '../web/learn.js';
import {DAY,validateLibrary} from '../web/engine.js';
import {encodeLibrary,decodeLibrary} from '../web/storage.js';

const now=new Date(2026,10,13,12).getTime();
const cards=n=>Array.from({length:n},(_,i)=>({id:String(i),term:`Term ${i}`,definition:`Answer ${i}`,schedule:{}}));
const learn=(c,box,due=now)=>{c.learnSchedule={forward:{box,due}};return c};
const step=(s,ok=true,time=now)=>advanceLearn(s,ok,time);
function complete(s){let attempts=0;while(s.phase!=='done'){assert.ok(attempts++<500);step(s)}}

// A deck cannot spill into the next batch until every member has two recalls.
const deck=cards(12),s=startLearn(deck,'forward',7,now);
assert.equal(s.phase,'batch');assert.equal(s.list.length,5);
assert.ok(deck.slice(5).every(c=>!c.learnSchedule));
for(let i=0;i<9;i++)step(s);
assert.equal(s.phase,'batch');assert.equal(s.learned,0);
step(s);assert.equal(s.learned,5);assert.equal(s.list.length,2);
assert.ok(deck.slice(0,5).every(c=>c.learnSchedule.forward.box===1));
for(let i=0;i<4;i++)step(s);
assert.equal(s.phase,'consolidation');assert.equal(s.list.length,7);
const missed=s.list[0];step(s,false);assert.equal(s.list[2],missed);
complete(s);assert.equal(s.learned,7);
assert.ok(deck.slice(0,7).every(c=>c.learnSchedule.forward.due===now+DAY&&c.learnSchedule.forward.checkedAt===now));
assert.equal(startLearn(deck,'forward',7,now).phase,'done');
assert.equal(startLearn(deck,'reverse',7,now).list.length,5);

// A miss resets that card's streak and places it after two other cards.
const mistakes=startLearn(cards(6),'forward',6,now);
const first=mistakes.list[0];step(mistakes);for(let i=0;i<4;i++)step(mistakes);
assert.equal(mistakes.list[0],first);step(mistakes,false);
assert.equal(mistakes.mastered[first.id],0);assert.equal(mistakes.list[2],first);
step(mistakes);step(mistakes);step(mistakes);
assert.equal(mistakes.mastered[first.id],1);assert.equal(mistakes.learned,0);
complete(mistakes);

// Reviews always precede new material, with independent per-card due dates.
const reviews=cards(5);learn(reviews[0],1);learn(reviews[1],2);learn(reviews[2],3);learn(reviews[3],2,now+DAY);
const r=startLearn(reviews,'forward',20,now);
assert.equal(r.phase,'review');assert.equal(r.list.length,3);assert.equal(reviews[4].learnSchedule,undefined);
while(r.phase==='review'){const c=r.list[0],box=c.learnSchedule.forward.box;step(r,c.id!=='1');assert.equal(c.learnSchedule.forward.box,c.id==='1'?1:Math.min(3,box+1));assert.equal(c.learnSchedule.forward.due,now+(c.id==='1'?1:box===1?3:7)*DAY)}
assert.equal(r.phase,'batch');complete(r);
assert.equal(reviews[3].learnSchedule.forward.due,now+DAY);

// Daily limits survive restarts, including interrupted batches and final checks.
const resumeCards=cards(8),initial=startLearn(resumeCards,'forward',5,now);
step(initial);const resumed=startLearn(resumeCards,'forward',5,now);
assert.equal(resumed.list.length,5);assert.equal(resumed.pending.length,0);
for(let i=0;i<10;i++)step(resumed);
assert.equal(startLearn(resumeCards,'forward',5,now).phase,'consolidation');
complete(resumed);assert.equal(startLearn(resumeCards,'forward',5,now+DAY).phase,'review');
const subset=startLearn([resumeCards[5]],'forward',5,now,resumeCards);assert.equal(subset.phase,'done');

const overload=cards(43);for(const c of overload.slice(0,41))learn(c,1,now+DAY);
assert.equal(startLearn(overload,'forward',20,now).phase,'done');
const clearing=cards(42);for(const c of clearing.slice(0,41))learn(c,1);
const clear=startLearn(clearing,'forward',20,now);
for(let i=0;i<41;i++)step(clear);
assert.equal(clear.phase,'batch');assert.equal(clear.blocked,false);
const failing=cards(42);for(const c of failing.slice(0,41))learn(c,2);
const fail=startLearn(failing,'forward',20,now);
for(let i=0;i<41;i++)step(fail,false);
assert.equal(fail.phase,'done');assert.equal(fail.blocked,true);
const excluded=cards(3);excluded[0].suspended=true;excluded[1].buriedUntil=now+DAY;
assert.deepEqual(startLearn(excluded,'forward',20,now).list.map(c=>c.id),['2']);
assert.equal(startLearn(cards(2),'forward',0,now).phase,'done');
const single=startLearn(cards(1),'forward',20,now);step(single,false);step(single);assert.equal(single.learned,0);complete(single);

const library={version:1,settings:{newLimit:7,reviewLimit:200},decks:[{id:'deck',title:'Deck',cards:deck}]};
assert.deepEqual(validateLibrary(decodeLibrary(encodeLibrary(library))).decks[0].cards,deck);
assert.throws(()=>validateLibrary({...library,decks:[{id:'bad',title:'Bad',cards:[{...deck[0],learnSchedule:{forward:{box:4,due:now}}}]}]}),/Learn scheduling/);
console.log('PASS Learn batches, streaks, reviews, limits, resume, consolidation, and backup validation');
