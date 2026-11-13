export async function confirmAction({title,message,confirmLabel,danger=false}){
 if(document.querySelector('.confirm-dialog[open]'))return false;
 const dialog=document.createElement('dialog');
 dialog.className='confirm-dialog';
 dialog.setAttribute('role','alertdialog');
 dialog.setAttribute('aria-labelledby','confirm-title');
 dialog.setAttribute('aria-describedby','confirm-message');
 dialog.innerHTML='<h2 id="confirm-title"></h2><p id="confirm-message"></p><div class="confirm-actions"><button type="button" class="secondary" autofocus>Cancel</button><button type="button" class="primary"></button></div>';
 dialog.querySelector('h2').textContent=title;
 dialog.querySelector('p').textContent=message;
 const [cancel,confirm]=dialog.querySelectorAll('button');
 confirm.textContent=confirmLabel;
 if(danger)confirm.classList.add('confirm-danger');
 cancel.onclick=()=>dialog.close('cancel');
 confirm.onclick=()=>dialog.close('confirm');
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&(event.shiftKey&&document.activeElement===cancel||!event.shiftKey&&document.activeElement===confirm)){
   event.preventDefault();
   (event.shiftKey?confirm:cancel).focus();
  }
 });
 document.body.append(dialog);
 return new Promise(resolve=>{
  dialog.addEventListener('close',()=>{
   dialog.remove();
   resolve(dialog.returnValue==='confirm');
  },{once:true});
  dialog.showModal();
 });
}
