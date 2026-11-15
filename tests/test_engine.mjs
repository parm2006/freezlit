import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
let passed=0, failed=0;
async function test(name, fn) { try {await fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+' — '+e.message)}}
const now=new Date(2026,9,14,12).getTime();
const card=(id,extra={})=>({id,term:'Term '+id,definition:'Answer '+id,schedule:{},...extra});
const lib=(extra={},cExtra={})=>({version:1,settings:{},history:[],records:{},decks:[{id:'deck',title:'Deck',cards:[card('one',cExtra)]}],...extra});
await test('Good learns for ten minutes, then graduates after next recall',()=>{
 const first=E.schedule({},3,now); assert.equal(first.state,'learning');assert.equal(first.due,now+600000);
 const next=E.schedule(first,3,first.due);assert.equal(next.state,'review');assert.equal(next.interval,1);assert.equal(next.due,first.due+E.DAY);
});
await test('Again returns in a minute and increments lapse after review',()=>{
 const old={state:'review',reps:5,lapses:0,interval:10,ease:2.5};const next=E.schedule(old,1,now);
 assert.equal(next.due,now+60000);assert.equal(next.state,'learning');assert.equal(next.lapses,1);assert.equal(old.lapses,0);
});
await test('Easy graduation clears a stale learning step before the next Good',()=>{
 const again=E.schedule({state:'review',reps:4,lapses:0,interval:4,ease:2.5,step:0},1,now);
 const easy=E.schedule(again,4,again.due);const good=E.schedule(easy,3,easy.due);
 assert.equal(easy.state,'review');assert.equal(easy.step,undefined);assert.equal(good.state,'review');assert.equal(good.interval,10);
});
await test('Review success lengthens interval; ease has a floor',()=>{
 assert.equal(E.schedule({state:'review',interval:10,ease:2.5},3,now).interval,25);
 assert.equal(E.schedule({ease:1.3},1,now).ease,1.3);assert.throws(()=>E.schedule({},0,now));
});
await test('Directions have independent due state and media orientation',()=>{
 const c=card('a',{termImage:'term.png',definitionImage:'definition.png',schedule:{forward:E.schedule({},4,now)}});
 assert.equal(E.queue([c],'forward',now).length,0);
 assert.equal(E.queue([c],'reverse',now).length,1);
 assert.deepEqual(E.face(c,'reverse'),{prompt:c.definition,answer:c.term,promptImage:'definition.png',answerImage:'term.png'});
});
await test('Due queue sorts overdue cards and excludes suspension/bury/future',()=>{
 const due=(id,t,extra={})=>card(id,{schedule:{forward:{state:'review',due:t}},...extra});
 assert.deepEqual(E.queue([due('later',now-1),due('first',now-100),due('future',now+1),due('buried',now-2,{buriedUntil:now+100}),due('suspended',now-3,{suspended:true})],'forward',now).map(c=>c.id),['first','later']);
});
await test('All new and due cards are available beyond the old daily caps',()=>{
 const fresh=Array.from({length:250},(_,i)=>card('new-'+i));
 const reviews=Array.from({length:250},(_,i)=>card('due-'+i,{schedule:{forward:{state:'review',due:now-1}}}));
 const learning=card('learning',{schedule:{forward:{state:'learning',due:now-1}}});
 const cards=[...reviews,...fresh,learning];
 const first=E.queue(cards,'forward',now);
 assert.equal(first.length,501);assert.equal(first[0],learning);
 assert.deepEqual(E.queue(cards,'forward',now),first,'Restarting does not reduce available cards');
});
await test('Typed answers support alternates, whitespace, Unicode and strict case',()=>{
 assert.ok(E.correct('  HELLO! ','hello|bonjour'));assert.ok(E.correct('Ａ','a'));
 assert.equal(E.correct('hello','Hello',true),false);assert.equal(E.correct('unrelated','hello'),false);
});
await test('Alpha and Beta are independent accepted answers with Exact grading off',()=>{
 for(const input of ['alpha','Alpha','beta','Beta'])assert.ok(E.correct(input,'Alpha | Beta'));
 assert.equal(E.correct('alpha','Alpha | Beta',true),false);
 assert.ok(E.correct('Alpha','Alpha | Beta',true));
 assert.equal(E.correct('alhpa','Alpha | Beta'),false);
});
await test('Answer choices draw from the supplied full deck and exclude blank or equivalent answers',()=>{
 const target=card('target',{definition:'Alpha | Beta'});
 const pool=[target,card('alias',{definition:'Beta'}),card('blank',{definition:''}),card('a',{definition:'A'}),card('duplicate',{definition:'a'}),card('b',{definition:'B'}),card('c',{definition:'C'})];
 const choices=E.answerChoices(target,pool,'forward');
 assert.equal(choices.length,4);assert.ok(choices.includes('Alpha | Beta'));
 assert.equal(choices.includes('Beta'),false);assert.equal(choices.includes(''),false);
 assert.equal(new Set(choices.map(E.normalize)).size,4);
 assert.deepEqual(E.answerChoices(target,[target],'forward'),['Alpha | Beta']);
 assert.equal(E.answerChoices(target,pool,'reverse').length,4);
});
await test('Lenient grading removes all whitespace and lowercases both answers',()=>{
 for(const input of ['19 - 12','        19-1 2','19\t-\n12','１９ - １２'])assert.ok(E.correct(input,'19-12'));
 assert.ok(E.correct('NeW\n Yo Rk','new york'));
 assert.ok(E.correct(' NEW YORK ','NYC | New York'));
 assert.equal(E.correct('19-13','19-12'),false);
 assert.equal(E.correct('19 - 12','19-12',true),false);
 assert.equal(E.correct('Hello','hello',true),false);
 assert.ok(E.correct(' 19-12 ','19-12',true));
});
await test('Lenient grading preserves punctuation that changes numbers',()=>{
 assert.equal(E.correct('19 - 12','        19-1 2'),true);
 assert.equal(E.correct('1.5','15'),false);assert.equal(E.correct('1.23','12.3'),false);assert.equal(E.correct('5!','5'),false);
 assert.equal(E.correct('PARIS,  France','paris france'),true);
});
await test('Strict grading accepts each trimmed written alternative',()=>{
 assert.equal(E.correct('United States',' USA | United States ',true),true);
 assert.equal(E.correct('united states','USA | United States',true),false);
});
await test('Accepted test answers preserve the typed input and grade in strict mode',()=>{
 for(const type of ['written','choice','matching','tf']){
  const q={type,answer:'correct',truth:true,input:'typo'};
  assert.equal(E.grade(q,true),false);
  q.accepted=true;
  assert.equal(E.grade(q,true),true);
  assert.equal(q.input,'typo');
  assert.equal(E.grade(JSON.parse(JSON.stringify(q)),true),true);
 }
 assert.equal(E.grade({type:'written',answer:'correct',input:'typo',accepted:'true'}),false);
});
await test('Tests grade choice, true/false, matching and written answers',()=>{
 assert.ok(E.grade({type:'tf',truth:false,input:'false'}));assert.equal(E.grade({type:'tf',truth:true,input:''}),false);
 for(const type of ['choice','matching','written'])assert.ok(E.grade({type,answer:'Answer',input:'Answer'}));
});
await test('Generated tests honor requested count and contain valid options',()=>{
 const cards=[card('a'),card('b'),card('c'),card('d')];
 const qs=E.makeTest(cards,'reverse',['choice','tf','written','matching'],99);
 assert.equal(qs.length,99);assert.equal(new Set(qs.map(q=>q.cardId)).size,4);assert.equal(new Set(qs.map(q=>q.id)).size,99);
 for(const q of qs){assert.ok(q.options.includes(q.answer));assert.equal(new Set(q.options).size,q.options.length);if(q.type==='tf')assert.equal(q.statement===q.answer,q.truth)}
});
await test('Single-card test falls back from choices and matching to written',()=>{
 for(const type of ['choice','matching'])assert.equal(E.makeTest([card('one')],'forward',[type],1)[0].type,'written');
});
await test('Empty selected question types are rejected',()=>assert.throws(()=>E.makeTest([card('one')],'forward',[],1)));
await test('Image-only answers cannot become empty auto-graded test questions',()=>{
 const image=card('image',{definition:'',definitionImage:'data:image/png;base64,iVBORw0KGgo='});
 assert.throws(()=>E.makeTest([image],'forward',['written'],1));
 const qs=E.makeTest([image,card('text')],'forward',['choice'],2);assert.equal(qs.length,2);assert.ok(qs.every(q=>q.answer==='Answer text'));assert.equal(new Set(qs.map(q=>q.id)).size,2);
 const reverse=E.makeTest([image],'reverse',['written'],1);assert.ok(reverse[0].promptImage);assert.equal(reverse[0].answer,'Term image');
});
await test('Repeated Easy ratings cannot produce unbounded review intervals',()=>{
 let state={state:'review',interval:E.MAX_INTERVAL,ease:99,reps:100,lapses:0};
 for(let i=0;i<10;i++)state=E.schedule(state,4,now);
 assert.equal(state.interval,E.MAX_INTERVAL);assert.equal(state.ease,100);assert.equal(state.due,now+E.MAX_INTERVAL*E.DAY);
});
await test('Quoted CSV handles escaped quote, embedded comma/newline and BOM',()=>{
 assert.deepEqual(E.parseDelimited('\uFEFF"front, part","line 1\nline 2"\r\n"say ""hello""",answer',','),[['front, part','line 1\nline 2'],['say "hello"','answer']]);
 assert.throws(()=>E.parseDelimited('"unfinished,answer',','));
});
await test('TSV handles empty fields and skips blank records',()=>assert.deepEqual(E.parseDelimited('a\tb\r\n\r\nx\t\ty'),[['a','b'],['x','','y']]));
await test('TSV preserves quotes inside unquoted fields',()=>assert.deepEqual(E.parseDelimited('Say "hello"\tgreeting','\t'),[['Say "hello"','greeting']]));
await test('Quizlet export preserves plain text and rejects invalid card rows',()=>{
 assert.deepEqual(E.parseQuizlet('\uFEFF"café"\tcoffee, shop; or both\r\n\r\n猫\t"cat\r\n'),[['"café"','coffee, shop; or both'],['猫','"cat']]);
 for(const text of ['term,definition','term\t','\tdefinition','term\tdefinition\textra'])assert.throws(()=>E.parseQuizlet(text),/choose Tab and New line/);
});
await test('Library rejects duplicates and external/SVG images',()=>{
 assert.equal(E.validateLibrary(lib({}, {term:' ',definition:''})).decks[0].cards[0].definition,'');
 assert.throws(()=>E.validateLibrary(lib({}, {termImage:'https://example.test/image.png'})));
 assert.throws(()=>E.validateLibrary(lib({}, {termImage:'data:image/svg+xml;base64,AAAA'})));
 const l=lib();l.decks[0].cards.push({...l.decks[0].cards[0]});assert.throws(()=>E.validateLibrary(l));
});
await test('Saving strips only new cards without content or options',()=>{
 const blank=card('blank',{term:'',definition:'',notes:'',tags:[],schedule:{}});
 const kept=[card('front',{definition:''}),card('back',{term:''}),{...blank,id:'notes',notes:'Keep me'},{...blank,id:'info',additionalInfo:'Context'},{...blank,id:'image',termImage:'data:image/png;base64,iVBORw0KGgo='},{...blank,id:'tag',tags:['tag']},{...blank,id:'star',starred:true},{...blank,id:'existing'}];
 assert.deepEqual(E.cardsForSave([blank,{...blank,id:'spaces',term:'  '},...kept],[kept.at(-1)]),kept);
 for(const c of kept)assert.equal(E.validateLibrary(lib({},c)).decks[0].cards[0].definition,c.definition);
});
await test('Library accepts embedded image-only content',()=>assert.equal(E.validateLibrary(lib({}, {term:'',termImage:'data:image/png;base64,iVBORw0KGgo='})).version,1));
await test('Library accepts real app review state and formatted personal bests',()=>{
 const value=lib({records:{match:'18.4s',sprint:'6 points',blocks:'-3 points'},history:[{at:now,cardId:'one',deckId:'deck',direction:'forward',source:'review',wasNew:true,ok:true,rating:4}]},{schedule:{forward:E.schedule({},4,now)}});
 assert.equal(E.validateLibrary(value),value);
});
await test('Library rejects malformed embedded image base64',()=>assert.throws(()=>E.validateLibrary(lib({}, {termImage:'data:image/png;base64,%%%invalid%%%'}))));
await test('Library validates large embedded images without recursive regex overflow',()=>{
 const image='data:image/png;base64,'+'A'.repeat(8_000_000);
 assert.equal(E.validateLibrary(lib({}, {termImage:image})).decks[0].cards[0].termImage.length,image.length);
});
await test('Library rejects malformed history before queue can crash',()=>assert.throws(()=>E.validateLibrary(lib({history:'not an array'}))));
await test('Library removes legacy limits while preserving other settings and progress',()=>{
 for(const limits of [{newLimit:0,reviewLimit:0},{newLimit:20,reviewLimit:200},{newLimit:-4,reviewLimit:'oops'}]){
  const value=lib({settings:{...limits,voiceLang:'es-ES',lastDeckId:'deck'},history:[{at:now,cardId:'one',deckId:'deck',direction:'forward',source:'review',wasNew:true}]});
  const before=structuredClone(value);E.validateLibrary(value);
  assert.deepEqual(value.settings,{voiceLang:'es-ES',lastDeckId:'deck'});
  assert.deepEqual(value.decks,before.decks);assert.deepEqual(value.history,before.history);
  assert.equal(E.queue(value.decks[0].cards,'forward',now).length,1);
 }
 assert.deepEqual(E.validateLibrary(lib({settings:undefined})).settings,{});
});
await test('Library rejects invalid settings objects and corrupt scheduling state',()=>{
 for(const settings of [null,[],42])assert.throws(()=>E.validateLibrary(lib({settings})));
 assert.throws(()=>E.validateLibrary(lib({}, {schedule:{forward:{due:'bad',interval:-3,ease:null}}})));
});
await test('Twenty questions from eight cards cover full shuffled cycles without adjacent repeats',()=>{
 const cards=Array.from({length:8},(_,i)=>card(String(i)));
 const qs=E.makeTest(cards,'forward',['choice','written','tf','matching'],20);
 assert.equal(qs.length,20);assert.equal(new Set(qs.map(q=>q.id)).size,20);
 for(const start of [0,8])assert.equal(new Set(qs.slice(start,start+8).map(q=>q.cardId)).size,8);
 assert.equal(new Set(qs.slice(16).map(q=>q.cardId)).size,4);
 for(let i=1;i<qs.length;i++)assert.notEqual(qs[i].cardId,qs[i-1].cardId);
 assert.deepEqual(qs.map(q=>q.type),Array.from({length:20},(_,i)=>['choice','written','tf','matching'][i%4]));
});
await test('Two-card cycles never repeat the preceding card at a boundary',()=>{
 const qs=E.makeTest([card('a'),card('b')],'forward',['written'],40);
 assert.equal(qs.length,40);
 for(let i=1;i<qs.length;i++)assert.notEqual(qs[i].cardId,qs[i-1].cardId);
});
await test('Single-card deck produces requested count with unique IDs and written fallback',()=>{
 const qs=E.makeTest([card('only')],'forward',['choice','matching'],20);
 assert.equal(qs.length,20);assert.equal(new Set(qs.map(q=>q.id)).size,20);
 assert.ok(qs.every(q=>q.cardId==='only'&&q.type==='written'));
});
await test('Requested count below deck size stays unique and leaves source cards untouched',()=>{
 const cards=[card('a'),card('b'),card('c'),card('d')];const snapshot=JSON.stringify(cards);
 const qs=E.makeTest(cards,'reverse',['written'],2);
 assert.equal(qs.length,2);assert.equal(new Set(qs.map(q=>q.cardId)).size,2);assert.equal(JSON.stringify(cards),snapshot);
});
await test('Repeated tests filter image-only answers independently for each direction',()=>{
 const image='data:image/png;base64,iVBORw0KGgo=';
 const cards=[card('front-image',{term:'',termImage:image}),card('back-image',{definition:'',definitionImage:image})];
 const forward=E.makeTest(cards,'forward',['choice'],7);
 assert.equal(forward.length,7);assert.ok(forward.every(q=>q.cardId==='front-image'&&q.promptImage===image&&q.answer==='Answer front-image'&&q.type==='written'));
 const reverse=E.makeTest(cards,'reverse',['matching'],7);
 assert.equal(reverse.length,7);assert.ok(reverse.every(q=>q.cardId==='back-image'&&q.promptImage===image&&q.answer==='Term back-image'&&q.type==='written'));
 assert.equal(new Set([...forward,...reverse].map(q=>q.id)).size,14);
});
await test('Invalid requested question counts fail instead of silently changing count',()=>{
 for(const count of [0,-1,1.5,100001,NaN])assert.throws(()=>E.makeTest([card('a')],'forward',['written'],count));
});
await test('Additional information survives generated tests without becoming a required answer',()=>{
 const kofun=card('kofun',{term:'Kofun Period',definition:'300-538',additionalInfo:'Named after large burial mounds.'});
 const questions=E.makeTest([kofun],'forward',['written','choice','tf','matching'],8);
 assert.equal(questions.length,8);
 for(const q of questions){
  assert.equal(q.additionalInfo,kofun.additionalInfo);assert.equal(q.prompt,'Kofun Period');assert.equal(q.answer,'300-538');
  if(q.type==='tf'){q.input=String(q.truth);assert.ok(E.grade(q));continue}
  q.input='300-538';assert.ok(E.grade(q));assert.ok(E.grade(q,true));
  q.input='Named after large burial mounds.';assert.equal(E.grade(q),false);
  q.input='300-538 Named after large burial mounds.';assert.equal(E.grade(q),false);
 }
 const reverse=E.makeTest([kofun],'reverse',['written'],1)[0];
 assert.equal(reverse.additionalInfo,kofun.additionalInfo);assert.equal(reverse.prompt,'300-538');assert.equal(reverse.answer,'Kofun Period');
 reverse.input='Kofun Period';assert.ok(E.grade(reverse));
});
await test('Absent or blank additional information stays compatible with legacy cards',()=>{
 for(const extra of [{},{additionalInfo:''}]){
  const value=lib({},extra);assert.equal(E.validateLibrary(value),value);
  const q=E.makeTest(value.decks[0].cards,'forward',['written'],1)[0];assert.equal(q.additionalInfo,'');
  q.input=q.answer;assert.ok(E.grade(q));
 }
});
await test('Imported additional information must be a string when supplied',()=>{
 assert.equal(E.validateLibrary(lib({}, {additionalInfo:'Optional prompt context.'})).decks[0].cards[0].additionalInfo,'Optional prompt context.');
 for(const additionalInfo of [null,42,false,[],{}])assert.throws(()=>E.validateLibrary(lib({}, {additionalInfo})),/additional information must be text/);
});
console.log(`\n${passed} passed; ${failed} failed`);
process.exitCode=failed?1:0;

