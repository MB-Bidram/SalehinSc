/* Explicit, read-only sample data. This adapter never contacts GitHub. */
'use strict';
globalThis.SalehinPreview = class PreviewPortal {
  constructor(role) {
    this.preview=true;this.admin=role==='admin';this.role=role;
    this.store={async get(){return null;},async set(){},async delete(){}};
    this.accounts=[{id:'sample-student-1',name:'علی رضایی',grade:'هفتم / ۱',role:'student'},{id:'sample-student-2',name:'محمد احمدی',grade:'هفتم / ۱',role:'student'},{id:'sample-student-3',name:'امیرحسین کریمی',grade:'هشتم / ۲',role:'student'},{id:'sample-teacher',name:'محمدعلی کریمی',grade:'دبیر',role:'teacher',subject:'ریاضی',title:'مدیر گروه آموزشی'},{id:'sample-admin',name:'AdminSrc',grade:'مدیریت',role:'admin'}].map(item=>({...item,revision:'sample',disabled:false}));
    this.catalog={students:this.accounts};
    const profile=this.accounts.find(item=>item.role===role);
    const attachment={id:'sample-file',name:'راهنمای آمادگی آزمون.txt',size:2400,mime:'text/plain',inline:false,kind:'file'};
    this.view={id:profile.id,role,profile:{...profile,assessments:[{title:'ریاضی — فعالیت کلاسی',score:19,total:20,date:'2026-10-28'},{title:'علوم تجربی — آزمون فصل اول',score:18.5,total:20,date:'2026-10-25'}]},site:{schoolName:'دبیرستان صالحین',schoolYear:'۱۴۰۵ — ۱۴۰۶'},attachments:[],announcements:[],updatedAt:new Date().toISOString(),messages:[
      {id:'sample-message-1',category:'announcement',pinned:true,createdAt:'2026-10-29T08:30:00Z',authorId:'sample-teacher',author:{name:'محمدعلی کریمی',role:'teacher',title:'مدیر گروه آموزشی'},title:'برنامه‌ریزی امتحانات و نکات مهم',blocks:[{type:'text',text:'با سلام و احترام\n\nبا نزدیک شدن به زمان امتحانات، از دانش‌آموزان عزیز دعوت می‌کنیم برنامه مطالعه خود را تنظیم کنند. راهنمای آمادگی آزمون در پیوست این پیام قرار گرفته است.\n\nنکات مهم:\n• حضور به‌موقع در کلاس و همراه داشتن وسایل مورد نیاز\n• مرور تمرین‌های فصل اول و پرسیدن سؤال‌ها از دبیر مربوطه\n• توجه به زمان‌بندی و برنامه اعلام‌شده مدرسه\n\nبرای همه شما آرزوی موفقیت داریم.'},{type:'attachment',attachmentId:attachment.id}],attachments:[attachment]},
      {id:'sample-message-2',category:'message',pinned:false,createdAt:'2026-10-28T10:00:00Z',authorId:'sample-teacher',author:{name:'محمدعلی کریمی',role:'teacher',title:'دبیر ریاضی'},title:'تمرین‌های این هفته؛ یک قدم رو به جلو',blocks:[{type:'text',text:'دانش‌آموزان عزیز، تمرین‌های صفحه ۲۴ تا ۲۷ را تا جلسه آینده حل کنید. مراحل حل مسئله را هم بنویسید؛ مسیر رسیدن به پاسخ به‌اندازه خود پاسخ ارزشمند است.\n\nجلسه آینده، پاسخ‌ها را با هم بررسی می‌کنیم.'}],attachments:[]}
    ]};
  }
  async refreshStudent(){return structuredClone(this.view);}
  async loadDirectory(){return structuredClone(this.accounts.filter(item=>this.role==='admin'||item.role==='student'));}
  async logout(){this.view=null;}
  async login(){throw new Error('برای ورود واقعی، نشانی صفحه را بدون preview باز کنید.');}
  async pendingStatus(){return null;}
  async readFile(){return new Blob(['این فایل نمونه برای بررسی رابط کاربری است.'],{type:'application/octet-stream'});}
  readOnly(){throw new Error('پیش‌نمایش فقط برای بررسی رابط کاربری است. برای ذخیره، وارد حساب واقعی شوید.');}
  async publishMessage(){this.readOnly();}
  async createAccount(){this.readOnly();}
  async updateAccount(){this.readOnly();}
  async updateOwnProfile(){this.readOnly();}
  async resetAccountPassword(){this.readOnly();}
  async deleteMessage(){this.readOnly();}
  async saveSite(){this.readOnly();}
  async connectAdmin(){this.readOnly();}
  async exportKeys(){this.readOnly();}
  async importKeys(){this.readOnly();}
};
