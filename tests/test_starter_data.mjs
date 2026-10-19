import assert from 'node:assert/strict';
import {generateStarterLibrary,removeLegacyStarter} from '../web/starter-data.js';
import {validateLibrary} from '../web/engine.js';
let passed=0;
async function test(name,run){await run();passed++;console.log('PASS '+name)}
const archived=()=>({reason:'legacy-spanish-starter',deck:{id:'retired',cards:[{term:'Removed example',definition:'Example answer'}]},history:[{cardId:'old'}],records:{old:1},testDraft:{old:true}});
await test('Fresh installs contain exactly one eight-card Active Recall deck',()=>{
 const library=generateStarterLibrary();assert.equal(library.decks.length,1);assert.equal(library.decks[0].title,'Active Recall');assert.equal(library.decks[0].cards.length,8);
 assert.equal(library.decks[0].cards[0].term,'Active recall');assert.equal(library.decks[0].cards[7].term,'Forgetting curve');assert.equal(validateLibrary(library),library);
});
await test('Starter identities are unique and libraries are independent',()=>{
 const first=generateStarterLibrary(),second=generateStarterLibrary();assert.notEqual(first.decks[0].id,second.decks[0].id);assert.equal(new Set(first.decks[0].cards.map(c=>c.id)).size,8);
 first.decks[0].cards[0].term='Edited';assert.equal(second.decks[0].cards[0].term,'Active recall');
});
await test('Known retired demo archives are permanently removed without mutating input',async()=>{
 const library=generateStarterLibrary();library.retiredStarterDecks=[archived()];const before=structuredClone(library),result=await removeLegacyStarter(library);
 assert.ok(result.changed);assert.deepEqual(library,before);assert.equal('retiredStarterDecks' in result.library,false);assert.deepEqual(result.library.decks,before.decks);
});
await test('Unrelated archives and active progress are preserved',async()=>{
 const library=generateStarterLibrary(),custom={reason:'user-backup',deck:{id:'mine'}};library.retiredStarterDecks=[archived(),custom];library.history=[{deckId:library.decks[0].id,ok:true}];library.records={mine:'5 points'};
 const result=await removeLegacyStarter(library);assert.deepEqual(result.library.retiredStarterDecks,[custom]);assert.deepEqual(result.library.history,library.history);assert.deepEqual(result.library.records,library.records);
});
await test('Repeated cleanup is idempotent and creates no recovery archive',async()=>{
 const library=generateStarterLibrary();library.retiredStarterDecks=[archived()];const first=await removeLegacyStarter(library),second=await removeLegacyStarter(first.library);
 assert.equal(second.changed,false);assert.equal(second.library,first.library);assert.equal('retiredStarterDecks' in second.library,false);
});
await test('A saved empty library remains empty',async()=>{
 const library={version:1,decks:[],history:[],settings:{newLimit:20,reviewLimit:200},records:{}};const result=await removeLegacyStarter(library);assert.equal(result.changed,false);assert.equal(result.library,library);
});
await test('Archive cleanup also works without active decks',async()=>{
 const library={version:1,decks:[],retiredStarterDecks:[archived()]};const result=await removeLegacyStarter(library);assert.ok(result.changed);assert.deepEqual(result.library.decks,[]);assert.equal('retiredStarterDecks' in result.library,false);
});
await test('Unknown archive formats remain untouched',async()=>{
 const library=generateStarterLibrary();library.retiredStarterDecks={custom:true};const result=await removeLegacyStarter(library);assert.equal(result.changed,false);assert.equal(result.library,library);
});
await test('Unrelated eight-card decks do not match the retired fingerprint',async()=>{
 const library=generateStarterLibrary();library.decks[0].description='My course';const result=await removeLegacyStarter(library);assert.equal(result.changed,false);assert.equal(result.library,library);
});
await test('Card notes, tags, images and custom fields remain unchanged',async()=>{
 for(const edit of [{notes:'My note'},{tags:['course']},{termImage:'custom'},{additionalInfo:'context'},{customValue:1}]){
  const library=generateStarterLibrary();Object.assign(library.decks[0].cards[0],edit);const before=structuredClone(library),result=await removeLegacyStarter(library);assert.equal(result.changed,false);assert.deepEqual(result.library,before);
 }
});
console.log(`\n${passed} starter-data tests passed`);
