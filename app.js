/* Three role-specific interfaces over the encrypted static portal. */
'use strict';
const ICONS = Object.freeze({
  book:'M3 4c3-1 6-1 9 1v16c-3-2-6-2-9-1V4Zm18 0c-3-1-6-1-9 1v16c3-2 6-2 9-1V4Z',
  home:'m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  message:'M21 11a9 9 0 0 1-9 9c-2 0-3-.4-4-1l-5 2 1.5-5A9 9 0 1 1 21 11ZM8 11h.01M12 11h.01M16 11h.01',
  graduation:'m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6M22 9v7',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  logout:'M9 4H4v16h5M13 8l4 4-4 4M8 12h14',
  lock:'M6 10h12v11H6V10Zm2 0V7a4 4 0 0 1 8 0v3M12 14v3',
  user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2H4Z',
  users:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-2a7 7 0 0 1 14 0v2H5ZM19 4a3 3 0 0 1 0 6M21 14a5 5 0 0 1 2 5M5 4a3 3 0 0 0 0 6M3 14a5 5 0 0 0-2 5',
  'user-plus':'M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM2 21v-2a8 8 0 0 1 13-6M19 13v8M15 17h8',
  settings:'m9 3 1-1h4l1 3 3 1 3 1v4l-2 2v3l-2 2-3-1-2 2-3-1-2-2-3-1v-4l2-2V7l3-1V3Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  folder:'M3 6h6l2 3h10v12H3V6Zm0 3V4h7l2 2h8v3',
  chart:'M4 3v18h17M8 17v-5M13 17V7M18 17v-8',
  calendar:'M4 5h16v16H4V5ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2',
  search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
  plus:'M12 5v14M5 12h14', close:'m6 6 12 12M6 18 18 6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  refresh:'M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M16 16h5v5',
  'arrow-left':'M20 12H4m7-7-7 7 7 7',
  'check-circle':'M21 12a9 9 0 1 1-2-6M8 11l4 4 9-10',
  help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01',
  megaphone:'m3 10 17-6v16L3 14v-4Zm5 5 2 6H6l-2-7M20 9h2v6h-2',
  sparkles:'m12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6ZM20 2v4M18 4h4',
  paperclip:'m8 13 7-7a4 4 0 0 1 6 6L10 22a6 6 0 0 1-8-8L12 4M6 15l8-8a1 1 0 0 1 2 2l-8 8a2 2 0 0 1-3-3',
  pin:'m8 3 9 3-2 5 3 4-1 2-6-2-4 2-2-2 4-4-1-8ZM9 15l-6 6',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  file:'M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8M8 17h6',
  image:'M3 3h18v18H3V3Zm0 13 5-5 5 5 3-3 5 5M16 7h.01',
  send:'m3 3 19 9-19 9 4-9-4-9Zm4 9h15',
  key:'M15 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-1 3 8 8-3 3-3-3 2-2-3-3',
  edit:'m15 3 6 6-12 12H3v-6L15 3Zm-2 2 6 6',
  trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 3',
  'qr-code':'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm2-9v3h3V5H5Zm11 0v3h3V5h-3ZM5 16v3h3v-3H5Zm9-2h2v2h-2v-2Zm4 0h3v3h-3v-3Zm-4 4h2v3h-2v-3Zm4 2h3v3h-3v-3Z'
});
const ROLE_LABELS = Object.freeze({ student:'دانش‌آموز', teacher:'دبیر', admin:'دبیر اصلی' });
const VIEWS = Object.freeze({
  messages:{ title:'پیام‌ها و اطلاعیه‌ها', kicker:'ارتباط با مدرسه', description:'آخرین خبرها و پیام‌های مدرسه را اینجا دنبال کنید.', icon:'message' },
  scores:{ title:'کارنامه و نمره‌ها', kicker:'مسیر یادگیری', description:'نمره‌ها، فعالیت‌ها و بازخوردهای آموزشی در یک نگاه.', icon:'chart' },
  accounts:{ title:'مدیریت حساب‌ها', kicker:'مدیریت مدرسه', description:'حساب‌های مدرسه و دسترسی دبیران را مدیریت کنید.', icon:'users' },
  roster:{ title:'کلاس‌های من', kicker:'آموزش و یادگیری', description:'با دانش‌آموزان کلاس‌های خود در ارتباط باشید.', icon:'graduation' },
  files:{ title:'فایل‌های من', kicker:'کتابخانه شخصی', description:'پیوست‌های دریافتی و فایل‌های آموزشی شما.', icon:'folder' },
  settings:{ title:'تنظیمات', kicker:'حساب شخصی', description:'پروفایل و تنظیمات فضای مدرسه را مدیریت کنید.', icon:'settings' }
});
function element(tag, className, text) { const node=document.createElement(tag); if(className)node.className=className; if(text!==undefined)node.textContent=text; return node; }
function icon(name) { const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',ICONS[name]||ICONS.file);svg.append(path);return svg; }
function decorate(scope=document) { scope.querySelectorAll('[data-icon]').forEach(node=>node.replaceChildren(icon(node.dataset.icon))); }
function button(label, symbol, callback, className='button subtle') { const node=element('button',className);node.type='button';if(symbol)node.append(icon(symbol));if(label)node.append(document.createTextNode(label));node.addEventListener('click',callback);return node; }
const number=value=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2}).format(value);
const htmlSafe=value=>String(value??'').replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));
const formatDate=(value,time=false)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('fa-IR',time?{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}:{year:'numeric',month:'short',day:'numeric'}).format(date);};
const fileSize=size=>size>=1048576?`${number(size/1048576)} مگابایت`:`${number(Math.max(1,size/1024))} کیلوبایت`;
const initials=name=>String(name||'ص').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('');
const fitWithin=(width,height,maxEdge=768)=>{const scale=Math.min(1,maxEdge/Math.max(width,height));return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),scale};};
const blobFromCanvas=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('مرورگر نتوانست تصویر را آماده کند.')),type,quality));
async function optimizeUploadImage(file,maxEdge=768){
  if(!file?.type||!['image/jpeg','image/png','image/webp'].includes(file.type))return file;
  if(file.size>40*1024*1024)throw new Error('فایل تصویر اصلی از ۴۰ مگابایت بزرگ‌تر است.');
  if(typeof createImageBitmap!=='function')return file;
  const bitmap=await createImageBitmap(file);
  try{
    if(bitmap.width*bitmap.height>60000000)throw new Error('ابعاد تصویر برای پردازش بیش از اندازه بزرگ است.');
    const fitted=fitWithin(bitmap.width,bitmap.height,maxEdge);
    if(fitted.scale===1&&file.size<=1.5*1024*1024)return file;
    const canvas=document.createElement('canvas');canvas.width=fitted.width;canvas.height=fitted.height;
    const context=canvas.getContext('2d',{alpha:file.type!=='image/jpeg'});if(!context)throw new Error('پردازش تصویر در این مرورگر در دسترس نیست.');
    if(file.type==='image/jpeg'){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let type=file.type==='image/png'&&file.size>1.5*1024*1024?'image/webp':file.type;
    let blob=await blobFromCanvas(canvas,type,type==='image/png'?undefined:.86);
    if(type==='image/webp'&&blob.type!=='image/webp'){type='image/png';blob=await blobFromCanvas(canvas,type);}
    if(blob.size>8*1024*1024&&type!=='image/webp'){
      const webp=await blobFromCanvas(canvas,'image/webp',.78);
      if(webp.type==='image/webp'&&webp.size<blob.size){blob=webp;type='image/webp';}
    }
    const extension=type==='image/jpeg'?'jpg':type==='image/webp'?'webp':'png';
    const original=String(file.name||'image').replace(/\.[^.]+$/,'');
    const name=type===file.type?file.name:`${original}.${extension}`;
    return new File([blob],name,{type,lastModified:file.lastModified||Date.now()});
  }finally{bitmap.close?.();}
}
function errorText(error) {
  if(error?.code==='PUBLISHING_PENDING')return 'ابتدا منتظر نتیجه درخواست قبلی بمانید؛ سپس دوباره ارسال کنید.';
  const messages={QR_INVALID:'کد QR نامعتبر است یا دسترسی آن باطل شده است.',UNSUPPORTED_COMPRESSION:'این مرورگر از باز کردن داده فشرده پشتیبانی نمی‌کند.',LOGIN_FAILED:'کلید ورود یا رمز عبور درست نیست.',NETWORK:'ارتباط با مخزن مدرسه برقرار نشد. دوباره تلاش کنید.',NOT_FOUND:'اطلاعات هنوز منتشر نشده است.',ADMIN_REQUIRED:'دسترسی امن مدیریت برقرار نیست؛ تنظیم سرویس مدرسه را بررسی کنید.',FORBIDDEN:'این عملیات برای حساب شما مجاز نیست.',CONFLICT:'اطلاعات هم‌زمان تغییر کرده است. تازه‌سازی کنید و دوباره تغییر دهید.',SESSION_REVOKED:'ورود شما منقضی شده است. با مشخصات فعلی دوباره وارد شوید.',PUBLISHING_SETUP:'انتشار پیام هنوز راه‌اندازی نشده است. با مدیر مدرسه هماهنگ کنید.',PUBLISHING_FAILED:'ارسال به سرویس انتشار انجام نشد. تنظیمات انتشار را بررسی کنید.',TAMPERED:'اعتبار فایل یا پیام تأیید نشد.',KEYS_REQUIRED:'کلید این حساب در دسترس نیست. پشتیبان کلیدها را بازیابی کنید.',PUBLISHING_SETUP:'سرویس امن مدرسه هنوز راه‌اندازی نشده است؛ با مسئول سامانه تماس بگیرید.'};
  return messages[error?.code]||error?.message||'عملیات انجام نشد. دوباره تلاش کنید.';
}

class SchoolUI {
  constructor(portal) { this.portal=portal;this.view=null;this.accounts=[];this.currentView='messages';this.messageFilter='all';this.accountFilter='all';this.page=1;this.files=[];this.urls=new Set();this.avatarUrl='';this.avatarDescriptorKey='';this.cropState=null;this.cropSourceUrl='';this.croppedAvatarFile=null;this.croppedAvatarUrl='';this.settingsAccountId='';this.settingsDraftDirty=new Set();this.profileUpdatePending=false;this.profileAvatarPending=false;this.preparingFiles=false;this.epoch=0;this.refreshing=false;this.busy=false;this.pending=false;this.toastTimer=null;this.currentQr=null; }
  $(id){return document.getElementById(id);}
  status(id,text,type=''){const node=this.$(id);node.textContent=text;node.className=`form-status ${type}`;}
  notice(text,type=''){const node=this.$('globalStatus');node.textContent=text;node.className=`notice ${type}`;if(!text)node.classList.add('hidden');}
  toast(text){const node=this.$('toast');node.textContent=text;node.classList.remove('hidden');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>node.classList.add('hidden'),5000);}
  isStaff(){return this.view&&['admin','teacher'].includes(this.view.role);}
  accessibleViews(){return this.view?.role==='admin'?['messages','roster','scores','files','settings']:this.view?.role==='teacher'?['messages','roster','scores','files','settings']:['messages','scores','files'];}
  async init(){
    decorate();this.$('headerDate').textContent=formatDate(new Date());
    const configuredSchoolName=globalThis.SALEHIN_CONFIG?.schoolName||'مدرسه صالحین';
    if(this.$('modernBrandName'))this.$('modernBrandName').textContent=configuredSchoolName;
    document.title=`${configuredSchoolName} | سامانه مدرسه`;
    this.bindModernInterface();
    this.selectLoginRole('student');
    document.querySelectorAll('[data-close-dialog]').forEach(node=>node.addEventListener('click',()=>{if(!this.busy)this.$(node.dataset.closeDialog).close();}));
    document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(this.busy)event.preventDefault();}));
    this.$('togglePassword').addEventListener('click',()=>{const input=this.$('loginPassword'),show=input.type==='password';input.type=show?'text':'password';this.$('togglePassword').setAttribute('aria-label',show?'پنهان کردن رمز عبور':'نمایش رمز عبور');});
    this.$('loginForm').addEventListener('submit',event=>this.login(event));
    this.$('logoutBtn').addEventListener('click',()=>this.logout());
    this.$('composeBtn').addEventListener('click',()=>this.openComposer());
    this.$('profileSettingsBtn').addEventListener('click',()=>this.navigate('settings'));
    const openProfileSettings=()=>{if(this.isStaff())this.navigate('settings');};
    this.$('profileAvatar').addEventListener('click',openProfileSettings);
    this.$('profileAvatar').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&this.isStaff()){event.preventDefault();openProfileSettings();}});
    this.$('messageSearch').addEventListener('input',()=>{this.page=1;this.renderMessages();});
    this.$('accountSearch').addEventListener('input',()=>this.renderAccounts());
    document.querySelectorAll('[data-filter]').forEach(node=>node.addEventListener('click',()=>{this.messageFilter=node.dataset.filter;this.page=1;this.renderMessages();}));
    document.querySelectorAll('[data-role-filter]').forEach(node=>node.addEventListener('click',()=>{this.accountFilter=node.dataset.roleFilter;this.renderAccounts();}));
    this.$('messageFiles').addEventListener('change',event=>this.prepareComposerFiles(Array.from(event.target.files||[]),event.target));
    this.$('settingsAvatar').addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)this.beginAvatarCrop(file);});
    this.$('cropZoom').addEventListener('input',event=>this.setCropZoom(Number(event.target.value)));
    const stage=this.$('cropStage');
    window.addEventListener('resize',()=>{if(this.cropState)this.updateCropLayout();});
    stage.addEventListener('pointerdown',event=>this.beginCropDrag(event));
    stage.addEventListener('pointermove',event=>this.moveCropDrag(event));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,()=>this.endCropDrag());
    this.$('avatarCropDialog').addEventListener('close',()=>{if(this.cropState)this.disposeCropSource();});
    this.$('applyAvatarCrop').addEventListener('click',()=>this.applyAvatarCrop());
    this.$('cancelAvatarCrop').addEventListener('click',()=>this.cancelAvatarCrop());
    this.$('cancelAvatarCropIcon').addEventListener('click',()=>this.cancelAvatarCrop());
    for(const id of ['settingsName','settingsTitle','settingsSubject','settingsSchoolName','settingsSchoolYear'])this.$(id).addEventListener('input',()=>this.settingsDraftDirty.add(id));
    this.$('selectAllRecipients').addEventListener('click',()=>{const choices=this.$('recipientChoices').querySelectorAll('input');const all=Array.from(choices).every(node=>node.checked);choices.forEach(node=>{node.checked=!all;});this.updateRecipientCount();});
    this.$('composerForm').addEventListener('submit',event=>this.sendMessage(event));
    this.$('createAccountBtn').addEventListener('click',()=>this.openAccount());
    this.$('accountRole').addEventListener('change',()=>this.accountRoleChanged());
    this.$('generateLoginKey').addEventListener('click',()=>{this.$('accountLoginKey').value=SalehinBackend.generateLoginKey();});
    this.$('accountForm').addEventListener('submit',event=>this.saveAccount(event));
    this.$('newScoreBtn').addEventListener('click',()=>this.openScore());
    this.$('scoreForm').addEventListener('submit',event=>this.saveScore(event));
    this.$('profileForm').addEventListener('submit',event=>this.saveProfile(event));
    this.$('siteForm').addEventListener('submit',event=>this.saveSite(event));
    this.$('exportKeysBtn').addEventListener('click',()=>this.exportKeys());
    this.$('importKeysFile').addEventListener('change',event=>this.importKeys(event));
    this.$('composerDialog').addEventListener('close',()=>{this.files=[];this.$('composerAttachments').replaceChildren();this.$('composerForm').reset();this.$('messageBody').value='';});
    this.$('accountDialog').addEventListener('close',()=>{this.$('accountPassword').value='';this.$('createdCredentials').replaceChildren();});
    this.$('loginBtn').disabled=true;
    if(this.portal.preview){
      // Read-only sample adapter is deliberately exempt from QR authentication so
      // the visual system can be reviewed without any real account secrets.
      try{const view=await this.portal.refreshStudent();this.applyView(view);await this.refreshDirectory();}
      catch(error){this.modernGateMessage(errorText(error),true);}
    }else{
    const qr=this.readModernQr();
    if(qr){
      // Remove bearer credentials from the address bar immediately, even if
      // the subsequent network or authorization check fails.
      if(location.hash)history.replaceState(null,'',location.pathname+location.search);
      this.$('modernGateStatus').textContent='در حال دریافت کارنامه…';
      try{
        const view=await this.portal.loginWithQr(qr.id,qr.key,qr.revision||'');
        await this.authorizeStaffEntry(view);
        try{sessionStorage.setItem('salehinsc-qr-session',JSON.stringify(qr));}catch{}
        this.applyView(view);await this.refreshDirectory();
      }catch(error){
        try{sessionStorage.removeItem('salehinsc-qr-session');}catch{}
        await this.portal.logout().catch(()=>{});
        this.modernGateMessage(errorText(error),true);
      }
    }else{
      let stored=null;try{stored=JSON.parse(sessionStorage.getItem('salehinsc-qr-session')||'null');}catch{}
      if(stored?.id&&stored?.key){
        try{const view=await this.portal.loginWithQr(stored.id,stored.key,stored.revision||'');await this.authorizeStaffEntry(view);this.applyView(view);await this.refreshDirectory();}
        catch(error){try{sessionStorage.removeItem('salehinsc-qr-session');}catch{}await this.portal.logout().catch(()=>{});this.modernGateMessage(errorText(error),true);}
      }else{
        await this.portal.logout().catch(()=>{});
        this.clearSession();
        this.modernGateMessage('دانش‌آموزان با QR شخصی وارد می‌شوند؛ دبیر اصلی فایل خصوصی teacher.html را باز می‌کند.');
      }
    }
    }
    this.$('loginBtn').disabled=false;
    // Conditional catalog requests make near-live synchronization inexpensive.
    this.poll=setInterval(()=>{if(this.view&&!this.busy&&document.visibilityState==='visible')this.refresh({quiet:true});},this.portal.preview?600000:10000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&this.view&&!this.busy)this.refresh({quiet:true});});
    if('serviceWorker'in navigator&&location.protocol==='https:'&&!this.portal.preview)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
  }
  async authorizeStaffEntry(view){
    // The local teacher launcher is the normal staff entry, but repeat the Worker
    // authorization after redirect/reload so a forged sessionStorage value cannot
    // bypass the primary-teacher allowlist. Student QR access stays separate.
    if(view?.role==='admin'&&!this.portal.admin)await this.portal.connectAdmin();
    else if(view?.role==='teacher')await this.portal.connectTeacher();
    return view;
  }
  readModernQr(){
    return this.parseQrValue(location.hash)||(()=>{try{return JSON.parse(sessionStorage.getItem('salehinsc-qr-session')||'null');}catch{return null;}})();
  }
  applicationBaseUrl(){
    const configured=globalThis.SALEHIN_CONFIG?.baseUrl;
    return new URL(configured || './', location.href);
  }
  studentQrUrl(entry){
    const url=this.applicationBaseUrl();
    url.hash=SalehinBackend.makeQrFragment(entry.id,entry.key,entry.revision||entry.qrRevision||'').replace(/^#/,'');
    return url.href;
  }
  bindModernInterface(){
    this.$('modernRefresh').addEventListener('click',()=>this.refresh({quiet:false}));
    this.$('modernSettings').addEventListener('click',()=>this.openModernSettings());
    this.$('modernTestGithub').addEventListener('click',()=>this.testModernGithubConnection());
    this.$('modernCopySetToken').addEventListener('click',()=>this.copyModernText('npx wrangler secret put GITHUB_TOKEN'));
    this.$('modernCopyRemoveToken').addEventListener('click',()=>this.copyModernText('npx wrangler secret delete GITHUB_TOKEN'));
    this.$('modernEndView').addEventListener('click',async()=>{try{sessionStorage.removeItem('salehinsc-qr-session');}catch{}await this.logout();});
    document.querySelectorAll('[data-modern-tab]').forEach(node=>node.addEventListener('click',()=>this.setModernTab(node.dataset.modernTab)));
    document.querySelectorAll('[data-modern-close]').forEach(node=>node.addEventListener('click',()=>this.$(node.dataset.modernClose).close()));
    this.$('modernAddStudent').addEventListener('click',()=>this.openModernAddStudent());
    this.$('modernAddStudentForm').addEventListener('submit',event=>this.createModernStudent(event));
    this.$('modernRosterSearch').addEventListener('input',()=>this.renderModernRoster());
    this.$('modernRosterClass').addEventListener('change',()=>this.renderModernRoster());
    this.$('modernShowDisabled').addEventListener('change',()=>this.renderModernRoster());
    this.$('modernStudentForm').addEventListener('submit',event=>this.saveModernStudent(event));
    this.$('modernDetailAddScore').addEventListener('click',()=>{const student=this.currentStudent;this.$('modernStudentDialog').close();if(student)this.openModernScore(student.id);});
    this.$('modernDetailMessage').addEventListener('click',()=>{const student=this.currentStudent;this.$('modernStudentDialog').close();if(student)this.openModernMessage(student.id);});
    this.$('modernCopyQrLink').addEventListener('click',()=>this.copyModernQrLink());
    this.$('modernDownloadQr').addEventListener('click',()=>{if(this.currentQrSvg)this.download('salehin-student-qr.svg',new Blob([this.currentQrSvg],{type:'image/svg+xml'}));});
    this.$('modernComposeBroadcast').addEventListener('click',()=>this.openModernMessage('__all__'));
    this.$('modernAddScore').addEventListener('click',()=>this.openModernScore());
    this.$('modernComposeMessage').addEventListener('click',()=>this.openModernMessage());
    this.$('modernExportQr').addEventListener('click',()=>this.exportModernQrCards());
    this.$('modernTeacherFile').addEventListener('click',()=>this.downloadTeacherLocalFile());
    this.$('modernPrintQrPaper').addEventListener('click',()=>this.printCurrentQr());
    this.$('modernRotateStudentQr').addEventListener('click',()=>this.rotateCurrentStudentQr());
    this.$('modernScoreForm').addEventListener('submit',event=>this.saveModernScore(event));
    this.$('modernMessageForm').addEventListener('submit',event=>this.saveModernMessage(event));
    for(const id of ['modernScoreDialog','modernMessageDialog','modernStudentDialog','modernAddStudentDialog','modernQrDialog','modernSettingsDialog'])this.$(id).addEventListener('cancel',event=>{if(this.busy)event.preventDefault();});
  }
  parseQrValue(raw){
    if(!raw)return null;
    let candidate=String(raw).trim();
    try{if(candidate.includes('://'))candidate=new URL(candidate).hash;}catch{return null;}
    const text=candidate.replace(/^#/,'').replace(/^\?/,'');
    const params=new URLSearchParams(text);
    const id=params.get('s')||params.get('id')||'';
    const key=params.get('k')||params.get('key')||'';
    const revision=params.get('r')||'';
    return /^[a-f0-9]{64}$/.test(id)&&/^[A-Za-z0-9_-]{40,48}$/.test(key)&&(!revision||/^[a-f0-9]{32}$/.test(revision))?{id,key,revision}:null;
  }
  openModernSettings(){
    if(this.view?.role!=='admin')return;
    const config=globalThis.SALEHIN_CONFIG||{};
    this.$('modernGithubOwner').value=config.owner||'—';
    this.$('modernGithubRepo').value=config.repo||'—';
    this.$('modernGithubBranch').value=config.branch||'—';
    this.$('modernGithubApi').value=config.apiUrl||'تنظیم نشده';
    const state=this.$('modernTokenState');
    state.textContent=this.portal.admin?'توکن در Worker پیکربندی شده':'وضعیت هنوز تأیید نشده';
    state.classList.toggle('is-ready',Boolean(this.portal.admin));
    state.classList.remove('is-error');
    this.status('modernGithubSettingsStatus',this.portal.admin?'آخرین اتصال موفق بوده است. برای بررسی دوباره، «آزمایش اتصال» را بزنید.':'برای بررسی اتصال، سرویس Worker باید در دسترس باشد.');
    this.$('modernSettingsDialog').showModal();
  }
  async copyModernText(value){
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
      else{const input=document.createElement('textarea');input.value=value;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw new Error('copy');}
      this.status('modernGithubSettingsStatus','دستور در کلیپ‌بورد کپی شد. آن را در PowerShell، داخل پوشه پروژه اجرا کنید.','success');
    }catch{this.status('modernGithubSettingsStatus','کپی خودکار در دسترس نیست؛ دستور را از کادر بالا انتخاب کنید.','error');}
  }
  async testModernGithubConnection(){
    if(this.view?.role!=='admin'||this.busy)return;
    const button=this.$('modernTestGithub'),state=this.$('modernTokenState');
    this.busy=true;button.disabled=true;button.textContent='در حال بررسی…';
    this.status('modernGithubSettingsStatus','در حال بررسی اعتبار Worker، مخزن، شاخه و مسیر انتشار…');
    try{
      const result=await this.portal.testConnection();
      state.textContent='توکن پذیرفته شد';state.classList.add('is-ready');state.classList.remove('is-error');
      const checks=result.checks||{};
      const detail=[`مخزن ${result.repository}` ,`شاخه ${result.branch}`,'فهرست مدرسه قابل خواندن است','دسترسی API پیام‌ها و گردش‌کار بررسی شد'];
      this.status('modernGithubSettingsStatus',`اتصال موفق بود. ${detail.join(' · ')}. دسترسی نوشتن واقعی هنگام ثبت تغییر یا اجرای گردش‌کار نهایی تأیید می‌شود.`,'success');
      this.$('modernConnection').textContent='متصل به GitHub';
      this.$('modernGithubSetup').hidden=true;
    }catch(error){
      state.textContent='اتصال ناموفق';state.classList.remove('is-ready');state.classList.add('is-error');
      this.status('modernGithubSettingsStatus',errorText(error),'error');
    }finally{this.busy=false;button.disabled=false;button.textContent='آزمایش اتصال';}
  }
  ensureModernWriteAccess(){
    if(this.view?.offline){this.modernNotice('برای ثبت تغییرات، اتصال اینترنت لازم است.',true);return false;}
    if(this.view?.role==='admin'&&!this.portal.admin&&!this.portal.preview){
      this.$('modernGithubSetup').hidden=false;
      this.status('modernGithubStatus','نشانی سرویس امن تعریف نشده یا Worker پاسخ نمی‌دهد. تنظیمات استقرار را بررسی کنید.','error');
      this.$('modernGithubSetup').scrollIntoView({behavior:'smooth',block:'center'});
      return false;
    }
    return true;
  }
  renderModernRoster(){
    const target=this.$('modernRoster');if(!target)return;
    const query=this.$('modernRosterSearch').value.trim().toLocaleLowerCase('fa');
    const showDisabled=this.$('modernShowDisabled').checked;
    const all=this.accounts.filter(account=>(account.role||'student')==='student');
    const classFilter=this.$('modernRosterClass');
    const selectedClass=classFilter.value;
    const classes=[...new Set(all.map(item=>String(item.grade||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa'));
    const allClasses=element('option','','همه کلاس‌ها');allClasses.value='';classFilter.replaceChildren(allClasses);
    classes.forEach(grade=>{const option=element('option','',grade);option.value=grade;classFilter.append(option);});
    classFilter.value=classes.includes(selectedClass)?selectedClass:'';
    const students=all.filter(account=>(showDisabled||!account.disabled)&&(!classFilter.value||String(account.grade||'').trim()===classFilter.value)&&`${account.name||''} ${account.grade||''}`.toLocaleLowerCase('fa').includes(query));
    this.$('modernRosterCount').textContent=`${number(students.length)} دانش‌آموز`;
    target.replaceChildren();
    if(!students.length){this.modernEmpty(target,query||classFilter.value?'دانش‌آموزی پیدا نشد':showDisabled?'هنوز دانش‌آموزی ثبت نشده است':'هنوز دانش‌آموز فعالی ثبت نشده است','از گزینه «افزودن دانش‌آموز» برای ساخت اولین پرونده استفاده کنید.');return;}
    for(const student of students){
      const row=element('article',`modern-student-row${student.disabled?' is-disabled':''}`);
      const avatar=element('span','modern-student-avatar',initials(student.name));
      const details=element('div','modern-student-info');details.append(element('strong','',student.name||'بدون نام'),element('small','',student.grade||'پایه ثبت نشده'));
      const actions=element('div','modern-student-actions');
      const qr=button('QR','',()=>this.showModernStudentQr(student),'modern-action secondary');qr.setAttribute('aria-label',`نمایش QR ${student.name}`);qr.disabled=Boolean(student.disabled)||Boolean(this.portal.preview);
      const edit=button('سوابق / ویرایش','',()=>this.openModernStudent(student),'modern-action secondary');edit.disabled=Boolean(this.portal.preview);
      const remove=button(student.disabled?'فعال‌سازی':'غیرفعال‌سازی','',()=>this.toggleModernStudent(student),'modern-action '+(student.disabled?'secondary':'remove'));remove.disabled=Boolean(this.portal.preview);
      actions.append(qr,edit,remove);row.append(avatar,details,actions);target.append(row);
    }
  }
  async openModernAddStudent(){
    if(!this.ensureModernWriteAccess())return;
    this.$('modernAddStudentForm').reset();this.status('modernAddStudentStatus','');this.$('modernAddStudentDialog').showModal();this.$('modernNewStudentName').focus();
  }
  async createModernStudent(event){
    event.preventDefault();if(this.busy||!this.ensureModernWriteAccess())return;
    const name=this.$('modernNewStudentName').value.trim(),grade=this.$('modernNewStudentGrade').value.trim();
    if(!name||!grade)return;
    this.busy=true;this.$('modernCreateStudent').disabled=true;this.status('modernAddStudentStatus','در حال ساخت پرونده…');
    try{
      const loginKey=SalehinBackend.generateLoginKey();
      const password=SalehinBackend.generateLoginKey()+SalehinBackend.generateLoginKey();
      const result=await this.portal.createAccount({role:'student',loginKey,password,profile:{name,grade}});
      this.$('modernAddStudentDialog').close();await this.refreshDirectory();
      this.showModernQrLink(name,this.studentQrUrl({id:result.id,key:result.qrKey,revision:result.qrRevision}));
      this.toast('دانش‌آموز اضافه شد. QR را خصوصی تحویل دهید.');
    }catch(error){this.status('modernAddStudentStatus',errorText(error),'error');}
    finally{this.busy=false;this.$('modernCreateStudent').disabled=false;}
  }
  async toggleModernStudent(student){
    if(!this.ensureModernWriteAccess())return;
    const nextDisabled=!student.disabled;
    const accepted=await this.confirm(nextDisabled?`دسترسی «${student.name}» غیرفعال شود؟ QR قبلی دیگر کار نخواهد کرد.`:`دسترسی «${student.name}» دوباره فعال شود؟`);
    if(!accepted)return;
    try{await this.portal.updateAccount(student.id,{disabled:nextDisabled,expectedRevision:student.revision});await this.refreshDirectory();this.renderModernRoster();this.toast(nextDisabled?'دسترسی دانش‌آموز غیرفعال شد.':'دسترسی دانش‌آموز فعال شد.');}
    catch(error){this.toast(errorText(error));}
  }
  async showModernStudentQr(student){
    if(this.busy)return;
    try{
      this.busy=true;const entries=await this.portal.exportQrCredentials();const entry=entries.find(item=>item.id===student.id);
      if(!entry)throw new Error('کد QR فعال این دانش‌آموز پیدا نشد.');
      const url=this.studentQrUrl(entry);
      this.showModernQrLink(student.name,url,{kind:'student',grade:student.grade,id:student.id});
    }catch(error){this.toast(errorText(error));}
    finally{this.busy=false;}
  }
  showModernQrLink(name,url,options={}){
    this.currentQr={name,url,kind:options.kind||'student',grade:options.grade||'',id:options.id||''};
    this.currentQrSvg=SalehinQRCode.toSvg(url);
    this.$('modernQrTitle').textContent=`QR · ${name}`;
    this.$('modernQrLink').value=url;
    this.$('modernQrLinkField').hidden=false;
    this.$('modernCopyQrLink').hidden=false;
    this.$('modernRotateStudentQr').hidden=!this.currentQr.id;
    this.$('modernQrDescription').textContent='این QR کلید خصوصی دسترسی دانش‌آموز است. آن را فقط به همان دانش‌آموز یا خانواده‌اش تحویل دهید.';
    const image=element('img');image.alt=`کد QR برای ${name}`;image.width=300;image.height=300;image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.currentQrSvg)}`;
    this.$('modernQrImage').replaceChildren(image);this.status('modernQrStatus','');this.$('modernQrDialog').showModal();
  }
  async copyModernQrLink(){
    const value=this.$('modernQrLink').value;
    try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{const input=this.$('modernQrLink');input.select();document.execCommand('copy');}this.status('modernQrStatus','لینک کپی شد.','success');}
    catch{this.status('modernQrStatus','کپی خودکار انجام نشد؛ لینک را انتخاب و کپی کنید.','error');}
  }
  printWindow(cards,title,popup=null){
    popup=popup||window.open('about:blank','_blank');
    if(!popup){this.toast('مرورگر پنجره چاپ را مسدود کرد؛ اجازه بازشدن پنجره را بدهید و دوباره تلاش کنید.');return false;}
    const schoolName=globalThis.SALEHIN_CONFIG?.schoolName||'مدرسه صالحین';
    const logoMeta=document.querySelector('meta[name="salehin-logo-full"]')?.content||'';
    let logoUrl='';try{if(logoMeta)logoUrl=new URL(logoMeta,location.href).href;}catch{}
    const branding=logoUrl?`<img class="school-logo" src="${htmlSafe(logoUrl)}" alt="${htmlSafe(schoolName)}">`:`<p class="school">${htmlSafe(schoolName)}</p>`;
    const cardHtml=cards.map(card=>`<article class="paper-card"><div class="paper-copy">${branding}<h1>${htmlSafe(card.title)}</h1>${card.name?`<h2>${htmlSafe(card.name)}</h2>`:''}${card.grade?`<p class="grade">${htmlSafe(card.grade)}</p>`:''}<p>${htmlSafe(card.instruction)}</p></div><div class="qr">${SalehinQRCode.toSvg(card.url,8,4)}</div></article>`).join('');
    const html=`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlSafe(title)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#171717;background:#fff;font:14px/1.8 Tahoma,Arial,sans-serif}.paper-grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.paper-card{min-height:116mm;border:1px solid #999;border-radius:3mm;padding:8mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;break-inside:avoid}.paper-copy{width:100%}.school{font-size:12px;color:#555;margin:0 0 4mm}.school-logo{display:block;max-width:72mm;max-height:19mm;object-fit:contain;margin:0 auto 4mm}.paper-card h1{font-size:23px;margin:0 0 3mm}.paper-card h2{font-size:18px;margin:0}.grade{font-weight:700;margin:1mm 0 3mm}.paper-card p{font-size:13px;margin:2mm 0}.qr{width:58mm;height:58mm;display:grid;place-items:center;margin:4mm auto}.qr svg{width:100%;height:100%;display:block}.footer{font-size:10px;color:#555;margin-top:5mm}@media print{.paper-card{break-inside:avoid}}</style></head><body><main class="paper-grid">${cardHtml}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`;
    popup.document.open();popup.document.write(html);popup.document.close();
    return true;
  }
  printCurrentQr(){
    const qr=this.currentQr;if(!qr||qr.kind!=='student')return;
    this.printWindow([{kind:'student',title:'ورود دانش‌آموز',name:qr.name,grade:qr.grade?`کلاس ${qr.grade}`:'',url:qr.url,instruction:'این کد را با دوربین تلفن همراه اسکن کنید تا کارنامه و پیام‌های شخصی شما باز شود. کد را محرمانه نگه دارید.'}],`برگه ورود ${qr.name}`);
  }
  async downloadTeacherLocalFile(){
    if(this.view?.role!=='admin'||!this.ensureModernWriteAccess()||this.busy)return;
    if(!await this.confirm('با ساخت فایل تازه، فایل قبلی دبیر بلافاصله از اعتبار می‌افتد. فایل تازه را در محل خصوصی ذخیره کنید؛ آن را در Git یا فضای عمومی قرار ندهید. ادامه می‌دهید؟'))return;
    const button=this.$('modernTeacherFile');this.busy=true;button.disabled=true;
    try{
      const entry=await this.portal.rotateLocalTeacherAccess();
      const config=globalThis.SALEHIN_CONFIG||{};
      const html=globalThis.SalehinTeacherLocal.buildTeacherLauncherHtml({
        appUrl:config.baseUrl||new URL('./',location.href).href,
        id:entry.id,key:entry.key,revision:entry.revision,
        schoolName:config.schoolName||'مدرسه صالحین'
      });
      try{const fragment=SalehinBackend.makeQrFragment(entry.id,entry.key,entry.revision);sessionStorage.setItem('salehinsc-qr-session',JSON.stringify(this.parseQrValue(fragment)));}catch{}
      this.download('teacher.html',new Blob([html],{type:'text/html;charset=utf-8'}));
      this.toast('فایل خصوصی دبیر ساخته شد. فایل قبلی دیگر معتبر نیست.');
    }catch(error){this.toast(errorText(error));}
    finally{this.busy=false;button.disabled=false;}
  }
  async rotateCurrentStudentQr(){
    const qr=this.currentQr;if(!qr?.id||qr.kind!=='student'||!this.ensureModernWriteAccess()||this.busy)return;
    if(!await this.confirm(`کد قبلی «${qr.name}» باطل و QR تازه صادر شود؟`))return;
    this.busy=true;
    try{const result=await this.portal.rotateQr(qr.id);const url=this.studentQrUrl({id:result.id,key:result.key,revision:result.revision});this.showModernQrLink(qr.name,url,{kind:'student',grade:qr.grade,id:qr.id});await this.refreshDirectory();this.toast('QR دانش‌آموز تعویض شد.');}
    catch(error){this.toast(errorText(error));}
    finally{this.busy=false;}
  }
  async openModernStudent(student){
    if(!student||this.busy)return;
    this.currentStudent=student;
    this.$('modernEditStudentId').value=student.id;this.$('modernEditStudentName').value=student.name||'';this.$('modernEditStudentGrade').value=student.grade||'';
    this.$('modernDetailScores').replaceChildren(element('p','modern-status','در حال دریافت سوابق…'));
    this.$('modernDetailScoreCount').textContent='';this.$('modernDetailMessageCount').textContent='';this.$('modernDetailMessages').replaceChildren(element('p','modern-status','در حال دریافت پیام‌ها…'));this.status('modernStudentStatus','');
    this.$('modernStudentDialog').showModal();
    try{
      const record=await this.portal.loadStudentRecord(student.id);this.currentStudentRecord=record;
      const scores=[...(record.assessments||[]),...(record.scores||[]).map(message=>({...message.score,date:message.createdAt,feedback:(message.blocks||[]).filter(block=>block.type==='text').map(block=>block.text).join('\n'),teacher:message.author?.name||'مدرسه'}))].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const target=this.$('modernDetailScores');target.replaceChildren();this.$('modernDetailScoreCount').textContent=`${number(scores.length)} مورد`;
      if(!scores.length)this.modernEmpty(target,'هنوز نمره‌ای ثبت نشده است','ثبت نمره از همین پنجره امکان‌پذیر است.');
      else for(const score of scores.slice(0,12)){const line=element('div','modern-detail-score');line.append(element('strong','',score.title||'ارزیابی'),element('span','',`${number(Number(score.score||0))}${score.total?` / ${number(Number(score.total))}`:''}`),element('small','',score.date?formatDate(score.date,true):''));target.append(line);}
      const messages=(record.messages||[]).filter(message=>message.category!=='score').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
      const messageTarget=this.$('modernDetailMessages');messageTarget.replaceChildren();this.$('modernDetailMessageCount').textContent=`${number(messages.length)} پیام`;
      if(!messages.length)this.modernEmpty(messageTarget,'پیامی ثبت نشده است','پیام‌های ارسالی به این دانش‌آموز در این بخش نمایش داده می‌شوند.');
      else for(const message of messages.slice(0,8)){const line=element('article','modern-detail-message');line.append(element('strong','',message.title||'پیام'),element('small','',message.createdAt?formatDate(message.createdAt,true):''));const text=(message.blocks||[]).filter(block=>block.type==='text').map(block=>block.text||'').join('\n');if(text)line.append(element('p','',text));messageTarget.append(line);}
    }catch(error){this.$('modernDetailScores').replaceChildren(element('p','modern-status is-error',errorText(error)));}
  }
  async saveModernStudent(event){
    event.preventDefault();if(this.busy||!this.ensureModernWriteAccess())return;
    const id=this.$('modernEditStudentId').value,student=this.accounts.find(item=>item.id===id);if(!student)return;
    const profile={name:this.$('modernEditStudentName').value.trim(),grade:this.$('modernEditStudentGrade').value.trim()};
    if(!profile.name||!profile.grade){this.status('modernStudentStatus','نام و پایه را کامل کنید.','error');return;}
    this.busy=true;this.$('modernSaveStudent').disabled=true;this.status('modernStudentStatus','در حال ذخیره…');
    try{await this.portal.updateAccount(id,{profile,expectedRevision:student.revision});this.$('modernStudentDialog').close();await this.refreshDirectory();this.renderModernRoster();this.toast('مشخصات دانش‌آموز ذخیره شد.');}
    catch(error){this.status('modernStudentStatus',errorText(error),'error');}
    finally{this.busy=false;this.$('modernSaveStudent').disabled=false;}
  }
  modernGateMessage(text,isError=false){
    const target=this.$('modernGateStatus');target.textContent=text;target.classList.toggle('is-error',Boolean(isError));
    this.$('modernGate').hidden=false;this.$('modernDashboard').hidden=true;
    this.$('modernRefresh').hidden=true;this.$('modernEndView').hidden=true;this.$('modernSettings').hidden=true;
  }
  modernNotice(text,isError=false){
    const target=this.$('modernStatus');target.textContent=text;target.hidden=!text;target.classList.toggle('is-error',Boolean(isError));
  }
  setModernTab(tab){
    const messages=tab==='messages';
    this.$('modernScoresSection').hidden=messages;this.$('modernMessagesSection').hidden=!messages;
    document.querySelectorAll('[data-modern-tab]').forEach(node=>{const active=node.dataset.modernTab===tab;node.classList.toggle('is-active',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
  }
  modernEmpty(target,title,copy){
    const box=element('div','modern-empty');box.append(element('strong','',title),element('p','',copy));target.replaceChildren(box);
  }
  scoreRecords(){
    const legacy=(this.view?.profile?.assessments||[]).map(score=>({...score,teacher:score.teacher||'مدرسه'}));
    const separate=(this.view?.scores||[]).map(message=>({...message.score,teacher:message.author?.name||'مدرسه',date:message.createdAt,feedback:message.blocks?.map(block=>block.text||'').filter(Boolean).join('\n')||message.score?.feedback||''}));
    const messages=(this.view?.messages||[]).filter(message=>message.category==='score'&&message.score).map(message=>({...message.score,teacher:message.author?.name||'مدرسه',date:message.createdAt,feedback:message.blocks?.map(block=>block.text||'').filter(Boolean).join('\n')||message.score.feedback||''}));
    return [...legacy,...separate,...messages].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }
  renderModern(){
    if(!this.view){this.modernGateMessage('دانش‌آموزان با QR شخصی وارد می‌شوند؛ دبیر اصلی فایل خصوصی teacher.html را باز می‌کند.');return;}
    const view=this.view,staff=['teacher','admin'].includes(view.role),scores=this.scoreRecords(),messages=this.allMessages();
    this.$('modernGate').hidden=true;this.$('modernDashboard').hidden=false;
    this.$('modernRefresh').hidden=false;this.$('modernEndView').hidden=false;
    this.$('modernSettings').hidden=view.role!=='admin'||Boolean(this.portal.preview);
    const sharedStaff=view.role==='admin';
    this.$('modernStudentName').textContent=sharedStaff?'پنل دبیران':(view.profile?.name||'دانش‌آموز');
    this.$('modernStudentMeta').textContent=sharedStaff?`${number(this.studentAccounts().length)} دانش‌آموز فعال`:[view.profile?.grade,view.site?.schoolYear].filter(Boolean).join('  ·  ')||'مدرسه صالحین';
    this.$('modernKicker').textContent=sharedStaff?'مدیریت مدرسه':staff?'دسترسی ثبت و ارسال':'کارنامه آموزشی';
    this.$('modernIdentityStamp').hidden=sharedStaff;
    this.$('modernTeacherTools').hidden=!staff;
    this.$('modernComposeMessage').hidden=view.role!=='teacher';
    this.$('modernAddScore').hidden=view.role!=='teacher';
    this.$('modernExportQr').hidden=view.role!=='admin'||Boolean(this.portal.preview);
    this.$('modernTeacherFile').hidden=view.role!=='admin'||Boolean(this.portal.preview);
    this.$('modernRosterSection').hidden=!sharedStaff;
    this.$('modernToolbar').hidden=sharedStaff;
    this.$('modernScoresSection').hidden=sharedStaff;
    this.$('modernMessagesSection').hidden=sharedStaff;
    this.$('modernGithubSetup').hidden=!sharedStaff||Boolean(this.portal.admin)||Boolean(this.portal.preview);
    this.$('modernAddStudent').hidden=Boolean(this.portal.preview);
    this.$('modernComposeBroadcast').hidden=Boolean(this.portal.preview);
    this.$('modernExportQr').hidden=Boolean(this.portal.preview);
    if(sharedStaff){
      this.$('modernConnection').textContent=view.offline?'نسخه ذخیره‌شده':this.portal.admin?'متصل به GitHub':'فقط مشاهده';
      this.$('modernSyncTime').textContent=view.offline?`نسخه ذخیره‌شده · ${formatDate(view.cacheTimestamp||new Date(),true)}`:`به‌روزرسانی ${formatDate(new Date(),true)}`;
      this.renderModernRoster();
      if(view.offline)this.modernNotice('اتصال برقرار نیست؛ فهرست ذخیره‌شده فقط برای مشاهده در دسترس است.',true);
      else this.modernNotice('');
      return;
    }
    this.$('modernMessageCount').textContent=messages.length?number(messages.length):'';
    this.$('modernMessageTotal').textContent=`${number(messages.length)} پیام`;
    this.$('modernScoreCount').textContent=`${number(scores.length)} مورد`;
    this.$('modernConnection').textContent=view.offline?'نسخه ذخیره‌شده':'متصل';
    this.$('modernSyncTime').textContent=view.offline?`نسخه ذخیره‌شده · ${formatDate(view.cacheTimestamp||new Date(),true)}`:`به‌روزرسانی ${formatDate(new Date(),true)}`;
    const summary=this.$('modernScoreSummary');summary.replaceChildren();
    const valid=scores.filter(score=>Number.isFinite(Number(score.score))&&Number(score.total)>0);
    const average=valid.length?valid.reduce((sum,score)=>sum+Number(score.score)/Number(score.total)*100,0)/valid.length:null;
    const metrics=[['تعداد ارزیابی‌ها',number(scores.length)],['میانگین درصدی',average===null?'—':number(average)+'٪'],['آخرین ثبت',scores[0]?.date?formatDate(scores[0].date,true):'—']];
    metrics.forEach(([label,value],index)=>{const item=element('div','modern-metric');item.append(element('small','',label),element('strong','',value));summary.append(item);});
    const scoreTarget=this.$('modernScores');scoreTarget.replaceChildren();
    if(!scores.length)this.modernEmpty(scoreTarget,'هنوز نمره‌ای ثبت نشده است',staff?'از گزینه «ثبت نمره» برای افزودن اولین ارزیابی استفاده کنید.':'نمره‌ها پس از ثبت توسط دبیر در این بخش نمایش داده می‌شوند.');
    else{
      const head=element('div','modern-list-head');['درس یا فعالیت','نمره','تاریخ','بازخورد'].forEach(text=>head.append(element('span','',text)));scoreTarget.append(head);
      scores.forEach(score=>{
        const row=element('article','modern-score-row'),subject=element('div','modern-score-subject');
        subject.append(element('strong','',score.title||score.subject||'ارزیابی'),element('small','',score.teacher||'مدرسه'));
        const grade=element('div','modern-score-grade',`${number(Number(score.score??0))} `);if(score.total)grade.append(element('small','',`از ${number(Number(score.total))}`));
        row.append(subject,grade,element('time','modern-score-date',score.date?formatDate(score.date,true):'—'),element('div','modern-score-feedback',score.feedback||'—'));
        scoreTarget.append(row);
      });
    }
    const messageTarget=this.$('modernMessages');messageTarget.replaceChildren();
    if(!messages.length)this.modernEmpty(messageTarget,'پیامی وجود ندارد','پیام‌ها و اطلاعیه‌های مدرسه در این بخش قرار می‌گیرند.');
    else messages.forEach(message=>{
      const article=element('article','modern-message'),top=element('div','modern-message-top');
      top.append(element('h3','',message.title||'پیام مدرسه'),element('time','',message.createdAt?formatDate(message.createdAt,true):''));article.append(top);
      const text=(message.blocks||[]).filter(block=>block.type==='text').map(block=>block.text||'').join('\n');if(text)article.append(element('p','',text));
      if(message.attachments?.length){const files=element('p','modern-message-files');message.attachments.forEach(file=>{const link=button(`دریافت ${file.name||'پیوست'}`,'download',async()=>{try{const blob=await this.portal.readFile(file);this.download(file.name||'attachment',blob);}catch(error){this.toast(errorText(error));}},'text-button');files.append(link);});article.append(files);}
      article.append(element('span','modern-message-type',message.category==='announcement'?'اطلاعیه':'پیام'));messageTarget.append(article);
    });
    this.setModernTab(this.modernTab||'scores');
    if(view.offline)this.modernNotice('اتصال برقرار نیست؛ آخرین نسخه ذخیره‌شده فقط برای مشاهده در دسترس است.',true);
    else this.modernNotice('');
  }
  async openModernScore(studentId){
    if(!this.isStaff()||this.view?.offline||!this.ensureModernWriteAccess())return;
    try{await this.refreshDirectory();}catch(error){this.toast(errorText(error));return;}
    const select=this.$('modernScoreStudent');select.replaceChildren();
    for(const student of this.studentAccounts()){const option=element('option','',`${student.name} · ${student.grade||''}`);option.value=student.id;option.selected=student.id===studentId;select.append(option);}
    if(!select.options.length){this.toast('برای این دسترسی هنوز دانش‌آموزی تعریف نشده است.');return;}
    this.$('modernScoreForm').reset();this.status('modernScoreStatus','');this.$('modernScoreDialog').showModal();
  }
  async openModernMessage(studentId){
    if(!this.isStaff()||this.view?.offline||!this.ensureModernWriteAccess())return;
    try{await this.refreshDirectory();}catch(error){this.toast(errorText(error));return;}
    const select=this.$('modernMessageStudent');select.replaceChildren();
    const all=element('option','','همه دانش‌آموزان');all.value='__all__';select.append(all);
    for(const student of this.studentAccounts()){const option=element('option','',`${student.name} · ${student.grade||''}`);option.value=student.id;option.selected=student.id===studentId;select.append(option);}
    if(select.options.length<2){this.toast('برای این دسترسی هنوز دانش‌آموزی تعریف نشده است.');return;}
    this.$('modernMessageForm').reset();if(studentId&&studentId!=='__all__')select.value=studentId;else if(studentId==='__all__')select.value='__all__';this.status('modernMessageStatus','');this.$('modernMessageDialog').showModal();
  }
  async saveModernScore(event){
    event.preventDefault();if(this.busy)return;
    const studentId=this.$('modernScoreStudent').value,title=this.$('modernScoreTitle').value.trim(),score=Number(this.$('modernScoreValue').value),total=Number(this.$('modernScoreTotal').value),feedback=this.$('modernScoreFeedback').value.trim();
    if(!studentId||!title||!Number.isFinite(score)||!Number.isFinite(total)||score<0||total<=0||score>total){this.status('modernScoreStatus','نمره باید بین صفر و مقدار کل باشد.','error');return;}
    this.busy=true;this.$('modernSaveScore').disabled=true;this.status('modernScoreStatus','در حال ثبت و انتشار…');
    try{const result=await this.portal.publishMessage({title:`نمره ${title}`,category:'score',recipients:[studentId],blocks:[{type:'text',text:feedback}],files:[],score:{title,score,total,feedback}});this.$('modernScoreDialog').close();this.toast(result.status==='pending'?'نمره برای انتشار ارسال شد.':'نمره ثبت شد.');await this.refresh({quiet:true});}
    catch(error){this.status('modernScoreStatus',errorText(error),'error');}
    finally{this.busy=false;this.$('modernSaveScore').disabled=false;}
  }
  async exportModernQrCards(){
    if(this.view?.role!=='admin'||this.portal.preview||this.busy||!this.ensureModernWriteAccess())return;
    const popup=window.open('about:blank','_blank');if(!popup){this.toast('مرورگر پنجره چاپ را مسدود کرد.');return;}
    this.busy=true;this.$('modernExportQr').disabled=true;
    try{
      const entries=(await this.portal.exportQrCredentials()).filter(item=>item.role==='student');
      if(!entries.length)throw new Error('هیچ دانش‌آموز فعالی برای صدور QR پیدا نشد.');
      const cards=entries.map(entry=>({kind:'student',title:'ورود دانش‌آموز',name:entry.name,grade:entry.grade?`کلاس ${entry.grade}`:'',url:this.studentQrUrl(entry),instruction:'این کد را با دوربین تلفن همراه اسکن کنید تا کارنامه و پیام‌های شخصی شما باز شود. آن را محرمانه نگه دارید.'}));
      this.printWindow(cards,'برگه‌های ورود دانش‌آموزان',popup);
      this.toast(`${number(cards.length)} برگه QR آماده چاپ شد. برگه‌ها را فقط به صاحب هر کد تحویل دهید.`);
    }catch(error){popup.close();this.toast(errorText(error));}
    finally{this.busy=false;this.$('modernExportQr').disabled=false;}
  }
  async saveModernMessage(event){
    event.preventDefault();if(this.busy)return;
    const chosen=this.$('modernMessageStudent').value,title=this.$('modernMessageTitle').value.trim(),body=this.$('modernMessageBody').value.trim(),category=this.$('modernMessageAnnouncement').checked?'announcement':'message';
    if(!chosen||!title||!body){this.status('modernMessageStatus','گیرنده، موضوع و متن پیام را کامل کنید.','error');return;}
    const recipients=chosen==='__all__'?this.studentAccounts().map(student=>student.id):[chosen];
    this.busy=true;this.$('modernSendMessage').disabled=true;this.status('modernMessageStatus','در حال ارسال…');
    try{const result=await this.portal.publishMessage({title,category,recipients,blocks:[{type:'text',text:body}],files:[]});this.$('modernMessageDialog').close();this.toast(result.status==='pending'?'پیام برای انتشار ارسال شد.':'پیام ارسال شد.');await this.refresh({quiet:true});}
    catch(error){this.status('modernMessageStatus',errorText(error),'error');}
    finally{this.busy=false;this.$('modernSendMessage').disabled=false;}
  }
  selectLoginRole(role){this.loginRole=role;this.$('loginHeading').textContent='ورود به سامانه';}
  async login(event){event.preventDefault();if(this.busy)return;this.busy=true;const epoch=++this.epoch;this.$('loginBtn').disabled=true;this.status('loginStatus','در حال ورود…');try{const view=await this.portal.login(this.$('loginKey').value,this.$('loginPassword').value);if(epoch!==this.epoch)return;this.$('loginForm').reset();this.applyView(view);await this.refreshDirectory();this.status('loginStatus','');}catch(error){this.status('loginStatus',errorText(error),'error');}finally{this.$('loginPassword').value='';this.$('loginBtn').disabled=false;this.busy=false;}}
  async logout(){
    ++this.epoch;
    try{sessionStorage.removeItem('salehinsc-qr-session');}catch{}
    let logoutError=null;
    try{await this.portal.logout();}catch(error){logoutError=error;}
    // Hiding the account is a local security action. It must not depend on
    // IndexedDB/session cleanup succeeding, especially on a shared school PC.
    try{this.clearSession();}catch(error){logoutError=logoutError||error;}
    finally{
      this.view=null;this.accounts=[];this.files=[];
      const gate=this.$('modernGate'),dashboard=this.$('modernDashboard');
      if(gate)gate.hidden=false;
      if(dashboard)dashboard.hidden=true;
      for(const id of ['modernRefresh','modernEndView','modernSettings']){const node=this.$(id);if(node)node.hidden=true;}
    }
    if(logoutError){
      this.modernGateMessage('دسترسی این دستگاه بسته شد، اما پاک‌سازی کامل نشست ذخیره‌شده با خطا روبه‌رو شد. اتصال را بررسی کنید.',true);
      this.notice(errorText(logoutError),'error');
    }
  }
  clearSession(){
    this.releaseUrls();this.disposeCropSource();this.clearCropSelection();
    this.settingsDraftDirty.clear();this.profileUpdatePending=false;this.profileAvatarPending=false;this.settingsAccountId='';
    this.view=null;this.accounts=[];this.files=[];this.pending=false;
    this.$('loginView').classList.remove('hidden');this.$('appView').classList.add('hidden');this.$('appView').classList.remove('offline-mode');this.$('logoutBtn').classList.add('hidden');
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    for(const id of ['composerForm','accountForm','scoreForm','profileForm','siteForm','loginForm','modernAddStudentForm','modernStudentForm','modernScoreForm','modernMessageForm'])this.$(id)?.reset();
    for(const id of ['messageFeed','accountsContent','scoresContent','scoreSummary','filesContent','rosterContent','profileAvatar','mainNav','quickLinks','recipientChoices','assignmentChoices','createdCredentials','composerAttachments','scoreStudent','modernRoster','modernDetailScores','modernDetailMessages','modernScoreSummary','modernScores','modernMessages'])this.$(id)?.replaceChildren();
    for(const id of ['profileName','profileAccountName','profileGrade','profileSubject','profileYear','profileRole','settingsAvatarPreview','settingsName','settingsTitle','settingsSubject','accountLoginKey','accountName','accountGrade','accountSubject','scoreFeedback','messageBody','confirmPassword','modernStudentName','modernStudentMeta','modernRosterCount','modernMessageCount','modernScoreCount','modernMessageTotal','modernDetailScoreCount','modernDetailMessageCount','modernQrLink','modernEditStudentId','modernEditStudentName','modernEditStudentGrade','modernNewStudentName','modernNewStudentGrade','modernScoreTitle','modernScoreValue','modernScoreFeedback','modernMessageTitle','modernMessageBody']){
      const node=this.$(id);if(node){if('value'in node)node.value='';else node.textContent='';}
    }
    this.$('modernQrImage')?.replaceChildren();
    const qrLinkField=this.$('modernQrLinkField');if(qrLinkField)qrLinkField.hidden=true;
    this.$('modernCopyQrLink').hidden=true;this.$('modernQrStatus').textContent='';
    this.$('modernQrDescription').textContent='این QR کلید خصوصی دسترسی دانش‌آموز است. آن را فقط به همان دانش‌آموز یا خانواده‌اش تحویل دهید.';
    this.currentQr=null;this.currentQrSvg='';this.currentStudent=null;
    this.$('modernRosterSearch').value='';this.$('modernShowDisabled').checked=false;
    const classFilter=this.$('modernRosterClass');const allClasses=element('option','','همه کلاس‌ها');allClasses.value='';classFilter.replaceChildren(allClasses);classFilter.value='';
    this.$('modernConnection').textContent='آماده';this.$('modernSyncTime').textContent='اطلاعات به‌روز';
    this.$('portalLabel').textContent='درگاه مدرسه';this.notice('');
    this.modernGateMessage('دانش‌آموزان با QR شخصی وارد می‌شوند؛ دبیر اصلی فایل خصوصی teacher.html را باز می‌کند.');
    this.modernNotice('');this.selectLoginRole(this.loginRole||'student');
  }
  async refresh({initial=false,quiet=false}={}){
    if(this.refreshing)return;
    this.refreshing=true;
    const epoch=this.epoch;
    try{
      const view=await this.portal.refreshStudent();
      if(epoch!==this.epoch)return;
      if(!view){this.clearSession();return;}
      this.applyView(view);
      if(view.offline){
        const savedAt=view.cacheTimestamp?formatDate(view.cacheTimestamp,true):'زمان نامشخص';
        this.notice(`اتصال اینترنت برقرار نیست؛ نسخه ذخیره‌شده روی این دستگاه نمایش داده می‌شود (${savedAt}). تغییرات جدید تا بازگشت اتصال قابل ثبت نیستند.`);
        return;
      }
      await this.refreshDirectory();
      if(!initial&&!quiet)this.toast('اطلاعات تازه دریافت شد.');
      const pending=await this.portal.pendingStatus();
      if(pending){
        this.pending=pending.status==='pending';
        if(pending.status==='published'){
          this.toast('پیام یا تغییرات شما منتشر شد.');
          if(this.profileUpdatePending&&!this.profileAvatarPending){
            this.profileUpdatePending=false;
            for(const id of ['settingsName','settingsTitle','settingsSubject'])this.settingsDraftDirty.delete(id);
          }
        }
        if(pending.status==='pending')this.notice('درخواست شما در صف انتشار مدرسه است؛ پس از تأیید، به‌صورت خودکار نمایش داده می‌شود.');
        if(pending.status==='failed'){
          if(this.profileUpdatePending){this.profileUpdatePending=false;this.profileAvatarPending=false;}
          this.notice('انتشار تأیید نشد. تنظیمات و اجرای گردش کار را بررسی و دوباره تلاش کنید.','error');
        }
      }else {this.pending=false;if(!this.portal.preview)this.notice('');}
      this.renderModern();
    }catch(error){
      if(epoch!==this.epoch)return;
      if(error.code==='SESSION_REVOKED')this.clearSession();
      if(!quiet){if(this.view){this.notice(errorText(error),'error');this.modernNotice(errorText(error),true);}else{this.status('loginStatus',errorText(error),'error');this.modernGateMessage(errorText(error),true);}}
    }finally{this.refreshing=false;}
  }
  applyView(view){
    if(!view||!view.profile||!['student','teacher','admin'].includes(view.role)){
      throw new Error('پرونده دریافتی ساختار یا نقش معتبر ندارد.');
    }
    const previousAccountId=this.view?.id;
    if(previousAccountId&&previousAccountId!==view.id){
      this.releaseUrls();this.disposeCropSource();this.clearCropSelection();
      this.settingsDraftDirty.clear();this.settingsAccountId='';
    }
    this.view=view;
    this.accounts=Array.isArray(view.directory)?view.directory:[];

    // The modern portal is the only visible application shell. Do not render
    // the retired legacy workspace here: it is hidden by modern.css and its
    // DOM has no role in the current student/teacher workflow.
    this.renderModern();
  }
  releaseTransientUrls(){for(const url of this.urls)URL.revokeObjectURL(url);this.urls.clear();}
  releaseAvatarUrl(){if(this.avatarUrl)URL.revokeObjectURL(this.avatarUrl);this.avatarUrl='';}
  releaseUrls(){this.releaseTransientUrls();this.releaseAvatarUrl();this.avatarDescriptorKey='';if(this.croppedAvatarUrl)URL.revokeObjectURL(this.croppedAvatarUrl);this.croppedAvatarUrl='';this.croppedAvatarFile=null;}
  showAvatarInitials(){this.releaseAvatarUrl();this.avatarDescriptorKey='';this.$('profileAvatar').replaceChildren(document.createTextNode(initials(this.view?.profile?.name)));this.updateSettingsAvatarPreview();}
  updateSettingsAvatarPreview(src=this.croppedAvatarUrl||this.avatarUrl){const target=this.$('settingsAvatarPreview');if(!target)return;if(src){const current=target.querySelector('img');if(current&&current.src===src)return;const image=element('img');image.alt='پیش‌نمایش تصویر پروفایل';image.src=src;target.replaceChildren(image);return;}const fallback=initials(this.view?.profile?.name);if(!target.querySelector('img')&&target.textContent===fallback)return;target.textContent=fallback;}
  async loadAvatar(descriptor){const key=String(descriptor?.id||descriptor?.path||JSON.stringify(descriptor));if(key===this.avatarDescriptorKey&&this.avatarUrl)return;const epoch=this.epoch,accountId=this.view?.id;try{const blob=await this.portal.readFile(descriptor);if(epoch!==this.epoch||this.view?.id!==accountId||String(this.view?.profile?.avatar?.id||this.view?.profile?.avatar?.path||JSON.stringify(this.view?.profile?.avatar))!==key)return;const nextUrl=URL.createObjectURL(blob);this.releaseAvatarUrl();this.avatarUrl=nextUrl;this.avatarDescriptorKey=key;const image=element('img');image.alt='تصویر پروفایل';image.src=nextUrl;this.$('profileAvatar').replaceChildren(image);this.updateSettingsAvatarPreview();if(this.profileUpdatePending&&this.profileAvatarPending){this.clearCropSelection();this.profileAvatarPending=false;this.profileUpdatePending=false;for(const id of ['settingsName','settingsTitle','settingsSubject'])this.settingsDraftDirty.delete(id);this.updateSettingsAvatarPreview();}}catch{/* Keep the last valid avatar visible instead of flashing back to initials on a transient read failure. */}}
  async prepareComposerFiles(selected,input){
    input.value='';if(!selected.length||this.preparingFiles)return;this.preparingFiles=true;this.$('sendMessageBtn').disabled=true;this.status('composerStatus','در حال آماده‌سازی تصاویر…');
    try{
      const added=[];let resized=0;
      for(const file of selected){if(!file.size)throw new Error('فایل خالی قابل افزودن نیست.');let prepared=file;
        if(['image/jpeg','image/png','image/webp'].includes(file.type)){prepared=await optimizeUploadImage(file,768);if(prepared!==file)resized++;}
        if(prepared.size>SalehinRoles.MAX_FILE_BYTES)throw new Error(`«${file.name}» پس از بهینه‌سازی هنوز از ۸ مگابایت بزرگ‌تر است.`);
        added.push(prepared);
      }
      const all=[...this.files,...added];if(all.length>12)throw new Error('حداکثر ۱۲ فایل در هر پیام مجاز است.');
      if(all.reduce((sum,file)=>sum+file.size,0)>SalehinRoles.MAX_BATCH_BYTES)throw new Error('مجموع فایل‌ها نباید از ۱۶ مگابایت بیشتر شود.');
      this.files.push(...added);this.renderComposerFiles();this.status('composerStatus',resized?`${number(resized)} تصویر برای بارگذاری، بدون تغییر نسبت تصویر، کوچک شد.`:'');
    }catch(error){this.status('composerStatus',error.message||errorText(error),'error');}
    finally{this.preparingFiles=false;this.$('sendMessageBtn').disabled=false;}
  }
  async beginAvatarCrop(file){
    if(!this.isStaff())return;
    if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)){this.toast('یک تصویر PNG، JPEG، GIF یا WebP انتخاب کنید.');return;}
    if(file.size>40*1024*1024){this.toast('فایل تصویر اصلی از ۴۰ مگابایت بزرگ‌تر است.');return;}
    try{
      const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>60000000){bitmap.close?.();throw new Error('ابعاد تصویر بیش از اندازه بزرگ است.');}
      this.disposeCropSource();this.cropState={bitmap,file,zoom:1,offsetX:0,offsetY:0,drag:null,side:300,scale:1};this.cropSourceUrl=URL.createObjectURL(file);
      this.$('cropImage').src=this.cropSourceUrl;this.$('cropZoom').value='1';this.status('cropStatus','');this.$('avatarCropDialog').showModal();this.updateCropLayout();
    }catch(error){this.toast(error.message||'تصویر قابل خواندن نیست. تصویر دیگری انتخاب کنید.');}
  }
  updateCropLayout(){
    const state=this.cropState;if(!state)return;const stage=this.$('cropStage'),side=stage.clientWidth||300;state.side=side;
    const fit=side/Math.min(state.bitmap.width,state.bitmap.height);state.scale=fit*state.zoom;state.renderWidth=state.bitmap.width*state.scale;state.renderHeight=state.bitmap.height*state.scale;
    const maxX=Math.max(0,(state.renderWidth-side)/2),maxY=Math.max(0,(state.renderHeight-side)/2);
    state.offsetX=Math.min(maxX,Math.max(-maxX,state.offsetX));state.offsetY=Math.min(maxY,Math.max(-maxY,state.offsetY));
    const image=this.$('cropImage');image.style.width=`${state.renderWidth}px`;image.style.height=`${state.renderHeight}px`;image.style.left=`calc(50% + ${state.offsetX}px)`;image.style.top=`calc(50% + ${state.offsetY}px)`;
  }
  setCropZoom(zoom){const state=this.cropState;if(!state)return;const next=Math.max(1,Math.min(3,zoom)),ratio=next/state.zoom;state.zoom=next;state.offsetX*=ratio;state.offsetY*=ratio;this.updateCropLayout();}
  beginCropDrag(event){const state=this.cropState;if(!state||event.button!==0)return;state.drag={x:event.clientX,y:event.clientY,offsetX:state.offsetX,offsetY:state.offsetY,pointerId:event.pointerId};this.$('cropStage').classList.add('dragging');try{this.$('cropStage').setPointerCapture(event.pointerId);}catch{}event.preventDefault();}
  moveCropDrag(event){const state=this.cropState;if(!state?.drag||state.drag.pointerId!==event.pointerId)return;state.offsetX=state.drag.offsetX+(event.clientX-state.drag.x);state.offsetY=state.drag.offsetY+(event.clientY-state.drag.y);this.updateCropLayout();}
  endCropDrag(){if(this.cropState)this.cropState.drag=null;this.$('cropStage').classList.remove('dragging');}
  async applyAvatarCrop(){
    const state=this.cropState;if(!state)return;const button=this.$('applyAvatarCrop');button.disabled=true;this.status('cropStatus','در حال آماده‌سازی تصویر…');
    try{
      const side=state.side/ state.scale;const sx=Math.max(0,Math.min(state.bitmap.width-side,(state.bitmap.width-side)/2-state.offsetX/state.scale));const sy=Math.max(0,Math.min(state.bitmap.height-side,(state.bitmap.height-side)/2-state.offsetY/state.scale));
      const outputSize=Math.max(1,Math.min(768,Math.floor(side)));const canvas=document.createElement('canvas');canvas.width=outputSize;canvas.height=outputSize;const context=canvas.getContext('2d');if(!context)throw new Error('پردازش تصویر در این مرورگر در دسترس نیست.');context.drawImage(state.bitmap,sx,sy,side,side,0,0,outputSize,outputSize);
      const blob=await blobFromCanvas(canvas,'image/png');const baseName=String(state.file.name||'profile').replace(/\.[^.]+$/,'');const file=new File([blob],`${baseName}-profile.png`,{type:'image/png',lastModified:Date.now()});
      if(this.croppedAvatarUrl)URL.revokeObjectURL(this.croppedAvatarUrl);this.croppedAvatarFile=file;this.croppedAvatarUrl=URL.createObjectURL(file);this.updateSettingsAvatarPreview();this.status('profileFormStatus','تصویر برش خورد؛ برای اعمال تغییر، پروفایل را ذخیره کنید.','success');this.cancelAvatarCrop();
    }catch(error){this.status('cropStatus',error.message||'آماده‌سازی تصویر انجام نشد.','error');}finally{button.disabled=false;}
  }
  cancelAvatarCrop(){const dialog=this.$('avatarCropDialog');if(dialog.open)dialog.close();this.disposeCropSource();}
  disposeCropSource(){if(this.cropSourceUrl){URL.revokeObjectURL(this.cropSourceUrl);this.cropSourceUrl='';}if(this.cropState?.bitmap)this.cropState.bitmap.close?.();this.cropState=null;const image=this.$('cropImage');if(image){image.removeAttribute('src');image.style.width='';image.style.height='';image.style.left='';image.style.top='';}this.$('cropStage')?.classList.remove('dragging');}
  clearCropSelection(){if(this.croppedAvatarUrl)URL.revokeObjectURL(this.croppedAvatarUrl);this.croppedAvatarUrl='';this.croppedAvatarFile=null;const input=this.$('settingsAvatar');if(input)input.value='';}
  renderNavigation(){this.$('mainNav').replaceChildren();this.$('quickLinks').replaceChildren();for(const name of this.accessibleViews()){const item=button(VIEWS[name].title,VIEWS[name].icon,()=>this.navigate(name),'nav-item');item.dataset.view=name;this.$('mainNav').append(item);if(name!=='messages')this.$('quickLinks').append(button(VIEWS[name].title,VIEWS[name].icon,()=>this.navigate(name),''));}}
  renderKey(name,view){
    if(!view)return'';
    if(name==='messages')return JSON.stringify({messages:view.messages||[],announcements:view.announcements||[],pinned:view.site?.pinnedMessage||'',filter:this.messageFilter,query:this.$('messageSearch')?.value||'',page:this.page});
    if(name==='settings')return JSON.stringify({profile:[view.profile?.name,view.profile?.title,view.profile?.subject,view.profile?.avatar?.id||view.profile?.avatar?.path],site:[view.site?.schoolName,view.site?.schoolYear]});
    if(name==='scores')return JSON.stringify({assessments:view.profile?.assessments||[],scores:[...(view.scores||[]),...(view.messages||[]).filter(item=>item.category==='score')]});
    if(name==='files')return JSON.stringify({attachments:view.attachments||[],files:(view.messages||[]).map(item=>[item.id,item.attachments||[]])});
    return JSON.stringify({directory:view.directory||this.accounts||[],site:view.site||{}});
  }
  navigate(name,{preserveIfUnchanged=false}={}){if(!this.view||!this.accessibleViews().includes(name))return;const sameView=this.currentView===name;this.currentView=name;document.querySelectorAll('.view-panel').forEach(panel=>panel.classList.add('hidden'));this.$(`${name}Panel`).classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(node=>{node.classList.toggle('selected',node.dataset.view===name);node.setAttribute('aria-current',node.dataset.view===name?'page':'false');});this.$('pageTitle').textContent=VIEWS[name].title;this.$('viewCrumb').textContent=VIEWS[name].title;this.$('pageKicker').textContent=VIEWS[name].kicker;this.$('pageDescription').textContent=VIEWS[name].description;this.$('composeBtn').classList.toggle('hidden',!this.isStaff()||name!=='messages');if(preserveIfUnchanged&&sameView)return;if(name==='messages')this.renderMessages();if(name==='scores')this.renderScores();if(name==='accounts')this.renderAccounts();if(name==='roster')this.renderRoster();if(name==='files')this.renderFiles();if(name==='settings')this.renderSettings();}
  async refreshDirectory(){if(!this.isStaff()||this.view?.offline)return;try{const previous=JSON.stringify(this.accounts);this.accounts=await this.portal.loadDirectory();const changed=previous!==JSON.stringify(this.accounts);if(this.portal.store?.set&&this.view){try{await this.portal.store.set('last-directory',{accountId:this.view.id,revision:this.portal.session?.revision||'',savedAt:new Date().toISOString(),accounts:this.accounts});}catch{/* The remote data remains authoritative if local caching is unavailable. */}}if(this.view?.role==='admin')this.renderModernRoster();if(changed&&['accounts','roster','scores'].includes(this.currentView))this.navigate(this.currentView);}catch(error){if(error.code==='ADMIN_REQUIRED'){const changed=this.accounts.length>0;this.accounts=[];if(changed&&this.currentView==='accounts')this.renderAccounts();}else throw error;}}
  empty(container,title,description,symbol='message',action){const state=element('div','empty-state'),circle=element('div','empty-icon');circle.append(icon(symbol));state.append(circle,element('h3','',title),element('p','',description));if(action)state.append(action);container.replaceChildren(state);}
  allMessages(){const old=(this.view.announcements||[]).map(item=>({id:item.id,title:item.title,blocks:[{type:'text',text:item.body}],attachments:item.attachments||[],author:{name:'مدیریت مدرسه',role:'admin'},category:'announcement',createdAt:item.createdAt,pinned:false,legacy:true}));return[...(this.view.messages||[]).filter(message=>message.category!=='score'),...old].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||String(b.createdAt).localeCompare(String(a.createdAt)));}
  renderPinnedNotice(messages){const target=this.$('pinnedMessageNotice');target.replaceChildren();const pinned=messages.find(message=>message.pinned);if(!pinned){target.classList.add('hidden');return;}target.classList.remove('hidden');const marker=element('span','pinned-notice-marker');marker.append(icon('pin'),document.createTextNode('پیام سنجاق‌شده'));const content=element('div','pinned-notice-content');content.append(element('strong','',pinned.title));const preview=(pinned.blocks||[]).filter(block=>block.type==='text'&&block.text).map(block=>block.text.trim()).filter(Boolean).join(' ');if(preview)content.append(element('p','',preview.length>260?`${preview.slice(0,260)}…`:preview));const meta=element('span','pinned-notice-meta',`${pinned.author?.name||'مدرسه'} · ${formatDate(pinned.createdAt)}`);target.append(marker,content,meta);}
  renderMessages(){if(!this.view)return;this.releaseTransientUrls();const all=this.allMessages();this.renderPinnedNotice(all);const query=this.$('messageSearch').value.trim().toLocaleLowerCase('fa');const messages=all.filter(item=>(this.messageFilter==='all'||item.category===this.messageFilter)&&(!query||`${item.title} ${(item.blocks||[]).map(block=>block.text||'').join(' ')} ${item.author?.name||''}`.toLocaleLowerCase('fa').includes(query)));this.$('allMessageCount').textContent=number(all.length);document.querySelectorAll('[data-filter]').forEach(node=>node.classList.toggle('selected',node.dataset.filter===this.messageFilter));const feed=this.$('messageFeed');feed.replaceChildren();this.$('feedPagination').replaceChildren();if(!messages.length){this.empty(feed,query?'پیامی پیدا نشد':'هنوز پیامی ندارید',query?'عبارت جست‌وجو یا فیلتر را تغییر دهید.':this.isStaff()?'اولین پیام خود را برای دانش‌آموزان بفرستید.':'پیام‌های مدرسه پس از انتشار در اینجا نمایش داده می‌شوند.','message',this.isStaff()&&!query?button('نوشتن پیام','plus',()=>this.openComposer(),'button primary'):null);return;}const pages=Math.ceil(messages.length/5);this.page=Math.min(Math.max(1,this.page),pages);messages.slice((this.page-1)*5,this.page*5).forEach(message=>feed.append(this.messageCard(message)));const footer=this.$('feedPagination');footer.append(element('span','',`${number(messages.length)} پیام · صفحه ${number(this.page)} از ${number(pages)}`));if(pages>1){const buttons=element('div','pagination-buttons');for(let page=1;page<=pages;page++){const control=button(number(page),null,()=>{this.page=page;this.renderMessages();},page===this.page?'selected':'');control.setAttribute('aria-label',`صفحه ${page}`);buttons.append(control);}footer.append(buttons);}}
  messageCard(message){const card=element('article','message-card'),heading=element('header','message-card-heading');heading.append(element('h2','',message.title));if(message.pinned){const pin=element('span','pin-label','سنجاق‌شده');pin.prepend(icon('pin'));heading.append(pin);}const meta=element('div','message-meta'),author=element('span','author-label',`ارسال: ${message.author?.name||'مدرسه'}`);author.prepend(message.author?.avatar?this.authorAvatar(message.author):icon('user'));const date=element('span','',formatDate(message.createdAt,true));date.prepend(icon('calendar'));meta.append(author,date,element('span','category-label',message.category==='announcement'?'اطلاعیه':'پیام آموزشی'));const body=element('div','message-body'),used=new Set();for(const block of message.blocks||[]){if(block.type==='text')body.append(element('p','',block.text));else{const descriptor=(message.attachments||[]).find(file=>file.id===block.attachmentId);if(descriptor){used.add(descriptor.id);body.append(this.attachment(descriptor,true));}}}for(const file of message.attachments||[])if(!used.has(file.id))body.append(this.attachment(file,false));const footer=element('footer','message-footer'),tag=element('span','',message.author?.title||ROLE_LABELS[message.author?.role]||'مدرسه');tag.prepend(icon('shield'));footer.append(tag);const actions=element('div','message-actions');actions.append(element('span','',message.attachments?.length?`${number(message.attachments.length)} پیوست`:'بدون پیوست'));if(this.view.role==='admin'&&!message.legacy){const remove=button('', 'trash',()=>this.deleteMessage(message),'icon-button');remove.setAttribute('aria-label','حذف پیام');actions.append(remove);}footer.append(actions);card.append(heading,meta,body,footer);return card;}
  authorAvatar(author){const node=element('span','message-author-avatar',initials(author.name)),epoch=this.epoch;this.portal.readFile(author.avatar).then(blob=>{if(epoch!==this.epoch||!this.view||!node.isConnected)return;const image=element('img');image.alt=author.name||'تصویر دبیر';image.src=URL.createObjectURL(blob);this.urls.add(image.src);node.replaceChildren(image);}).catch(()=>{});return node;}
  attachment(file,inline=false){const box=element('div','attachment-wrapper');if(inline&&file.inline){const label=element('div','attachment-loading',`در حال دریافت ${file.name}…`);box.append(label);const epoch=this.epoch;this.portal.readFile(file).then(blob=>{if(epoch!==this.epoch||!this.view||!box.isConnected)return;const image=element('img','inline-image');image.alt=file.name;image.loading='lazy';image.src=URL.createObjectURL(blob);this.urls.add(image.src);image.addEventListener('error',()=>{image.remove();label.textContent='پیش‌نمایش تصویر در دسترس نیست؛ فایل را دریافت کنید.';box.prepend(label);});label.replaceWith(image);}).catch(()=>{label.textContent='پیش‌نمایش تصویر دریافت نشد.';});}const download=button('',null,async()=>{download.disabled=true;const epoch=this.epoch;try{const blob=await this.portal.readFile(file);if(epoch!==this.epoch)return;this.download(file.name,blob);}catch(error){this.toast(errorText(error));}finally{download.disabled=false;}},'attachment-card');const details=element('span');details.append(element('strong','',file.name),element('small','',`${fileSize(file.size)} · ${file.mime?.split('/').pop()?.toUpperCase()||'FILE'}`));const arrow=element('span','download-icon');arrow.append(icon('download'));download.append(icon(file.inline?'image':'file'),details,arrow);box.append(download);return box;}
  download(name,blob){const url=URL.createObjectURL(blob),anchor=element('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  studentAccounts(){return this.accounts.filter(account=>(account.role||'student')==='student'&&!account.disabled&&!account.locked);}
  renderFiles(){this.releaseTransientUrls();const target=this.$('filesContent');target.replaceChildren();const files=new Map();for(const message of this.allMessages())for(const file of message.attachments||[])files.set(file.id,file);for(const file of this.view.attachments||[])files.set(file.id,file);if(!files.size){this.empty(target,'فایلی در کتابخانه نیست','فایل‌های پیوست پیام‌ها در این بخش جمع می‌شوند.','folder');return;}for(const file of files.values())target.append(this.attachment(file,false));}
  renderScores(){
    const scores=[...(this.view.profile.assessments||[]).map(score=>({...score,teacher:'مدرسه',studentId:this.view.id})),...(this.view.scores||[]).map(message=>({...message.score,teacher:message.author?.name,date:message.createdAt,studentId:message.studentId})),...(this.view.messages||[]).filter(message=>message.category==='score'&&message.score).map(message=>({...message.score,teacher:message.author?.name,date:message.createdAt,studentId:message.studentId}))];
    const numeric=scores.filter(score=>Number.isFinite(Number(score.score))&&Number(score.total)>0),average=numeric.length?numeric.reduce((sum,score)=>sum+Number(score.score)/Number(score.total)*100,0)/numeric.length:null;
    const summary=this.$('scoreSummary');summary.replaceChildren();
    for(const [label,value]of[['نمره‌های ثبت‌شده',number(scores.length)],['میانگین درصد',average===null?'—':`${number(average)}٪`],['پیام‌های آموزشی',number(this.allMessages().length)]]){const card=element('div','summary-card');card.append(element('span','',label),element('strong','',value));summary.append(card);}
    const target=this.$('scoresContent');
    if(!scores.length){this.empty(target,'هنوز نمره‌ای ثبت نشده است',this.isStaff()?'برای ثبت نمره، دانش‌آموز و عنوان درس را انتخاب کنید.':'نمره‌ها و بازخورد دبیران در این بخش نمایش داده می‌شود.','chart');return;}
    const table=this.table([...(this.isStaff()?['دانش‌آموز']:[]),'عنوان درس / فعالیت','نمره','تاریخ','دبیر / بازخورد']);
    for(const score of scores){const row=element('tr'),value=element('td','score-value');if(this.isStaff())row.append(element('td','',this.accounts.find(account=>account.id===score.studentId)?.name||'حساب خارج از فهرست فعلی'));value.append(document.createTextNode(number(score.score??0)),element('small','',score.total?` از ${number(score.total)}`:''));row.append(element('td','',score.title||'فعالیت'),value,element('td','',formatDate(score.date)),element('td','',`${score.teacher||'مدرسه'}${score.feedback?` · ${score.feedback}`:''}`));table.body.append(row);}
    target.replaceChildren(table.wrap);
  }
  table(headers){const wrap=element('div','table-wrap'),table=element('table','data-table'),head=element('thead'),row=element('tr');headers.forEach(text=>row.append(element('th','',text)));head.append(row);const body=element('tbody');table.append(head,body);wrap.append(table);return{wrap,body};}
  renderAccounts(){if(this.view.role!=='admin')return;const target=this.$('accountsContent');document.querySelectorAll('[data-role-filter]').forEach(node=>node.classList.toggle('selected',node.dataset.roleFilter===this.accountFilter));if(!this.portal.admin&&!this.portal.preview&&!this.portal.offline){this.empty(target,'اتصال مدیریت لازم است','برای مدیریت حساب‌ها، سرویس امن مدرسه باید راه‌اندازی شده باشد.','key',button('رفتن به تنظیمات','settings',()=>this.navigate('settings'),'button primary'));return;}const query=this.$('accountSearch').value.trim().toLocaleLowerCase('fa'),accounts=this.accounts.filter(account=>(this.accountFilter==='all'||account.role===this.accountFilter)&&`${account.name||''} ${account.grade||''}`.toLocaleLowerCase('fa').includes(query));if(!accounts.length){this.empty(target,'حسابی پیدا نشد','برای شروع، یک حساب دانش‌آموز یا دبیر ایجاد کنید.','users');return;}const table=this.table(['نام و نام خانوادگی','نوع حساب','پایه / درس','وضعیت','مدیریت']);for(const account of accounts){const row=element('tr'),person=element('div','table-person'),details=element('span');details.append(element('strong','',account.name||'حساب قفل‌شده'),element('small','',account.title||account.subject||''));person.append(element('span','mini-avatar',initials(account.name)),details);const td=element('td');td.append(person);const status=element('td');status.append(element('span',`status-pill ${account.disabled?'inactive':''}`,account.disabled?'غیرفعال':'فعال'));const action=element('td'),controls=element('div','row-actions');if(account.role!=='admin'&&!this.portal.offline){const edit=button('', 'edit',()=>this.openAccount(account),'icon-button');edit.setAttribute('aria-label',`ویرایش ${account.name}`);const disable=button('',account.disabled?'check-circle':'lock',()=>this.toggleAccount(account),'icon-button');disable.setAttribute('aria-label',account.disabled?'فعال‌سازی حساب':'غیرفعال‌سازی حساب');const reset=button('', 'key',()=>this.resetPassword(account),'icon-button');reset.setAttribute('aria-label','بازنشانی رمز عبور');controls.append(edit,disable,reset);}else controls.append(element('span','', 'حساب اصلی'));action.append(controls);row.append(td,element('td','',ROLE_LABELS[account.role]||'دانش‌آموز'),element('td','',account.grade||account.subject||'—'),status,action);table.body.append(row);}target.replaceChildren(table.wrap);}
  renderRoster(){const target=this.$('rosterContent'),students=this.studentAccounts();if(!students.length){this.empty(target,'هنوز کلاسی به شما سپرده نشده است','مدیر مدرسه دسترسی کلاس‌ها را برای شما تعیین می‌کند.','graduation');return;}const table=this.table(['دانش‌آموز','پایه / کلاس','ارتباط']);for(const student of students){const row=element('tr'),controls=element('td');controls.append(button('ارسال پیام','message',()=>this.openComposer(student.id),'button subtle'),document.createTextNode(' '),button('ثبت نمره','chart',()=>this.openScore(student.id),'button subtle'));row.append(element('td','',student.name),element('td','',student.grade),controls);table.body.append(row);}target.replaceChildren(table.wrap);}
  renderSettings(){if(!this.isStaff())return;const accountId=this.view.id;if(this.settingsAccountId!==accountId){this.settingsAccountId=accountId;this.settingsDraftDirty.clear();}
    for(const [id,value] of [['settingsName',this.view.profile.name||''],['settingsTitle',this.view.profile.title||''],['settingsSubject',this.view.profile.subject||''],['settingsSchoolName',this.view.site?.schoolName||'مدرسه صالحین'],['settingsSchoolYear',this.view.site?.schoolYear||'']])if(!this.settingsDraftDirty.has(id))this.$(id).value=value;this.updateSettingsAvatarPreview();if(this.portal.admin)this.status('githubStatus','اتصال مدیریت برقرار است.','success');}
  requireAdminConnection(){if(this.portal.admin||this.portal.preview)return true;this.navigate('settings');this.notice('برای این کار ابتدا توکن مدیریت GitHub را متصل کنید.');return false;}
  choices(targetId,accounts,selected=[]){const container=this.$(targetId);container.replaceChildren();for(const account of accounts){const label=element('label','recipient-chip'),input=element('input');input.type='checkbox';input.value=account.id;input.checked=selected.includes(account.id);input.addEventListener('change',()=>this.updateRecipientCount());label.append(input,document.createTextNode(`${account.name} · ${account.grade||ROLE_LABELS[account.role]||''}`));container.append(label);}if(!accounts.length)container.append(element('p','field-help','دانش‌آموزی در دسترس نیست.'));}
  updateRecipientCount(){this.$('recipientCount').textContent=`${number(this.$('recipientChoices').querySelectorAll('input:checked').length)} گیرنده انتخاب شده`;}
  async openComposer(studentId){if(!this.isStaff())return;if(this.view.role==='admin'&&!this.requireAdminConnection())return;try{await this.refreshDirectory();this.files=[];this.$('composerForm').reset();this.$('messageBody').value='';this.$('composerAttachments').replaceChildren();this.$('composerProgress').classList.add('hidden');this.status('composerStatus','');this.choices('recipientChoices',this.studentAccounts(),studentId?[studentId]:[]);this.updateRecipientCount();this.$('composerDialog').showModal();this.$('messageTitle').focus();}catch(error){this.toast(errorText(error));}}
  renderComposerFiles(){const target=this.$('composerAttachments');target.replaceChildren();this.files.forEach((file,index)=>{const row=element('div','composer-file');row.append(icon(file.type.startsWith('image/')?'image':'file'),element('span','',file.name),element('small','',fileSize(file.size)),button('درج در متن',null,()=>{const input=this.$('messageBody'),marker=`\n[پیوست:${index+1}]\n`,start=input.selectionStart??input.value.length;input.value=input.value.slice(0,start)+marker+input.value.slice(input.selectionEnd??start);input.focus();input.setSelectionRange(start+marker.length,start+marker.length);},'text-button'));const remove=button('', 'close',()=>{const oldCount=this.files.length;this.files.splice(index,1);let text=this.$('messageBody').value;for(let slot=index+1;slot<=oldCount;slot++)text=text.replaceAll(`[پیوست:${slot}]`,slot===index+1?'':`[پیوست:${slot-1}]`);this.$('messageBody').value=text;this.renderComposerFiles();},'icon-button');remove.setAttribute('aria-label','حذف پیوست');row.append(remove);target.append(row);});}
  composerBlocks(){const text=this.$('messageBody').value,blocks=[],regex=/\[پیوست:(\d+)\]/g;let position=0;for(const match of text.matchAll(regex)){if(match.index>position)blocks.push({type:'text',text:text.slice(position,match.index)});blocks.push({type:'attachment',fileIndex:Number(match[1])-1});position=match.index+match[0].length;}if(position<text.length)blocks.push({type:'text',text:text.slice(position)});return blocks;}
  async sendMessage(event){event.preventDefault();if(this.busy)return;const recipients=Array.from(this.$('recipientChoices').querySelectorAll('input:checked'),node=>node.value);if(!recipients.length){this.status('composerStatus','حداقل یک گیرنده انتخاب کنید.','error');return;}this.busy=true;this.$('sendMessageBtn').disabled=true;this.status('composerStatus','در حال رمزگذاری و ارسال…');try{const result=await this.portal.publishMessage({title:this.$('messageTitle').value,category:this.$('messageCategory').value,pinned:this.$('messagePinned').checked,recipients,blocks:this.composerBlocks(),files:this.files},progress=>{const node=this.$('composerProgress');node.classList.remove('hidden');node.querySelector('div').style.width=`${Math.round(progress*100)}%`;node.querySelector('span').textContent=`ارسال درخواست · ${number(Math.round(progress*100))}٪`;});this.pending=result.status==='pending';this.busy=false;this.$('composerDialog').close();this.toast(this.pending?'درخواست ارسال شد؛ در انتظار تأیید انتشار.':'پیام شما منتشر شد.');await this.refresh({quiet:true});}catch(error){this.status('composerStatus',errorText(error),'error');}finally{this.busy=false;this.$('sendMessageBtn').disabled=false;}}
  accountRoleChanged(){const teacher=this.$('accountRole').value==='teacher';this.$('teacherAssignments').classList.toggle('hidden',!teacher);this.$('accountGrade').required=!teacher;}
  async openAccount(account){if(this.view.role!=='admin'||!this.requireAdminConnection())return;await this.refreshDirectory();this.$('accountForm').reset();this.status('accountStatus','');this.$('createdCredentials').classList.add('hidden');this.$('createdCredentials').replaceChildren();this.$('accountHeading').textContent=account?'ویرایش حساب':'ایجاد حساب جدید';this.$('saveAccountBtn').textContent=account?'ذخیره تغییرات':'ایجاد حساب';this.$('saveAccountBtn').disabled=false;this.$('accountId').value=account?.id||'';this.accountRevision=account?.revision;this.$('accountName').value=account?.name||'';this.$('accountRole').value=account?.role||'student';this.$('accountRole').disabled=Boolean(account);this.$('accountGrade').value=account?.grade||'';this.$('accountSubject').value=account?.subject||'';this.$('accountLoginKey').value=account?'':SalehinBackend.generateLoginKey();this.$('accountLoginKey').disabled=Boolean(account);this.$('accountPassword').disabled=Boolean(account);this.$('accountPassword').required=!account;this.$('generateLoginKey').disabled=Boolean(account);const raw=this.portal.catalog?.students?.find(item=>item.id===account?.id);this.$('teacherAllStudents').checked=Boolean(raw?.allStudents);this.choices('assignmentChoices',this.studentAccounts(),raw?.assignedIds||[]);this.accountRoleChanged();this.$('accountDialog').showModal();}
  async saveAccount(event){event.preventDefault();if(this.busy)return;this.busy=true;this.$('saveAccountBtn').disabled=true;const id=this.$('accountId').value,profile={name:this.$('accountName').value.trim(),grade:this.$('accountGrade').value.trim(),subject:this.$('accountSubject').value.trim()},assignedIds=Array.from(this.$('assignmentChoices').querySelectorAll('input:checked'),node=>node.value);try{if(id){await this.portal.updateAccount(id,{profile,assignedIds,allStudents:this.$('teacherAllStudents').checked,expectedRevision:this.accountRevision});this.busy=false;this.$('accountDialog').close();this.toast('اطلاعات حساب به‌روز شد.');}else{const result=await this.portal.createAccount({profile,role:this.$('accountRole').value,loginKey:this.$('accountLoginKey').value,password:this.$('accountPassword').value,assignedIds,allStudents:this.$('teacherAllStudents').checked});const panel=this.$('createdCredentials');panel.replaceChildren(element('strong','','حساب ایجاد شد.'),element('p','','کلید ورود را همراه رمز تعیین‌شده، خصوصی تحویل دهید.'),element('code','',result.loginKey));panel.classList.remove('hidden');this.$('accountPassword').value='';this.$('saveAccountBtn').disabled=true;this.status('accountStatus','حساب با موفقیت ایجاد شد.','success');}await this.refresh({quiet:true});}catch(error){this.status('accountStatus',errorText(error),'error');this.$('saveAccountBtn').disabled=false;}finally{this.busy=false;if(id)this.$('saveAccountBtn').disabled=false;}}
  async confirm(text,{password=false}={}){this.$('confirmText').textContent=text;this.$('confirmPasswordField').classList.toggle('hidden',!password);this.$('confirmPassword').value='';this.$('confirmPassword').setCustomValidity('');this.$('confirmDialog').showModal();return new Promise(resolve=>{const finish=value=>{this.$('confirmDialog').close();this.$('confirmPassword').value='';resolve(value);};this.$('confirmCancel').onclick=()=>finish(null);this.$('confirmAccept').onclick=()=>{if(password&&this.$('confirmPassword').value.length<12){this.$('confirmPassword').setCustomValidity('حداقل ۱۲ نویسه وارد کنید.');this.$('confirmPassword').reportValidity();return;}this.$('confirmPassword').setCustomValidity('');finish(password?this.$('confirmPassword').value:true);};this.$('confirmDialog').oncancel=()=>resolve(null);});}
  async toggleAccount(account){if(!this.requireAdminConnection())return;const accepted=await this.confirm(`حساب «${account.name}» ${account.disabled?'فعال':'غیرفعال'} شود؟`);if(!accepted)return;try{await this.portal.updateAccount(account.id,{disabled:!account.disabled,expectedRevision:account.revision});await this.refresh({quiet:true});this.toast('وضعیت حساب تغییر کرد.');}catch(error){this.toast(errorText(error));}}
  async resetPassword(account){if(!this.requireAdminConnection())return;const password=await this.confirm(`رمز عبور «${account.name}» بازنشانی شود؟ ورودهای قبلی منقضی می‌شوند.`,{password:true});if(!password)return;try{await this.portal.resetAccountPassword(account.id,password,account.revision);await this.refresh({quiet:true});this.toast('رمز عبور بازنشانی شد.');}catch(error){this.toast(errorText(error));}}
  async deleteMessage(message){if(!this.requireAdminConnection())return;if(!await this.confirm(`پیام «${message.title}» از فهرست فعلی حذف شود؟ نسخه‌های قبلی دریافت‌شده باقی می‌مانند.`))return;try{await this.portal.deleteMessage(message.id);await this.refresh({quiet:true});this.toast('پیام از فهرست حذف شد.');}catch(error){this.toast(errorText(error));}}
  async openScore(studentId){if(!this.isStaff()||(this.view.role==='admin'&&!this.requireAdminConnection()))return;await this.refreshDirectory();this.$('scoreForm').reset();this.status('scoreStatus','');this.$('scoreStudent').replaceChildren();for(const student of this.studentAccounts()){const option=element('option','',`${student.name} · ${student.grade}`);option.value=student.id;option.selected=student.id===studentId;this.$('scoreStudent').append(option);}this.$('scoreDialog').showModal();}
  async saveScore(event){event.preventDefault();if(this.busy)return;this.busy=true;this.$('saveScoreBtn').disabled=true;try{const score={title:this.$('scoreTitle').value,score:Number(this.$('scoreValue').value),total:Number(this.$('scoreTotal').value),feedback:this.$('scoreFeedback').value};const result=await this.portal.publishMessage({title:`نمره ${score.title}`,category:'score',recipients:[this.$('scoreStudent').value],blocks:[{type:'text',text:score.feedback}],files:[],score});this.busy=false;this.$('scoreDialog').close();this.toast(result.status==='pending'?'نمره در صف انتشار قرار گرفت.':'نمره ثبت شد.');await this.refresh({quiet:true});}catch(error){this.status('scoreStatus',errorText(error),'error');}finally{this.busy=false;this.$('saveScoreBtn').disabled=false;}}
  async saveProfile(event){event.preventDefault();if(this.busy)return;if(this.view.role==='admin'&&!this.requireAdminConnection())return;const submit=event.submitter;this.busy=true;if(submit)submit.disabled=true;try{const hasAvatar=Boolean(this.croppedAvatarFile);const result=await this.portal.updateOwnProfile({name:this.$('settingsName').value,title:this.$('settingsTitle').value,subject:this.$('settingsSubject').value,avatarFile:this.croppedAvatarFile||undefined});this.$('settingsAvatar').value='';if(result.status==='pending'){this.profileUpdatePending=true;this.profileAvatarPending=hasAvatar;this.pending=true;this.status('profileFormStatus','تغییر پروفایل در صف انتشار قرار گرفت؛ این فرم تا همگام‌سازی، تغییرات شما را نگه می‌دارد.','success');await this.refresh({quiet:true});}else{for(const id of ['settingsName','settingsTitle','settingsSubject'])this.settingsDraftDirty.delete(id);this.status('profileFormStatus','پروفایل ذخیره شد.','success');await this.refresh({quiet:true});this.clearCropSelection();this.updateSettingsAvatarPreview();}}catch(error){this.status('profileFormStatus',errorText(error),'error');}finally{this.busy=false;if(submit)submit.disabled=false;}}
  async saveSite(event){event.preventDefault();if(!this.requireAdminConnection())return;const submit=event.submitter;if(submit)submit.disabled=true;try{await this.portal.saveSite({schoolName:this.$('settingsSchoolName').value,schoolYear:this.$('settingsSchoolYear').value});this.settingsDraftDirty.delete('settingsSchoolName');this.settingsDraftDirty.delete('settingsSchoolYear');this.status('siteStatus','تنظیمات مدرسه ذخیره شد.','success');await this.refresh({quiet:true});}catch(error){this.status('siteStatus',errorText(error),'error');}finally{if(submit)submit.disabled=false;}}
  async exportKeys(){if(!this.requireAdminConnection())return;const password=await this.confirm('برای فایل پشتیبان رمز مستقل تعیین کنید و آن را جدا از فایل نگه دارید.',{password:true});if(!password)return;try{const backup=await this.portal.exportKeys(password);this.download('salehinsc-encrypted-keys.json',new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));}catch(error){this.toast(errorText(error));}}
  async importKeys(event){const file=event.target.files?.[0];event.target.value='';if(!file||!this.requireAdminConnection())return;const password=await this.confirm('رمز فایل پشتیبان را وارد کنید.',{password:true});if(!password)return;try{await this.portal.importKeys(JSON.parse(await file.text()),password);await this.refreshDirectory();this.toast('پشتیبان کلیدها بازیابی شد.');}catch(error){this.toast(errorText(error));}}
}
globalThis.SalehinUI=Object.freeze({SchoolUI,icon,formatDate,fileSize,errorText,fitWithin,optimizeUploadImage});
async function startSchool(){
  const preview=new URLSearchParams(location.search).get('preview');
  let portal;
  if(ROLE_LABELS[preview]){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./preview.js';script.onload=resolve;script.onerror=()=>reject(new Error('Preview could not be loaded.'));document.head.append(script);});portal=new SalehinPreview(preview);}
  else {const config=globalThis.SALEHIN_CONFIG_READY?await globalThis.SALEHIN_CONFIG_READY:SALEHIN_CONFIG;portal=new SalehinRoles.RolePortal(config);}
  const ui=new SchoolUI(portal);await ui.init();
}
startSchool().catch(error=>{document.getElementById('loginStatus').textContent=errorText(error);document.getElementById('loginBtn').disabled=false;});
