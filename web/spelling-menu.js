const wordPattern=/\p{L}[\p{L}\p{M}]*(?:['’-][\p{L}\p{M}]+)*/gu;
export function wordAt(text,index){
 for(const match of text.matchAll(wordPattern))if(index>=match.index&&index<=match.index+match[0].length)return {word:match[0],start:match.index,end:match.index+match[0].length};
 return null;
}
// A temporary text-only mirror locates a right-click accurately in wrapped/scrolled fields.
export function wordAtPoint(field,x,y){
 const style=getComputedStyle(field),rect=field.getBoundingClientRect(),mirror=document.createElement('div');
 for(const name of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textTransform','textIndent','textAlign','direction','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing','wordBreak','overflowWrap','tabSize'])mirror.style[name]=style[name];
 Object.assign(mirror.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',whiteSpace:field.tagName==='TEXTAREA'?'pre-wrap':'pre',overflow:'hidden',borderStyle:'solid',opacity:'0',pointerEvents:'none'});
 let previous=0;const words=[];
 for(const match of field.value.matchAll(wordPattern)){
  mirror.append(document.createTextNode(field.value.slice(previous,match.index)));
  const span=document.createElement('span');span.textContent=match[0];mirror.append(span);
  words.push({span,word:match[0],start:match.index,end:match.index+match[0].length});previous=match.index+match[0].length;
 }
 mirror.append(document.createTextNode(field.value.slice(previous)));
 const scrollbar=Math.max(0,field.offsetWidth-field.clientWidth-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth));mirror.style.width=rect.width-scrollbar+'px';
 document.body.append(mirror);
 mirror.scrollTop=field.scrollTop;mirror.scrollLeft=field.scrollLeft;
 try{for(const {span,...word} of words)for(const box of span.getClientRects())if(x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom)return word;return null}
 finally{mirror.remove()}
}
export function enableSpellingMenu(root,{suggest=word=>window.pywebview.api.spelling_suggestions(word),available=()=>typeof window.pywebview?.api?.spelling_suggestions==='function'}={}){
 let menu=null,generation=0,returnFocus=null;
 function close(restore=false){generation++;menu?.remove();menu=null;if(restore&&returnFocus?.isConnected)returnFocus.focus()}
 root.addEventListener('contextmenu',async event=>{
  const field=event.target;
  if(!available()||!field.matches('textarea,input[type="text"],input:not([type])')||field.readOnly||field.disabled||field.spellcheck===false)return;
  const keyboard=event.clientX===0&&event.clientY===0;
  const word=keyboard?wordAt(field.value,field.selectionStart):wordAtPoint(field,event.clientX,event.clientY);
  if(!word||word.word.length>128)return;
  event.preventDefault();event.stopPropagation();close();returnFocus=field;
  const source=field.value,request=generation,rect=field.getBoundingClientRect();
  menu=document.createElement('div');menu.className='spelling-menu';menu.tabIndex=-1;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Spelling suggestions');
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Checking spelling…';menu.append(status);document.body.append(menu);
  const x=keyboard?rect.left+12:event.clientX,y=keyboard?rect.top+30:event.clientY;
  function position(){const size=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(x,innerWidth-size.width-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-size.height-8))+'px'}
  position();
  try{
   const result=await suggest(word.word);
   if(generation!==request||field.value!==source||!field.isConnected){if(generation===request)close();return}
   status.textContent=!result.available?'Windows spelling is unavailable.':result.correct?'No spelling issue found.':result.suggestions?.length?'Replace with:':'No spelling suggestions.';
   for(const correction of result.suggestions||[]){
    const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=correction;
    button.onclick=()=>{if(field.value!==source){close(true);return}field.focus();field.setRangeText(correction,word.start,word.end,'end');close();field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:correction}))};menu.append(button);
   }
  }catch{if(generation===request&&menu)status.textContent='Could not check spelling. Try again.'}
  if(generation!==request||!menu)return;
  position();
  if(keyboard){const first=menu.querySelector('button');if(first)first.focus();else menu.focus()}
 });
 document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target))close()},true);
 root.addEventListener('input',()=>close());
 document.addEventListener('keydown',e=>{
  if(!menu)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return}
  if(!menu.contains(e.target))return;
  const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(!buttons.length)return;
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}
 },true);
 document.addEventListener('scroll',e=>{if(menu&&!menu.contains(e.target))close()},true);
 window.addEventListener('resize',()=>close());
}
