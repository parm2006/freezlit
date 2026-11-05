// Keys match media_store.py. Each changed card becomes one small SQLite record.
export function flattenLibrary(library){
 const records=new Map();
 if(!library)return records;
 const key=(...parts)=>JSON.stringify(parts);
 function deck(kind,id,value){
  const {cards,...meta}=value;
  records.set(key(kind,id),{meta,cards:cards.map(c=>c.id)});
  for(const card of cards)records.set(key(kind+'Card',id,card.id),card);
 }
 const {decks=[],editorDrafts=[],...root}=library;
 records.set(key('root'),{...root,decks:decks.map(d=>d.id),editorDrafts:editorDrafts.map(d=>d.id)});
 for(const d of decks)deck('deck',d.id,d);
 for(const d of editorDrafts){const {deck:value,...meta}=d;records.set(key('draft',d.id),meta);deck('draftDeck',d.id,value)}
 return new Map([...records].map(([key,value])=>[key,JSON.stringify(value)]));
}
export function diffRecords(before,after){
 return {set:[...after].filter(([key,value])=>before.get(key)!==value).map(([key,value])=>[key,JSON.parse(value)]),remove:[...before.keys()].filter(key=>!after.has(key))};
}
