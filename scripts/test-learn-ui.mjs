import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {flattenLibrary} from '../web/storage-delta.js';

const now=Date.now();
const library={version:1,settings:{newLimit:7,reviewLimit:200},history:[],records:{},decks:[{id:'learn-test',title:'Learn test',cards:Array.from({length:9},(_,i)=>({id:String(i),term:`Term ${i}`,definition:`Answer ${i}`,schedule:{},...(i===8?{learnSchedule:{forward:{box:1,due:now-1000}}}:{})}))}]};
library.decks[0].cards[0].definition='Alpha | Beta';
for(const card of library.decks[0].cards)card.additionalInfo=`Synthetic hint ${card.id}`;
const records=flattenLibrary(library);
const snapshot=()=>{
 const root=JSON.parse(records.get(JSON.stringify(['root'])));
 return {...root,decks:root.decks.map(id=>{const d=JSON.parse(records.get(JSON.stringify(['deck',id])));return {...d.meta,cards:d.cards.map(c=>JSON.parse(records.get(JSON.stringify(['deckCard',id,c]))))}})};
};
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/state'){
   if(req.method==='PUT'){
    let body='';for await(const chunk of req)body+=chunk;
    const delta=JSON.parse(body);for(const [key,value] of delta.set)records.set(key,JSON.stringify(value));for(const key of delta.remove)records.delete(key);
   }
   res.writeHead(200,{'Content-Type':'application/json','ETag':'0'});res.end(JSON.stringify(req.method==='GET'?snapshot():{ok:true}));return;
  }
  const file=path==='/'?'index.html':path.slice(1);
  if(!/^[a-zA-Z0-9_.-]+$/.test(file)){res.writeHead(404);res.end();return}
  const bytes=await readFile(new URL('../web/'+file,import.meta.url));
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(bytes);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const hints=page.getByRole('checkbox',{name:'Additional info',exact:true});
 assert.equal(await hints.isChecked(),true);
 await page.locator('.additional-info').waitFor({state:'visible'});
 await hints.uncheck();assert.equal(await page.locator('.additional-info').isVisible(),false);
 await mkdir(new URL('../build/qa-results/',import.meta.url),{recursive:true});
 for(const width of [1180,760]){
  await page.setViewportSize({width,height:800});
  assert.equal(await hints.isVisible(),true);
  await page.screenshot({path:fileURLToPath(new URL(`../build/qa-results/hints-toolbar-${width}.png`,import.meta.url))});
 }
 await page.setViewportSize({width:1180,height:800});
 await page.locator('[data-mode="learn"]').click();
 await page.locator('#random').uncheck();
 await page.locator('[data-action="start"]').click();
 assert.equal(await page.locator('.question-face').innerText(),'Term 8','Due cards come first');
 await page.locator('#answer').fill('Partial answer');
 await hints.check();await page.locator('.additional-info').waitFor({state:'visible'});
 assert.equal(await page.locator('#answer').inputValue(),'Partial answer');
 await hints.uncheck();assert.equal(await page.locator('.additional-info').isVisible(),false);
 assert.equal(await page.locator('#answer').inputValue(),'Partial answer');
 const answer=async(wrong=false,accept=false)=>{
  const term=await page.locator('.question-face').innerText();
  const expected=library.decks[0].cards.find(c=>c.term===term).definition;
  if(await page.locator('#answer').count()){
   await page.locator('#answer').fill(wrong?'wrong':expected.split('|')[0].trim().toLowerCase());await page.locator('#answer-form').press('Enter');
  }else{
   const choices=page.locator('[data-action="answer"]');
   assert.equal(await choices.count(),4,'Distractors come from the whole deck even for a small remaining batch');
   await (wrong?choices.filter({hasNotText:expected}).first():choices.filter({hasText:expected})).click();
  }
  if(accept){
   await page.locator('[data-action="accept-practice"]').click();
   assert.equal(await page.locator('.feedback').count(),0,'Accepting a correction immediately advances');
  }else{
   if(!wrong)await page.locator('.feedback.success').waitFor();
   await page.locator('[data-action="continue"]').click();
  }
  return term;
 };
 await answer();assert.equal(await page.locator('.question-face').innerText(),'Term 0');
 const firstBatch=new Set();for(let i=0;i<10;i++)firstBatch.add(await answer());
 assert.deepEqual([...firstBatch].sort(),['Term 0','Term 1','Term 2','Term 3','Term 4']);
 assert.equal(await page.locator('.question-face').innerText(),'Term 5');
 await answer(true,true);for(let i=0;i<3;i++)await answer();
 // Seven learned cards now appear in the final shuffled check.
 const final=new Set();for(let i=0;i<7;i++)final.add(await answer());
 assert.equal(final.size,7);await page.getByRole('heading',{name:'Learning complete.'}).waitFor();
 await page.evaluate(()=>window.freezlitFlushPendingWork());
 const saved=snapshot().decks[0].cards;
 assert.equal(saved[8].learnSchedule.forward.box,2);
 assert.ok(saved.slice(0,7).every(c=>c.learnSchedule.forward.box===1&&c.learnSchedule.forward.checkedAt));
 assert.equal(saved[7].learnSchedule,undefined);
 assert.equal(snapshot().history.find(h=>h.cardId==='5').ok,true,'Correction updates the original history entry');
 await page.reload();await page.locator('[data-mode="learn"]').click();await page.locator('[data-action="start"]').click();
 await page.getByRole('heading',{name:'Learning complete.'}).waitFor();
 assert.equal(await hints.isChecked(),false,'Hint visibility survives reload');
 assert.ok(snapshot().decks[0].cards.every(c=>c.additionalInfo===`Synthetic hint ${c.id}`));
 await page.locator('[data-mode="test"]').click();
 for(const type of ['choice','tf','matching'])await page.locator(`[data-test-type="${type}"]`).uncheck();
 await page.locator('#test-count').fill('2');await page.locator('[data-action="start"]').click();
 await page.locator('input[name="q0"]').fill('Unfinished test answer');
 assert.equal(await page.locator('.additional-info:visible').count(),0);
 await hints.check();assert.equal(await page.locator('.additional-info:visible').count(),2);
 assert.equal(await page.locator('input[name="q0"]').inputValue(),'Unfinished test answer');
 assert.deepEqual(errors,[]);
 console.log('PASS Learn UI: saved hint toggle without answer loss, alternate answers, full-deck choices, correction advance, batches, consolidation, saved quota');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
