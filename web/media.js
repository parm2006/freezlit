export const isImagePointer=value=>typeof value==='string'&&/^\/api\/media\/[a-f0-9]{64}$/.test(value);
export const thumbnail=value=>isImagePointer(value)?value.replace('/media/','/thumb/'):value;
const native=()=>typeof globalThis.window?.webkit?.messageHandlers?.freezlit?.postMessage==='function';
export async function storeImage(value){
 if(!value||isImagePointer(value)||native())return value;
 if(!/^data:image\/(png|jpeg|webp|gif);base64,/.test(value))throw Error('Invalid image.');
 const comma=value.indexOf(','),binary=atob(value.slice(comma+1)),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const blob=new Blob([bytes],{type:value.slice(5,value.indexOf(';'))});
 const response=await fetch('/api/media',{method:'PUT',headers:{'Content-Type':blob.type},body:blob});
 if(!response.ok){let message='Image could not be stored.';try{message=(await response.json()).error||message}catch{}throw Error(message)}
 const result=await response.json();if(!isImagePointer(result.image))throw Error('Invalid stored image reference.');return result.image;
}
export function imageLocations(library){
 const locations=[];
 const deck=d=>{for(const c of d?.cards||[])for(const field of ['termImage','definitionImage'])if(c[field])locations.push([c,field])};
 for(const d of library.decks||[])deck(d);
 for(const d of library.editorDrafts||[])deck(d.deck);
 for(const test of Object.values(library.testDrafts||{}))for(const q of test.questions||[])for(const field of ['promptImage','answerImage'])if(q[field])locations.push([q,field]);
 return locations;
}
export async function prepareImages(library){
 const uploaded=new Map();
 for(const [object,field] of imageLocations(library)){
  const value=object[field];if(isImagePointer(value))continue;
  if(!uploaded.has(value))uploaded.set(value,await storeImage(value));
  if(object[field]===value)object[field]=uploaded.get(value);
 }
}
export async function portableLibrary(library){
 const copy=structuredClone(library),images=new Map();
 for(const [object,field] of imageLocations(copy)){
  const value=object[field];if(!isImagePointer(value))continue;
  if(!images.has(value)){
   const response=await fetch(value);if(!response.ok)throw Error('An original image is missing; export was not created.');
   const blob=await response.blob();
   images.set(value,await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not export image.'));reader.readAsDataURL(blob)}));
  }
  object[field]=images.get(value);
 }
 return copy;
}
