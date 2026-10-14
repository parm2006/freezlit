import assert from 'node:assert/strict';
import {generateStarterLibrary,removeLegacySpanishStarter} from '../web/starter-data.js';
import {validateLibrary} from '../web/engine.js';
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name)}
const pairs=[['hola','hello'],['gracias','thank you'],['agua','water'],['libro','book'],['casa','house'],['verde','green'],['amigo','friend'],['mañana','tomorrow']];
const spanish=()=>({id:'legacy',title:'A little Spanish',description:'A small starter set for Write, Spell, and Match.',color:'clay',cards:pairs.map(([term,definition],i)=>({id:'s'+i,term,definition,notes:'',tags:[],starred:false,suspended:false,schedule:{}}))});
const old=()=>({...generateStarterLibrary(),decks:[...generateStarterLibrary().decks,spanish()]});
test('Fresh installs contain exactly one eight-card Active Recall deck',()=>{
 const library=generateStarterLibrary();assert.equal(library.decks.length,1);assert.equal(library.decks[0].title,'Active Recall');assert.equal(library.decks[0].cards.length,8);
 assert.equal(library.decks[0].cards[0].term,'Active recall');assert.equal(library.decks[0].cards[7].term,'Forgetting curve');assert.equal(validateLibrary(library),library);
 const other=generateStarterLibrary();assert.notEqual(library.decks[0].id,other.decks[0].id);assert.equal(new Set(library.decks[0].cards.map(c=>c.id)).size,8);
});
test('Old stock retires with complete deck, scheduling, history, test and record snapshots',()=>{
 const library=old();const deck=library.decks[1];deck.cards[0].schedule={forward:{state:'review',interval:4,ease:2.5,reps:3,lapses:1,due:123456}};deck.cards[0].starred=true;
 library.history=[{deckId:'legacy',cardId:'s0',source:'review',at:123456},{deckId:library.decks[0].id,cardId:'other',source:'review',at:123}];
 library.testDrafts={legacy:{questions:[{cardId:'s0',input:'hello'}]},other:{keep:true}};library.testConfigs={legacy:{count:20,types:['written']},other:{count:4}};library.records={legacymatch:'15.3s',legacysprint:'2 points',othermatch:'4s'};
 const before=structuredClone(library);const result=removeLegacySpanishStarter(library);assert.ok(result.changed);assert.deepEqual(library,before);
 assert.equal(result.library.decks.length,1);assert.equal(result.library.retiredStarterDecks.length,1);
 const archive=result.library.retiredStarterDecks[0];assert.deepEqual(archive.deck,before.decks[1]);assert.deepEqual(archive.history,[before.history[0]]);assert.deepEqual(archive.testDraft,before.testDrafts.legacy);assert.deepEqual(archive.testConfig,before.testConfigs.legacy);assert.deepEqual(archive.records,{legacymatch:'15.3s',legacysprint:'2 points'});
 assert.deepEqual(result.library.history,[before.history[1]]);assert.deepEqual(result.library.testDrafts,{other:{keep:true}});assert.deepEqual(result.library.testConfigs,{other:{count:4}});assert.deepEqual(result.library.records,{othermatch:'4s'});
});
test('Any edited stock card content, note, tag, image or additional information stays visible',()=>{
 for(const edit of [{term:'Hola'},{definition:'greetings'},{notes:'My note'},{tags:['vocabulary']},{termImage:'image'},{definitionImage:'image'},{additionalInfo:'custom context'},{customValue:1}]){
  const library=old();Object.assign(library.decks[1].cards[0],edit);const result=removeLegacySpanishStarter(library);assert.equal(result.changed,false);assert.equal(result.library,library);assert.equal(library.decks.length,2);
 }
});
test('Spanish-titled custom decks and edited deck metadata stay visible',()=>{
 for(const edit of [{title:'Spanish'},{description:'My lessons'},{color:'green'},{customValue:'owned'}]){
  const library=old();Object.assign(library.decks[1],edit);assert.equal(removeLegacySpanishStarter(library).changed,false);
 }
 const library=old();library.decks[1].cards.pop();assert.equal(removeLegacySpanishStarter(library).changed,false);
});
test('Duplicate replacement card does not satisfy exact eight stock pairs',()=>{
 const library=old();library.decks[1].cards[7]={...library.decks[1].cards[0],id:'duplicate'};assert.equal(removeLegacySpanishStarter(library).changed,false);
});
test('Absent stock color can migrate, while exact card values are still required',()=>{
 const library=old();delete library.decks[1].color;assert.equal(removeLegacySpanishStarter(library).changed,true);
});
test('An intentionally empty library is never reseeded',()=>{
 const library={version:1,decks:[],history:[],settings:{newLimit:20,reviewLimit:200},records:{}};const result=removeLegacySpanishStarter(library);assert.equal(result.changed,false);assert.equal(result.library,library);assert.equal(result.library.decks.length,0);
 const onlySpanish={...library,decks:[spanish()]};const retired=removeLegacySpanishStarter(onlySpanish);assert.ok(retired.changed);assert.equal(retired.library.decks.length,0);assert.equal(retired.library.retiredStarterDecks.length,1);
});
test('Repeated migrations are idempotent and do not duplicate archive snapshots',()=>{
 const once=removeLegacySpanishStarter(old());const twice=removeLegacySpanishStarter(once.library);assert.equal(twice.changed,false);assert.equal(twice.library,once.library);assert.equal(twice.library.retiredStarterDecks.length,1);
 const restored=structuredClone(once.library);restored.decks.push(structuredClone(restored.retiredStarterDecks[0].deck));const rerun=removeLegacySpanishStarter(restored);assert.ok(rerun.changed);assert.equal(rerun.library.retiredStarterDecks.length,1);
});
test('Record keys belonging to another longer deck ID remain active',()=>{
 const library=old();library.decks.push({id:'legacy-other',title:'Custom',description:'',cards:[]});library.records={'legacymatch':'2s','legacy-othermatch':'3s'};
 const result=removeLegacySpanishStarter(library);assert.deepEqual(result.library.records,{'legacy-othermatch':'3s'});assert.deepEqual(result.library.retiredStarterDecks[0].records,{legacymatch:'2s'});
});
test('An unrecognized existing archive format is preserved untouched',()=>{
 const library=old();library.retiredStarterDecks={custom:true};assert.equal(removeLegacySpanishStarter(library).changed,false);assert.deepEqual(library.retiredStarterDecks,{custom:true});
});
console.log(`\n${passed} starter-data tests passed`);
