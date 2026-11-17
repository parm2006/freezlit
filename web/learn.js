import {shuffle} from './engine.js';

export function startLearn(cards,direction,now=Date.now()){
 const available=cards.filter(c=>!c.suspended&&(!c.buriedUntil||c.buriedUntil<=now));
 const session={direction,cards:available,list:[],index:0,phase:'batch',pending:[...available],consolidation:[],mastered:Object.create(null),masteredCards:new Set(),attempts:0,hits:0};
 nextPhase(session);
 return session;
}

function nextPhase(session){
 session.index=0;
 if(!session.pending.length&&!session.consolidation.length){
  session.pending=[...session.cards];session.mastered=Object.create(null);
 }
 if(session.pending.length){
  session.phase='batch';session.list=session.pending.splice(0,5);session.batch=[...session.list];
 }else if(session.consolidation.length){session.phase='consolidation';session.list=shuffle(session.consolidation.splice(0))}
}

export function advanceLearn(session,ok){
 const card=session.list.shift();if(!card)return;
 if(session.phase==='batch'){
  const streak=session.mastered[card.id]=ok?(session.mastered[card.id]||0)+1:0;
  if(streak<2)session.list.splice(ok?session.list.length:Math.min(2,session.list.length),0,card);
  else session.masteredCards.add(card.id);
  // Keep the whole batch together until every card has two consecutive recalls.
  if(!session.list.length)session.consolidation.push(...session.batch);
 }else if(session.phase==='consolidation'){
  if(!ok)session.list.splice(Math.min(2,session.list.length),0,card);
 }
 if(!session.list.length)nextPhase(session);
}
