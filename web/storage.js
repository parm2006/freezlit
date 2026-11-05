import {flattenLibrary,diffRecords} from './storage-delta.js';
import {prepareImages,portableLibrary} from './media.js';
// The same study UI uses a native Mac bridge or the Windows localhost service.
import {validImage,uid} from './engine.js';
function bridge(){return globalThis.window?.webkit?.messageHandlers?.freezlit}
export function isNativeApp(){return typeof bridge()?.postMessage==='function'}
async function native(action,payload={}){return await bridge().postMessage({action,...payload})}
let revision;
let savedRecords=new Map(),pendingSave=null;
const imageFields=['termImage','definitionImage','promptImage','answerImage'];
function visitImages(library,visit){
 const cards=deck=>{for(const card of deck?.cards||[])for(const field of imageFields.slice(0,2))if(card[field])visit(card,field)};
 for(const deck of library.decks||[])cards(deck);
 for(const test of Object.values(library.testDrafts||{}))for(const question of test.questions||[])for(const field of imageFields.slice(2))if(question[field])visit(question,field);
 for(const draft of Object.values(library.editorDrafts||{}))cards(draft.deck);
}
export function encodeLibrary(library){
 if(!library||library.version!==1)throw Error('Unsupported library version.');
 const media=Object.create(null),ids=new Map();
 const encodeImages=(object,fields)=>{
  const copy={...object};
  for(const field of fields)if(copy[field]){
   const image=copy[field];let id=ids.get(image);
   if(id===undefined){if(!validImage(image))throw Error('Invalid embedded image.');id='m'+ids.size;ids.set(image,id);media[id]=image}
   copy[field]={mediaId:id};
  }
  return copy;
 };
 const encodeDeck=deck=>({...deck,cards:deck.cards?.map(card=>encodeImages(card,imageFields.slice(0,2)))});
 // Remove image strings before cloning the snapshot, so each original is stored only once.
 const encoded=structuredClone({...library,
  decks:library.decks?.map(encodeDeck),
  ...(library.testDrafts?{testDrafts:Object.fromEntries(Object.entries(library.testDrafts).map(([id,test])=>[id,{...test,questions:test.questions?.map(q=>encodeImages(q,imageFields.slice(2)))}]))}:{}),
  ...(library.editorDrafts?{editorDrafts:library.editorDrafts.map(draft=>({...draft,deck:encodeDeck(draft.deck)}))}:{})
 });
 encoded.version=2;encoded.media=media;return encoded;
}
export class IncompatibleLibrary extends Error {
 constructor(decks){
  super('This library contains decks that require a newer version of Freezlit.');
  this.decks=decks;
 }
}
export function decodeLibrary(library){
 const newer=Number.isInteger(library?.version)&&library.version>2;
 if(Array.isArray(library?.decks)){
  const decks=library.decks.map(deck=>({
   title:typeof deck?.title==='string'&&deck.title.trim()?deck.title:'Untitled deck',
   incompatible:newer||(Number.isInteger(deck?.deckFormatVersion)&&deck.deckFormatVersion>1)
  }));
  if(decks.some(deck=>deck.incompatible)||newer)throw new IncompatibleLibrary(decks);
 }
 if(library===null||library?.version===1)return library;
 if(library?.version!==2||!library.media||typeof library.media!=='object'||Array.isArray(library.media))throw Error('Unsupported or invalid library format.');
 for(const image of Object.values(library.media))if(!validImage(image))throw Error('Invalid embedded image.');
 const decoded=structuredClone(library);
 visitImages(decoded,(object,field)=>{const ref=object[field];if(!ref||typeof ref!=='object'||Object.keys(ref).length!==1||typeof ref.mediaId!=='string'||!Object.hasOwn(library.media,ref.mediaId))throw Error('Missing or invalid image reference.');object[field]=library.media[ref.mediaId]});
 decoded.version=1;delete decoded.media;return decoded;
}
export class StorageConflict extends Error {constructor(){super('This save is based on an older library version. Your edits are still in this window; export a backup before reloading.');this.name='StorageConflict';this.code='conflict'}}
export async function readLibrary(){
 if(isNativeApp()){const result=await native('load');if(result&&Object.hasOwn(result,'library')){revision=result.revision;return decodeLibrary(result.library)}revision=undefined;return decodeLibrary(result)}
 const r=await fetch('/api/state');if(!r.ok)throw Error('Cannot read your saved library.');const result=await r.json();revision=r.headers?.get('ETag')??'0';const decoded=decodeLibrary(result);savedRecords=flattenLibrary(decoded);pendingSave=null;return decoded;
}
export async function writeLibrary(library){
 if(isNativeApp()){const encoded=encodeLibrary(library);const result=await native('save',{library:encoded,expectedRevision:revision??'empty'});if(result?.code==='conflict')throw new StorageConflict();if(result?.ok===false)throw Error(result.error||'Cannot save your library.');revision=result?.revision;return}
 // Retry the exact previous operation before accepting newer edits: its response may have been lost after commit.
 if(pendingSave)await confirmPendingSave();
 await prepareImages(library);
 const records=flattenLibrary(library),changes=diffRecords(savedRecords,records);
 if(!changes.set.length&&!changes.remove.length)return;
 pendingSave={records,revision:revision??'0',body:JSON.stringify({...changes,requestId:uid()})};
 await confirmPendingSave();
}
async function confirmPendingSave(){
 const pending=pendingSave;
 const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':pending.revision},body:pending.body});
 if(r.status===409)throw new StorageConflict();
 if(!r.ok){
  if([400,413,415,428].includes(r.status))pendingSave=null;
  let message='Storage unavailable';try{message=(await r.json()).error||message}catch{}throw Error(message);
 }
 const result=typeof r.json==='function'?await r.json():{};
 revision=r.headers?.get('ETag')??result.revision??revision;savedRecords=pending.records;pendingSave=null;
}
export async function exportLibrary(library,name){
 const encoded=encodeLibrary(await portableLibrary(library));
 if(isNativeApp())return await native('export',{library:encoded,name});
 const blob=new Blob([JSON.stringify(encoded)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// snapshot is called only when a write starts, not on every keystroke.
export function createSaveCoordinator({snapshot,write=writeLibrary,onState=()=>{},delay=800,maxWait=5000}){
 let generation=0,saved=0,timer=null,maxTimer=null,inFlight=null,error=null;
 const state=()=>({dirty:generation!==saved,pending:!!timer||!!inFlight,error});
 const emit=()=>onState(state());
 function start(){
  if(inFlight)return inFlight;if(saved===generation)return Promise.resolve(true);
  const target=generation;
  inFlight=Promise.resolve().then(()=>write(snapshot())).then(()=>{saved=target;error=null;return true},failure=>{error=failure;return false}).finally(()=>{inFlight=null;emit()});emit();return inFlight;
 }
 async function flush(){
  clearTimeout(timer);timer=null;clearTimeout(maxTimer);maxTimer=null;
  while(saved!==generation||inFlight){if(!await start())return false;clearTimeout(timer);timer=null}
  emit();return true;
 }
 function request(){generation++;error=null;clearTimeout(timer);timer=setTimeout(()=>{timer=null;void flush()},delay);if(!maxTimer)maxTimer=setTimeout(()=>{maxTimer=null;void flush()},maxWait);emit()}
 return {request,flush,get state(){return state()}};
}
export async function speakText(text,language='en-US'){
 if(isNativeApp())return await native('speak',{text,language});
 const synth=globalThis.window?.speechSynthesis;if(!synth)throw Error('Speech is unavailable on this device.');
 synth.cancel();const voice=new globalThis.window.SpeechSynthesisUtterance(text);voice.lang=language;voice.rate=.9;synth.speak(voice);
}
export function stopSpeech(){
 if(isNativeApp()){Promise.resolve(native('cancelSpeech')).catch(()=>{});return}
 globalThis.window?.speechSynthesis?.cancel();
}
