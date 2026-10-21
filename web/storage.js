// The same study UI uses a native Mac bridge or the Windows localhost service.
import {validImage} from './engine.js';
function bridge(){return globalThis.window?.webkit?.messageHandlers?.freezlit}
export function isNativeApp(){return typeof bridge()?.postMessage==='function'}
async function native(action,payload={}){return await bridge().postMessage({action,...payload})}
let revision;
const imageFields=['termImage','definitionImage','promptImage','answerImage'];
function visitImages(library,visit){
 const cards=deck=>{for(const card of deck?.cards||[])for(const field of imageFields.slice(0,2))if(card[field])visit(card,field)};
 for(const deck of library.decks||[])cards(deck);
 for(const test of Object.values(library.testDrafts||{}))for(const question of test.questions||[])for(const field of imageFields.slice(2))if(question[field])visit(question,field);
 for(const draft of Object.values(library.editorDrafts||{}))cards(draft.deck);
}
export function encodeLibrary(library){
 if(!library||library.version!==1)throw Error('Unsupported library version.');
 const encoded=structuredClone(library),media=Object.create(null),ids=new Map();
 visitImages(encoded,(object,field)=>{const image=object[field];if(!validImage(image))throw Error('Invalid embedded image.');let id=ids.get(image);if(id===undefined){id='m'+ids.size;ids.set(image,id);media[id]=image}object[field]={mediaId:id}});
 encoded.version=2;encoded.media=media;return encoded;
}
export function decodeLibrary(library){
 if(library===null||library?.version===1)return library;
 if(library?.version!==2||!library.media||typeof library.media!=='object'||Array.isArray(library.media))throw Error('Unsupported or invalid library format.');
 for(const image of Object.values(library.media))if(!validImage(image))throw Error('Invalid embedded image.');
 const decoded=structuredClone(library);
 visitImages(decoded,(object,field)=>{const ref=object[field];if(!ref||typeof ref!=='object'||Object.keys(ref).length!==1||typeof ref.mediaId!=='string'||!Object.hasOwn(library.media,ref.mediaId))throw Error('Missing or invalid image reference.');object[field]=library.media[ref.mediaId]});
 decoded.version=1;delete decoded.media;return decoded;
}
export class StorageConflict extends Error {constructor(){super('This library changed in another window. Export your changes before reloading.');this.name='StorageConflict';this.code='conflict'}}
export async function readLibrary(){
 if(isNativeApp()){const result=await native('load');if(result&&Object.hasOwn(result,'library')){revision=result.revision;return decodeLibrary(result.library)}revision=undefined;return decodeLibrary(result)}
 const r=await fetch('/api/library');if(!r.ok)throw Error('Cannot read your saved library.');const result=await r.json();revision=r.headers?.get('ETag')??undefined;return decodeLibrary(result);
}
export async function writeLibrary(library){
 const encoded=encodeLibrary(library);
 if(isNativeApp()){const result=await native('save',{library:encoded,expectedRevision:revision??'empty'});if(result?.code==='conflict')throw new StorageConflict();if(result?.ok===false)throw Error(result.error||'Cannot save your library.');revision=result?.revision;return}
 const headers={'Content-Type':'application/json','If-Match':revision??'"empty"'};
 const r=await fetch('/api/library',{method:'PUT',headers,body:JSON.stringify(encoded)});
 if(r.status===409)throw new StorageConflict();
 if(!r.ok){let message='Storage unavailable';try{message=(await r.json()).error||message}catch{}throw Error(message)}
 revision=r.headers?.get('ETag')??undefined;
}
export async function exportLibrary(library,name){
 const encoded=encodeLibrary(library);
 if(isNativeApp())return await native('export',{library:encoded,name});
 const blob=new Blob([JSON.stringify(encoded)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// snapshot is called only when a write starts, not on every keystroke.
export function createSaveCoordinator({snapshot,write=writeLibrary,onState=()=>{},delay=300}){
 let generation=0,saved=0,timer=null,inFlight=null,error=null;
 const state=()=>({dirty:generation!==saved,pending:!!timer||!!inFlight,error});
 const emit=()=>onState(state());
 function start(){
  if(inFlight)return inFlight;if(saved===generation)return Promise.resolve(true);
  const target=generation;
  inFlight=Promise.resolve().then(()=>write(snapshot())).then(()=>{saved=target;error=null;return true},failure=>{error=failure;return false}).finally(()=>{inFlight=null;emit()});emit();return inFlight;
 }
 async function flush(){
  clearTimeout(timer);timer=null;
  while(saved!==generation||inFlight){if(!await start())return false;clearTimeout(timer);timer=null}
  emit();return true;
 }
 function request(){generation++;error=null;clearTimeout(timer);timer=setTimeout(()=>{timer=null;void flush()},delay);emit()}
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
