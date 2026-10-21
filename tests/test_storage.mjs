import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isNativeApp,readLibrary,writeLibrary,exportLibrary,speakText,stopSpeech,encodeLibrary,decodeLibrary,createSaveCoordinator,StorageConflict} from '../web/storage.js';

let passed=0,failed=0;
async function test(name,run){
 const names=['window','fetch','document','URL','setTimeout'];
 const descriptors=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 try{await run();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+' — '+e.stack)}
 finally{for(const [name,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}}
}
const library={version:1,decks:[{id:'deck',title:'日本史',cards:[{id:'card',term:'Kofun Period',definition:'300-538',additionalInfo:'Burial mounds.'}]}],history:[],records:{}};
const image='data:image/png;base64,iVBORw0KGgo=';
await test('Test persistence saves one independent snapshot without stale timer references',()=>{
 const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const remember=source.match(/function rememberTest\(\)\{[\s\S]*?\n\}/)[0];
 const data={},session={questions:[{input:'original'}],submitted:true};let saves=0;
 new Function('data','session','save',`const mode='test',selected='deck';${remember};rememberTest();`)(data,session,()=>saves++);
 assert.equal(saves,1);assert.deepEqual(data.testDrafts.deck,session);session.questions[0].input='changed';assert.equal(data.testDrafts.deck.questions[0].input,'original');
});
function bridge(handler){globalThis.window={webkit:{messageHandlers:{freezlit:{postMessage:handler}}}}}
function forbidFetch(){globalThis.fetch=()=>{throw Error('Native calls must not use the localhost fetch service')}}

