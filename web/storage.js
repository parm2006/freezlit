// The same study UI uses a native Mac bridge or the Windows localhost service.
function bridge(){return globalThis.window?.webkit?.messageHandlers?.freezlit}
export function isNativeApp(){return typeof bridge()?.postMessage==='function'}
async function native(action,payload={}){return await bridge().postMessage({action,...payload})}
export async function readLibrary(){
 if(isNativeApp())return await native('load');
 const r=await fetch('/api/library');if(!r.ok)throw Error('Cannot read your saved library.');return await r.json();
}
export async function writeLibrary(library){
 if(isNativeApp()){const result=await native('save',{library});if(result?.ok===false)throw Error(result.error||'Cannot save your library.');return}
 const r=await fetch('/api/library',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(library)});
 if(!r.ok){let message='Storage unavailable';try{message=(await r.json()).error||message}catch{}throw Error(message)}
}
export async function exportLibrary(library,name){
 if(isNativeApp())return await native('export',{library,name});
 const blob=new Blob([JSON.stringify(library,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
