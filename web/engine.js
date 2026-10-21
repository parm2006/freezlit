export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now();
export const DAY=86400000;
export const MAX_INTERVAL=36500;
export const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
export const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'').replace(/[.,!?;:]/g,(c,i,v)=>/\d/.test(v[i-1]||'')||/\d/.test(v[i+1]||'')?c:'');
export function correct(input,answer,strict=false){return String(answer).split('|').some(a=>strict?String(input).trim()===a.trim():normalize(a)===normalize(input))}
export function face(card,direction='forward'){return direction==='reverse'?{prompt:card.definition,answer:card.term,promptImage:card.definitionImage,answerImage:card.termImage}:{prompt:card.term,answer:card.definition,promptImage:card.termImage,answerImage:card.definitionImage}}
export function validImage(value){
 if(typeof value!=='string'||value.length>16*1024*1024)return false;
 const comma=value.indexOf(',');if(!['data:image/png;base64','data:image/jpeg;base64','data:image/webp;base64','data:image/gif;base64'].includes(value.slice(0,comma)))return false;
 const body=value.slice(comma+1);if(!body.length||body.length%4)return false;
 const padding=body.endsWith('==')?2:body.endsWith('=')?1:0;
 for(let i=0;i<body.length-padding;i++){const c=body.charCodeAt(i);if(!(c>=65&&c<=90||c>=97&&c<=122||c>=48&&c<=57||c===43||c===47))return false}
 return true;
}
export function schedule(old={},rating,now=Date.now()){
 const s={ease:2.5,interval:0,reps:0,lapses:0,state:'new',...old};
 if(rating===1){s.lapses+=s.reps>0?1:0;s.interval=0;s.state='learning';s.step=0;s.due=now+60000;s.ease=Math.max(1.3,s.ease-.2)}
 else if(rating===2){s.interval=s.state==='review'?Math.max(1,Math.round(s.interval*1.2)):0;s.due=now+(s.interval?s.interval*DAY:600000);s.ease=Math.max(1.3,s.ease-.15);s.state=s.interval?'review':'learning'}
 else if(rating===3){if(s.state==='new'||s.state==='learning'&&s.step===0){s.step=1;s.state='learning';s.interval=0;s.due=now+600000}else{s.interval=s.state==='learning'?1:Math.max(1,Math.round(s.interval*s.ease));s.state='review';delete s.step;s.due=now+s.interval*DAY}}
 else if(rating===4){s.interval=s.state==='review'?Math.max(4,Math.round(s.interval*s.ease*1.3)):4;s.ease+=.15;s.state='review';delete s.step;s.due=now+s.interval*DAY}
 else throw Error('Invalid rating');
 s.ease=Math.min(100,s.ease);s.interval=Math.min(MAX_INTERVAL,s.interval);if(s.interval)s.due=now+s.interval*DAY;
 s.reps++;s.lastReview=now;return s;
}
export function intervalLabel(s,now=Date.now()){const minutes=Math.round((s.due-now)/60000);return minutes<60?`${minutes} min`:minutes<1440?`${Math.round(minutes/60)} hr`:`${Math.round(minutes/1440)} days`}
export function queue(cards,direction,settings,history,now=Date.now()){
 // Caller passes cards and history from the same deck. Limits are per deck/direction.
 // Learning repeats never consume the daily allowance for distinct review cards.
 const candidates=cards.filter(c=>!c.suspended&&(!c.buriedUntil||c.buriedUntil<=now));
 const today=new Date(now).toDateString();const counts=history.filter(h=>h.source==='review'&&h.direction===direction&&new Date(h.at).toDateString()===today);
 const newSeen=new Set(counts.filter(h=>h.wasNew).map(h=>h.cardId));const reviewed=new Set(counts.filter(h=>!h.wasNew&&!newSeen.has(h.cardId)).map(h=>h.cardId));
 const due=candidates.filter(c=>c.schedule?.[direction]?.due<=now).sort((a,b)=>a.schedule[direction].due-b.schedule[direction].due);
 const learning=due.filter(c=>c.schedule[direction].state==='learning'||c.schedule[direction].state==='relearning');
 const reviews=due.filter(c=>!learning.includes(c));
 const continued=reviews.filter(c=>reviewed.has(c.id));const unseen=reviews.filter(c=>!reviewed.has(c.id)).slice(0,Math.max(0,settings.reviewLimit-reviewed.size));
 const fresh=candidates.filter(c=>!c.schedule?.[direction]).slice(0,Math.max(0,settings.newLimit-newSeen.size));return [...learning,...continued,...unseen,...fresh];
}
export function makeTest(cards,direction,types,count){
 if(!Array.isArray(types)||!types.length||types.some(t=>!['choice','written','tf','matching'].includes(t)))throw Error('Select at least one valid question type.');
 if(!Number.isInteger(count)||count<1||count>100000)throw Error('Choose a question count from 1 to 100000.');
 const eligible=cards.filter(c=>face(c,direction).answer.trim());
 if(!eligible.length)throw Error('Tests need text on the answer side. Switch direction, add text, or use Flashcards and spaced review for image-only answers.');
 // Cover every eligible card once before repeating a fresh shuffled cycle.
 // Swap the next cycle's first card when it would immediately repeat the last.
 const pool=[];
 while(pool.length<count){
  const cycle=shuffle(eligible);
  if(cycle.length>1&&pool.length&&cycle[0].id===pool[pool.length-1].id){
   const swapIndex=cycle.findIndex(c=>c.id!==cycle[0].id);
   if(swapIndex>0)[cycle[0],cycle[swapIndex]]=[cycle[swapIndex],cycle[0]];
  }
  pool.push(...cycle.slice(0,count-pool.length));
 }
 return pool.map((card,i)=>{const f=face(card,direction);let type=types[i%types.length];if(['choice','matching'].includes(type)&&eligible.length<2)type='written';const options=shuffle([f.answer,...shuffle(eligible.filter(c=>c.id!==card.id)).map(c=>face(c,direction).answer).filter((a,j,arr)=>a!==f.answer&&arr.indexOf(a)===j).slice(0,3)]);const truth=Math.random()>.5;return {id:uid()+'-'+i,cardId:card.id,...f,additionalInfo:card.additionalInfo||'',type,options,statement:truth?f.answer:options.find(a=>a!==f.answer)||f.answer,truth:truth||options.length===1,input:'',graded:false}})
}
export function grade(q,strict=false){if(q.accepted===true)return true;if(q.type==='tf')return q.input===String(q.truth);if(q.type==='choice'||q.type==='matching')return q.input===q.answer;return correct(q.input,q.answer,strict)}
export function parseDelimited(text,delimiter='\t'){
 const rows=[];let row=[],field='',quoted=false;const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'&&(quoted||field==='')){if(quoted&&s[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){row.push(field);field=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}else field+=ch}
 if(quoted)throw Error('An import field has an unclosed quote.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function validateLibrary(value){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const integer=(v,min,max)=>Number.isInteger(v)&&number(v,min,max);
 const timestamp=v=>integer(v,0,8640000000000000);
 const id=v=>typeof v==='string'&&v.length>0&&v.length<=200;
 if(!object(value)||value.version!==1||!Array.isArray(value.decks))throw Error('Use a Recall JSON export (version 1).');
 if(value.settings===undefined)value.settings={newLimit:20,reviewLimit:200};
 if(!object(value.settings)||!integer(value.settings.newLimit,0,100000)||!integer(value.settings.reviewLimit,0,100000))throw Error('Daily card limits must be whole numbers from 0 to 100000.');
 if(value.history===undefined)value.history=[];
 if(!Array.isArray(value.history)||value.history.length>1000000)throw Error('Review history must be an array of at most one million entries.');
 for(const h of value.history){if(!object(h)||!timestamp(h.at)||!id(h.cardId)||!id(h.deckId)||!['forward','reverse'].includes(h.direction)||typeof h.source!=='string'||h.wasNew!==undefined&&typeof h.wasNew!=='boolean'||h.ok!==undefined&&typeof h.ok!=='boolean'||h.rating!==undefined&&!integer(h.rating,1,4))throw Error('Review history contains an invalid entry.');}
 if(value.records===undefined)value.records={};
 const score=v=>number(v,-1e12,1e12)||typeof v==='string'&&/^-?\d+(?:\.\d+)?(?:s| points)$/.test(v)&&number(parseFloat(v),v.endsWith(' points')?-1e12:0,1e12);
 if(!object(value.records)||Object.values(value.records).some(v=>!score(v)))throw Error('Game records must contain finite scores or nonnegative times.');
 if(!object(value.testConfigs))value.testConfigs={};else for(const [key,c] of Object.entries(value.testConfigs))if(!id(key)||!object(c)||!integer(c.count,1,1000)||!Array.isArray(c.types)||!c.types.length||c.types.some(t=>!['choice','written','tf','matching'].includes(t)))delete value.testConfigs[key];
 if(!object(value.testDrafts))value.testDrafts={};
 if(!Array.isArray(value.studyPreferences))value.studyPreferences=[];
 if(!Array.isArray(value.editorDrafts))value.editorDrafts=[];
 const ids=new Set();for(const d of value.decks){
  if(!object(d)||typeof d.title!=='string'||!Array.isArray(d.cards))throw Error('A deck is missing its title or cards.');
  if(!id(d.id)||ids.has(d.id))throw Error('Deck IDs must be unique strings.');ids.add(d.id);
  const cids=new Set();for(const c of d.cards){
   if(!object(c)||!id(c.id)||cids.has(c.id))throw Error('Card IDs must be unique strings within a deck.');cids.add(c.id);
   if(typeof c.term!=='string'||typeof c.definition!=='string')throw Error('Cards need term and definition text fields.');
   for(const field of ['termImage','definitionImage'])if(c[field]&&!validImage(c[field]))throw Error('Images must be valid embedded PNG, JPEG, WebP or GIF base64 data (at most 16 MB).');
   if(!c.term.trim()&&!c.termImage||!c.definition.trim()&&!c.definitionImage)throw Error('Each card needs content on both sides.');
   for(const field of ['starred','suspended'])if(c[field]!==undefined&&typeof c[field]!=='boolean')throw Error('Card flags must be true or false.');
   if(c.buriedUntil!==undefined&&!timestamp(c.buriedUntil))throw Error('A card has an invalid burial date.');
   if(c.tags!==undefined&&(!Array.isArray(c.tags)||c.tags.some(t=>typeof t!=='string')))throw Error('Card tags must be text.');
   if(c.notes!==undefined&&typeof c.notes!=='string')throw Error('Card notes must be text.');
   if(c.additionalInfo!==undefined&&typeof c.additionalInfo!=='string')throw Error('Card additional information must be text.');
   if(c.schedule===undefined)c.schedule={};
   if(!object(c.schedule)||Object.keys(c.schedule).some(k=>!['forward','reverse'].includes(k)))throw Error('A card has invalid review directions.');
   for(const s of Object.values(c.schedule)){
    if(!object(s)||!['new','learning','review','relearning'].includes(s.state)||!timestamp(s.due)||!number(s.interval,0,MAX_INTERVAL)||!number(s.ease,1.3,100)||!integer(s.reps,0,1e9)||!integer(s.lapses,0,1e9)||s.step!==undefined&&!integer(s.step,0,1)||s.lastReview!==undefined&&!timestamp(s.lastReview))throw Error('A card has invalid review scheduling data.');
   }
  }
 }
 for(const [deckId,s] of Object.entries(value.testDrafts)){
  const cardIds=new Set(value.decks.find(d=>d.id===deckId)?.cards.map(c=>c.id)||[]);
  if(!id(deckId)||!object(s)||!Array.isArray(s.questions)||!s.questions.length||s.questions.length>1000||!['forward','reverse'].includes(s.direction)||typeof s.submitted!=='boolean'||s.strict!==undefined&&typeof s.strict!=='boolean'||s.starOnly!==undefined&&typeof s.starOnly!=='boolean'||s.questions.some(q=>!object(q)||!id(q.cardId)||!cardIds.has(q.cardId)||typeof q.prompt!=='string'||typeof q.answer!=='string'||typeof q.input!=='string'||!['choice','written','tf','matching'].includes(q.type)||!Array.isArray(q.options)||q.options.some(x=>typeof x!=='string')||q.accepted!==undefined&&typeof q.accepted!=='boolean'))delete value.testDrafts[deckId];
 }
 value.studyPreferences=value.studyPreferences.filter(p=>object(p)&&id(p.deckId)&&id(p.mode)&&typeof p.shuffle==='boolean');
 const draftIds=new Set();value.editorDrafts=value.editorDrafts.filter(r=>{
  if(!object(r)||!id(r.id)||draftIds.has(r.id)||r.deckId!==null&&!id(r.deckId)||!object(r.deck)||!Array.isArray(r.deck.cards))return false;
  const ids=new Set();for(const c of r.deck.cards){if(!object(c)||!id(c.id)||ids.has(c.id)||typeof c.term!=='string'||typeof c.definition!=='string'||c.termImage&&!validImage(c.termImage)||c.definitionImage&&!validImage(c.definitionImage))return false;ids.add(c.id)}
  draftIds.add(r.id);return true;
 });
 return value
}