await test('Native detection tolerates missing window and incomplete bridges',()=>{
 delete globalThis.window;assert.equal(isNativeApp(),false);assert.doesNotThrow(()=>stopSpeech());
 for(const window of [{},{webkit:{}},{webkit:{messageHandlers:{freezlit:{postMessage:true}}}}]){globalThis.window=window;assert.equal(isNativeApp(),false)}
});
await test('Version 2 storage deduplicates images across cards and test drafts',()=>{
 const source={version:1,decks:[{id:'d',title:'Deck',cards:[{id:'c',term:'a',definition:'b',termImage:image}]}],history:[],records:{},testDrafts:{d:{questions:[{id:'q',cardId:'c',promptImage:image,answerImage:image}]}},editorDrafts:[{id:'draft',deckId:'d',deck:{id:'d',cards:[{id:'c',term:'a',definition:'b',termImage:image}]}}]};
 const encoded=encodeLibrary(source);assert.equal(encoded.version,2);assert.deepEqual(Object.keys(encoded.media),['m0']);assert.equal(encoded.decks[0].cards[0].termImage.mediaId,'m0');assert.equal(encoded.testDrafts.d.questions[0].answerImage.mediaId,'m0');assert.equal(encoded.editorDrafts[0].deck.cards[0].termImage.mediaId,'m0');assert.deepEqual(decodeLibrary(encoded),source);assert.equal(source.decks[0].cards[0].termImage,image);
});
await test('Version 2 decoder rejects missing media references',()=>{
 const encoded=encodeLibrary({version:1,decks:[{id:'d',title:'Deck',cards:[{id:'c',term:'a',definition:'b',termImage:image}]}]});encoded.media={};assert.throws(()=>decodeLibrary(encoded),/reference/);
});
await test('Save coordinator coalesces changes and drains changes made during a write',async()=>{
 const releases=[],writes=[],snapshot={value:1};const coordinator=createSaveCoordinator({snapshot:()=>({...snapshot}),delay:50,write:value=>new Promise(resolve=>{writes.push(value);releases.push(resolve)})});
 coordinator.request();const draining=coordinator.flush();await new Promise(setImmediate);assert.deepEqual(writes,[{value:1}]);snapshot.value=2;coordinator.request();releases.shift()();await new Promise(setImmediate);assert.deepEqual(writes,[{value:1},{value:2}]);releases.shift()();assert.equal(await draining,true);assert.equal(coordinator.state.dirty,false);
});
await test('Save coordinator leaves failed writes dirty for retry',async()=>{
 const coordinator=createSaveCoordinator({snapshot:()=>library,write:async()=>{throw Error('disk full')}});coordinator.request();assert.equal(await coordinator.flush(),false);assert.equal(coordinator.state.dirty,true);assert.match(coordinator.state.error.message,/disk full/);
});
await test('Native load returns the same library object and uses load action',async()=>{
 const messages=[];bridge(message=>{messages.push(message);return Promise.resolve(library)});forbidFetch();
 assert.equal(isNativeApp(),true);assert.equal(await readLibrary(),library);assert.deepEqual(messages,[{action:'load'}]);
});
await test('Native load preserves null for first-run starter creation',async()=>{
 bridge(()=>Promise.resolve(null));assert.equal(await readLibrary(),null);
});
await test('Native save includes the complete library',async()=>{
 let message;bridge(value=>{message=value;return Promise.resolve({ok:true})});forbidFetch();
 assert.equal(await writeLibrary(library),undefined);assert.equal(decodeLibrary(message.library).decks[0].id,library.decks[0].id);assert.equal(message.library.version,2);assert.equal(message.action,'save');
});
await test('Native failed save surfaces the backend error and fallback message',async()=>{
 bridge(()=>Promise.resolve({ok:false,error:'Disk is full'}));await assert.rejects(writeLibrary(library),/Disk is full/);
 bridge(()=>Promise.resolve({ok:false}));await assert.rejects(writeLibrary(library),/Cannot save your library/);
});
await test('Native export includes name/library and supports cancellation results',async()=>{
 let message;const cancelled={cancelled:true};bridge(value=>{message=value;return Promise.resolve(cancelled)});forbidFetch();
 assert.equal(await exportLibrary(library,'history-backup.json'),cancelled);
 assert.equal(message.action,'export');assert.equal(message.name,'history-backup.json');assert.equal(decodeLibrary(message.library).decks[0].id,library.decks[0].id);
});
await test('Native speech forwards exact text, chosen language and default language',async()=>{
 const messages=[];bridge(value=>{messages.push(value);return Promise.resolve({ok:true})});
 await speakText('こんにちは','ja-JP');await speakText('Active recall');
 assert.deepEqual(messages,[{action:'speak',text:'こんにちは',language:'ja-JP'},{action:'speak',text:'Active recall',language:'en-US'}]);
});
await test('Native cancelSpeech posts action and safely absorbs cancellation failure',async()=>{
 const messages=[];bridge(value=>{messages.push(value);return Promise.reject(Error('already stopped'))});
 assert.doesNotThrow(()=>stopSpeech());await new Promise(setImmediate);assert.deepEqual(messages,[{action:'cancelSpeech'}]);
});
await test('Native load/save/export/speak promise failures propagate to the caller',async()=>{
 bridge(value=>Promise.reject(Error('bridge '+value.action+' failed')));
 for(const [action,run] of [['load',()=>readLibrary()],['save',()=>writeLibrary(library)],['export',()=>exportLibrary(library,'test.json')],['speak',()=>speakText('test')]])await assert.rejects(run(),new RegExp('bridge '+action+' failed'));
});
await test('Windows reads /api/library by GET and preserves library/null responses',async()=>{
 globalThis.window={};const requests=[];let response=library;
 globalThis.fetch=async(...args)=>{requests.push(args);return {ok:true,json:async()=>response}};
 assert.equal(await readLibrary(),library);response=null;assert.equal(await readLibrary(),null);
 assert.deepEqual(requests,[['/api/library'],['/api/library']]);
});
await test('Windows saves valid UTF-8 JSON with PUT and content type',async()=>{
 delete globalThis.window;let request;
 globalThis.fetch=async(url,options)=>{request={url,options};return {ok:true}};
 await writeLibrary(library);assert.equal(request.url,'/api/library');assert.equal(request.options.method,'PUT');assert.equal(request.options.headers['Content-Type'],'application/json');assert.equal(JSON.parse(request.options.body).version,2);assert.deepEqual(decodeLibrary(JSON.parse(request.options.body)),library);
});
await test('Windows read errors and invalid JSON propagate without returning empty data',async()=>{
 globalThis.window={};globalThis.fetch=async()=>({ok:false,json:async()=>({error:'backend unavailable'})});await assert.rejects(readLibrary(),/Cannot read your saved library/);
 globalThis.fetch=async()=>({ok:true,json:async()=>{throw Error('invalid JSON')}});await assert.rejects(readLibrary(),/invalid JSON/);
 globalThis.fetch=async()=>{throw Error('Connection lost')};await assert.rejects(readLibrary(),/Connection lost/);
});
await test('Windows save surfaces backend errors and non-JSON failure fallback',async()=>{
 globalThis.window={};globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Permission denied'})});await assert.rejects(writeLibrary(library),/Permission denied/);
 globalThis.fetch=async()=>({ok:false,json:async()=>{throw Error('HTML response')}});await assert.rejects(writeLibrary(library),/Storage unavailable/);
 globalThis.fetch=async()=>{throw Error('Connection lost')};await assert.rejects(writeLibrary(library),/Connection lost/);
});
await test('Browser export downloads complete JSON and revokes the temporary URL',async()=>{
 globalThis.window={};let savedBlob,anchor,scheduled;
 globalThis.URL={createObjectURL(blob){savedBlob=blob;return 'blob:test'},revokeObjectURL(value){assert.equal(value,'blob:test')}};
 globalThis.document={createElement(tag){assert.equal(tag,'a');anchor={click(){this.clicked=true}};return anchor}};
 globalThis.setTimeout=(fn,ms)=>{scheduled={fn,ms};return 1};
 await exportLibrary(library,'backup.json');assert.equal(anchor.href,'blob:test');assert.equal(anchor.download,'backup.json');assert.ok(anchor.clicked);assert.equal(savedBlob.type,'application/json');assert.deepEqual(decodeLibrary(JSON.parse(await savedBlob.text())),library);assert.equal(scheduled.ms,1000);scheduled.fn();
});
await test('Missing browser speech fails with a helpful error instead of a ReferenceError',async()=>{
 delete globalThis.window;await assert.rejects(speakText('hello'),/Speech is unavailable on this device/);
 globalThis.window={};await assert.rejects(speakText('hello'),/Speech is unavailable on this device/);assert.doesNotThrow(()=>stopSpeech());
});
await test('Windows speech cancels previous audio and uses selected language/rate',async()=>{
 const calls=[];class Utterance{constructor(text){this.text=text}}
 globalThis.window={SpeechSynthesisUtterance:Utterance,speechSynthesis:{cancel(){calls.push('cancel')},speak(utterance){calls.push(utterance)}}};
 await speakText('burial mounds','en-GB');assert.equal(calls[0],'cancel');assert.equal(calls[1].text,'burial mounds');assert.equal(calls[1].lang,'en-GB');assert.equal(calls[1].rate,.9);stopSpeech();assert.equal(calls[2],'cancel');
});

console.log(`\n${passed} storage tests passed; ${failed} failed`);
process.exitCode=failed?1:0;
