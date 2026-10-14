import {uid} from './engine.js';

export function generateStarterLibrary(){
 const make=(term,definition)=>({id:uid(),term,definition,notes:'',tags:[],starred:false,suspended:false,schedule:{}});
 return {version:1,settings:{newLimit:20,reviewLimit:200},history:[],records:{},decks:[{id:uid(),title:'Active Recall',description:'',color:'green',cards:[
  make('Active recall','Retrieving information from memory instead of rereading it.'),
  make('Spaced repetition','Reviewing material at increasing intervals to strengthen long-term memory.'),
  make('Interleaving','Mixing related topics during practice.'),
  make('Elaboration','Connecting new information to what you already know.'),
  make('Retrieval practice','Testing yourself to make a memory easier to retrieve later.'),
  make('Metacognition','Thinking about and monitoring your own learning.'),
  make('Mnemonic','A memorable cue that helps you recall information.'),
  make('Forgetting curve','The decline in memory retention over time without review.')
 ]}]};
}

const spanishPairs=new Map([['hola','hello'],['gracias','thank you'],['agua','water'],['libro','book'],['casa','house'],['verde','green'],['amigo','friend'],['mañana','tomorrow']]);
const deckFields=new Set(['id','title','description','color','cards']);
const cardFields=new Set(['id','term','definition','notes','tags','starred','suspended','schedule','buriedUntil','termImage','definitionImage','additionalInfo']);
const empty=v=>v===undefined||v==='';
function isLegacySpanish(deck){
 if(!deck||typeof deck.id!=='string'||deck.title!=='A little Spanish'||deck.description!=='A small starter set for Write, Spell, and Match.'||deck.color!==undefined&&deck.color!=='clay'||!Array.isArray(deck.cards)||deck.cards.length!==8)return false;
 if(Object.keys(deck).some(key=>!deckFields.has(key)))return false;
 const terms=new Set();
 for(const card of deck.cards){
  if(!card||spanishPairs.get(card.term)!==card.definition||terms.has(card.term))return false;
  if(Object.keys(card).some(key=>!cardFields.has(key)))return false;
  if(!['notes','termImage','definitionImage','additionalInfo'].every(key=>empty(card[key])))return false;
  if(card.tags!==undefined&&(!Array.isArray(card.tags)||card.tags.length))return false;
  terms.add(card.term);
 }
 return terms.size===8;
}

// Pure migration: only unchanged shipped examples retire; user edits stay visible.
// Archived snapshots remain part of the same exportable local library.
export function removeLegacySpanishStarter(library){
 if(!library||!Array.isArray(library.decks))return {library,changed:false};
 const legacy=library.decks.filter(isLegacySpanish);
 if(!legacy.length)return {library,changed:false};
 // Preserve an unrecognized custom archive format rather than overwriting it.
 if(library.retiredStarterDecks!==undefined&&!Array.isArray(library.retiredStarterDecks))return {library,changed:false};
 const next=structuredClone(library);
 next.retiredStarterDecks=next.retiredStarterDecks||[];
 for(const source of legacy){
  const deck=next.decks.find(d=>d.id===source.id);
  const history=(next.history||[]).filter(h=>h.deckId===deck.id);
  const records=Object.fromEntries(Object.entries(next.records||{}).filter(([key])=>key.startsWith(deck.id)&&!next.decks.some(other=>other.id!==deck.id&&other.id.length>deck.id.length&&key.startsWith(other.id))));
  const snapshot={reason:'legacy-spanish-starter',deck:structuredClone(deck),history:structuredClone(history),records:structuredClone(records)};
  if(Object.hasOwn(next.testDrafts||{},deck.id))snapshot.testDraft=structuredClone(next.testDrafts[deck.id]);
  if(Object.hasOwn(next.testConfigs||{},deck.id))snapshot.testConfig=structuredClone(next.testConfigs[deck.id]);
  // Idempotent snapshots; different later progress is preserved as another recovery snapshot.
  if(!next.retiredStarterDecks.some(saved=>JSON.stringify(saved)===JSON.stringify(snapshot)))next.retiredStarterDecks.push(snapshot);
  next.decks=next.decks.filter(d=>d.id!==deck.id);
  if(Array.isArray(next.history))next.history=next.history.filter(h=>h.deckId!==deck.id);
  if(next.testDrafts)delete next.testDrafts[deck.id];
  if(next.testConfigs)delete next.testConfigs[deck.id];
  if(next.records)for(const key of Object.keys(records))delete next.records[key];
 }
 return {library:next,changed:true};
}
