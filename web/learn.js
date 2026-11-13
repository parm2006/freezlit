import {DAY,shuffle} from './engine.js';

const sameDay=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
const state=(card,direction)=>card.learnSchedule?.[direction];
function put(card,direction,value){card.learnSchedule??={};card.learnSchedule[direction]=value}

export function startLearn(cards,direction,newLimit,now=Date.now(),quotaCards=cards){
 const available=cards.filter(c=>!c.suspended&&(!c.buriedUntil||c.buriedUntil<=now));
 const started=quotaCards.filter(c=>sameDay(state(c,direction)?.startedAt,now)).length;
 const pending=available.filter(c=>state(c,direction)?.box===0);
 const fresh=available.filter(c=>!state(c,direction)).slice(0,Math.max(0,newLimit-started));
 const reviews=shuffle(available.filter(c=>state(c,direction)?.box>0&&state(c,direction).due<=now));
 const consolidation=available.filter(c=>{const s=state(c,direction);return sameDay(s?.learnedAt,now)&&!sameDay(s?.checkedAt,now)});
 const session={direction,quotaCards,list:reviews,index:0,phase:'review',pending:[...pending,...fresh],consolidation,mastered:Object.create(null),attempts:0,hits:0,reviewed:0,learned:0,blocked:false};
 session.total=new Set([...reviews,...pending,...fresh,...consolidation].map(c=>c.id)).size;
 for(const c of consolidation)session.mastered[c.id]=2;
 if(!reviews.length)nextPhase(session,now);
 return session;
}

function nextPhase(session,now){
 session.index=0;
 if(session.quotaCards.filter(c=>state(c,session.direction)?.box===1).length>40){
  session.blocked=true;
  const pending=session.pending.filter(c=>state(c,session.direction)?.box===0);
  session.total-=session.pending.length-pending.length;session.pending=pending;
 }
 if(session.pending.length){
  session.phase='batch';session.list=session.pending.splice(0,5);session.batch=[...session.list];
  for(const c of session.list)if(!state(c,session.direction))put(c,session.direction,{box:0,due:now,startedAt:now});
 }else if(session.consolidation.length){session.phase='consolidation';session.list=shuffle(session.consolidation.splice(0))}
 else{session.phase='done';session.list=[]}
}

export function advanceLearn(session,ok,now=Date.now()){
 const card=session.list.shift(),direction=session.direction,old=state(card,direction);
 if(session.phase==='review'){
  const box=ok?Math.min(3,old.box+1):1;
  session.mastered[card.id]=ok?2:0;
  put(card,direction,{...old,box,due:now+[0,1,3,7][box]*DAY});session.reviewed++;
 }else if(session.phase==='batch'){
  const streak=session.mastered[card.id]=ok?(session.mastered[card.id]||0)+1:0;
  if(streak<2)session.list.splice(ok?session.list.length:Math.min(2,session.list.length),0,card);
  // Keep the whole batch together until every card has two consecutive recalls.
  if(!session.list.length){
   const batch=session.batch||[];
   for(const c of batch){put(c,direction,{...state(c,direction),box:1,due:now+DAY,learnedAt:now});session.consolidation.push(c);session.learned++}
  }
 }else if(session.phase==='consolidation'){
  if(ok)put(card,direction,{...old,checkedAt:now});
  else session.list.splice(Math.min(2,session.list.length),0,card);
 }
 if(!session.list.length)nextPhase(session,now);
}
