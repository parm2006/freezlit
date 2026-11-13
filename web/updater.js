const action=document.querySelector('#action'),status=document.querySelector('#status'),progress=document.querySelector('#progress');
let state={stage:'checking'},poll;
function render(next){
 state=next;
 document.querySelector('#version').textContent=state.current?`Installed version ${state.current}`:'Keep your study space up to date.';
 document.querySelector('#heading').textContent={idle:'Ready to check',checking:'Checking for updates…',available:`Version ${state.version} is available`,downloading:'Downloading update…',ready:'Ready to install',applying:'Installing update…',current:'You’re up to date',error:'Update needs attention'}[state.stage];
 status.textContent=state.message;
 progress.hidden=state.stage!=='downloading';progress.value=state.progress;
 action.disabled=['checking','downloading','applying'].includes(state.stage);
 action.textContent={checking:'Checking…',available:'Download update',downloading:`Downloading · ${state.progress}%`,ready:'Install and reopen',applying:'Installing…'}[state.stage]||'Check again';
}
async function run(method){
 action.disabled=true;
 try{render(await window.pywebview.api[method]())}
 catch{render({...state,stage:'error',message:'The updater could not finish. Close this window and try again.'})}
}
action.addEventListener('click',()=>run(state.stage==='available'?'download':state.stage==='ready'?'install':'check'));
window.addEventListener('pywebviewready',()=>{
 poll=setInterval(async()=>{try{render(await window.pywebview.api.state())}catch{}},250);
 run('check');
},{once:true});
window.addEventListener('pagehide',()=>clearInterval(poll));
