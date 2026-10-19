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

// Only a one-way fingerprint remains for recognizing the removed stock deck.
const legacyFingerprint='c3e6a456f56ec5e03378db8858ddf8ad1fe4d693150d25f15589b6d6225c3963';
const deckFields=new Set(['id','title','description','color','cards']);
const cardFields=new Set(['id','term','definition','notes','tags','starred','suspended','schedule','buriedUntil','termImage','definitionImage','additionalInfo']);
async function isLegacyStarter(deck){
 if(!deck||typeof deck.id!=='string'||!Array.isArray(deck.cards)||deck.cards.length!==8||Object.keys(deck).some(key=>!deckFields.has(key)))return false;
 for(const card of deck.cards){
  if(!card||Object.keys(card).some(key=>!cardFields.has(key)))return false;
  if(['notes','termImage','definitionImage','additionalInfo'].some(key=>card[key]!==undefined&&card[key]!==''))return false;
  if(card.tags!==undefined&&(!Array.isArray(card.tags)||card.tags.length))return false;
 }
 const pairs=deck.cards.map(card=>[card.term,card.definition]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 const identity=JSON.stringify([deck.title,deck.description,deck.color===undefined?'clay':deck.color,pairs]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')===legacyFingerprint;
}

export async function removeLegacyStarter(library){
 if(!library||!Array.isArray(library.decks))return {library,changed:false};
 const matches=await Promise.all(library.decks.map(isLegacyStarter));
 const ids=new Set(library.decks.filter((_,i)=>matches[i]).map(deck=>deck.id));
 const archives=Array.isArray(library.retiredStarterDecks)?library.retiredStarterDecks.filter(item=>item?.reason!=='legacy-spanish-starter'):null;
 if(!ids.size&&(!archives||archives.length===library.retiredStarterDecks.length))return {library,changed:false};
 const next=structuredClone(library);
 next.decks=next.decks.filter(deck=>!ids.has(deck.id));
 if(Array.isArray(next.history))next.history=next.history.filter(entry=>!ids.has(entry.deckId));
 for(const id of ids){
  if(next.testDrafts)delete next.testDrafts[id];
  if(next.testConfigs)delete next.testConfigs[id];
  for(const key of Object.keys(next.records||{})){
   if(key.startsWith(id)&&!library.decks.some(other=>other.id!==id&&other.id.length>id.length&&key.startsWith(other.id)))delete next.records[key];
  }
 }
 if(archives){if(archives.length)next.retiredStarterDecks=structuredClone(archives);else delete next.retiredStarterDecks}
 return {library:next,changed:true};
}
