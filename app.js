let myEmail=null, myRole=null, myName='مستخدم';
let reports=[]; let selectedId=null; let filterDate=todayStr();
let seenIds=new Set(JSON.parse(localStorage.getItem('seenReports')||'[]'));
let notifOn = localStorage.getItem('notifOn')==='1';
let unsub=null;
const app=document.getElementById('app');

function todayStr(){return new Date().toISOString().slice(0,10);}

auth.onAuthStateChanged(async user=>{
  if(!user){ renderLogin(); return; }
  myEmail = user.email;
  await loadRole();
});

async function loadRole(){
  app.innerHTML='<div class="empty">جارِ التحقق من الحساب…</div>';
  const roleRef = db.collection('roles').doc(myEmail);
  const doc = await roleRef.get();
  if(doc.exists){
    myRole = doc.data().role; myName = doc.data().name || myEmail;
    startApp();
    return;
  }
  // مفيش دور محفوظ لهذا الإيميل - نتحقق هل يوجد أدمن أصلاً
  const admins = await db.collection('roles').where('role','==','admin').limit(1).get();
  if(admins.empty){
    // أول شخص يسجل دخول = أدمن تلقائيًا (خطوة تفعيل أولى فقط)
    await roleRef.set({role:'admin', name: myEmail.split('@')[0]});
    myRole='admin'; myName=myEmail.split('@')[0];
    startApp();
  } else {
    app.innerHTML = `<div class="empty">حسابك (${myEmail}) لسه مش مضاف كمشرفة.<br>كلمي إدارة الحضانة عشان تضيفك من شاشة الأدمن.<br><br><button class="btn-secondary" onclick="auth.signOut()">تسجيل خروج</button></div>`;
  }
}

function renderLogin(){
  app.innerHTML = `<div class="card" style="max-width:360px;margin:60px auto;">
    <h2 style="text-align:center;color:var(--accent)">🧸 تسجيل الدخول</h2>
    <label>البريد الإلكتروني</label><input id="loginEmail" type="email">
    <label>كلمة المرور</label><input id="loginPass" type="password">
    <div style="margin-top:14px"><button class="btn-primary" style="width:100%" onclick="doLogin()">دخول</button></div>
    <p id="loginErr" style="color:#d16a6a;font-size:.85rem"></p>
  </div>`;
}
async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const pass=document.getElementById('loginPass').value;
  try{ await auth.signInWithEmailAndPassword(email,pass); }
  catch(e){ document.getElementById('loginErr').textContent='بيانات الدخول غلط أو الحساب مش موجود.'; }
}

function startApp(){
  db.collection('reports').orderBy('createdAt','desc').limit(200).onSnapshot(snap=>{
    const prevIds=new Set(reports.map(r=>r.id));
    reports = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(myRole==='admin'){
      const newOnes = reports.filter(r=>!prevIds.has(r.id) && r.supervisorEmail!==myEmail && !seenIds.has(r.id));
      newOnes.forEach(notify);
    }
    render();
  });
  render();
}

function notify(r){
  seenIds.add(r.id); localStorage.setItem('seenReports',JSON.stringify([...seenIds]));
  if(notifOn && 'Notification' in window && Notification.permission==='granted'){
    new Notification('تقرير يومي جديد', {body:`${r.supervisorName} — فصل ${r.className}`});
  }
}
async function enableNotif(){
  if(!('Notification' in window)) return;
  const p = await Notification.requestPermission();
  notifOn = p==='granted'; localStorage.setItem('notifOn', notifOn?'1':'0'); render();
}

async function submitReport(ev){
  ev.preventDefault();
  const f=ev.target;
  await db.collection('reports').add({
    supervisorEmail: myEmail, supervisorName: myName,
    className: f.className.value.trim(), text: f.text.value.trim(),
    date: todayStr(), createdAt: Date.now(), replies: []
  });
  f.reset(); alert('تم إرسال التقرير ✅');
}

async function sendReply(reportId){
  const box=document.getElementById('replyBox_'+reportId);
  const text=box.value.trim(); if(!text) return;
  const rep = reports.find(r=>r.id===reportId);
  const replies = (rep.replies||[]).concat([{by:myEmail,name:myName,text,at:Date.now()}]);
  await db.collection('reports').doc(reportId).update({replies});
  box.value='';
}

async function addSupervisor(ev){
  ev.preventDefault();
  const f=ev.target;
  const email=f.email.value.trim(); const name=f.name.value.trim();
  await db.collection('roles').doc(email).set({role:'supervisor', name});
  f.reset();
  alert('تمت الإضافة. لازم كمان تعملي للسوبر فايزر حساب بنفس الإيميل ده من Firebase Console > Authentication > Add user، وتدّيها كلمة السر.');
}

function printReport(id){
  const r = reports.find(x=>x.id===id); if(!r) return;
  const html = `<h2>تقرير — فصل ${r.className}</h2>
    <p><b>التاريخ:</b> ${r.date}</p>
    <p><b>المشرفة:</b> ${r.supervisorName}</p><hr>
    <p>${(r.text||'-').replace(/\n/g,'<br>')}</p>`;
  const pa=document.getElementById('printArea'); pa.innerHTML=html; pa.style.display='block';
  window.print();
  setTimeout(()=>{pa.style.display='none';},500);
}

let adminTab='reports';
function setTab(t){ adminTab=t; render(); }

function render(){
  const header = `<header class="top"><h1>🧸 تقارير الحضانة</h1>
    <div class="row">
      <span class="pill">${myRole==='admin'?'مدير':'مشرفة'} — ${myName}</span>
      ${myRole==='admin'?`<button class="btn-secondary" onclick="enableNotif()">${notifOn?'🔔 الإشعارات مفعّلة':'🔕 تفعيل الإشعارات'}</button>`:''}
      <button class="btn-secondary" onclick="auth.signOut()">خروج</button>
    </div></header>`;
  app.innerHTML = header + (myRole==='admin'? adminView() : supervisorView());
  const f1=document.getElementById('reportForm'); if(f1) f1.onsubmit=submitReport;
  const f2=document.getElementById('addSupForm'); if(f2) f2.onsubmit=addSupervisor;
}

function supervisorView(){
  const mine = reports.filter(r=>r.supervisorEmail===myEmail);
  return `<div class="card">
    <h3>إضافة تقرير لفصل</h3>
    <form id="reportForm">
      <label>اسم الفصل</label><input name="className" required>
      <label>التقرير</label><textarea name="text" rows="5" placeholder="اكتبي التقرير بحرية..." required></textarea>
      <div style="margin-top:12px"><button class="btn-primary" type="submit">إرسال</button></div>
    </form>
  </div>
  <h3>تقاريري</h3>
  ${mine.length? mine.map(r=>reportCard(r,false)).join('') : '<div class="empty">لا يوجد تقارير بعد</div>'}`;
}

function adminView(){
  const tabs = `<div class="tabs">
    <div class="tab ${adminTab==='reports'?'active':''}" onclick="setTab('reports')">كل التقارير</div>
    <div class="tab ${adminTab==='supervisors'?'active':''}" onclick="setTab('supervisors')">إدارة السوبر فايزر</div>
  </div>`;
  if(adminTab==='supervisors') return tabs + supervisorsAdmin();

  const list = reports.map(r=>`
    <div class="report-item ${r.id===selectedId?'active':''}" onclick="selectReport('${r.id}')">
      <div class="name">${r.supervisorName} ${!seenIds.has(r.id)?'<span class="badge">جديد</span>':''}</div>
      <div class="meta">${r.date} — فصل ${r.className}</div>
    </div>`).join('') || '<div class="empty">لا يوجد تقارير</div>';
  const sel = reports.find(r=>r.id===selectedId) || reports[0];
  const detail = sel ? reportCard(sel, true) : '<div class="empty">اختر تقريرًا لعرضه</div>';
  return tabs + `<div class="grid"><div class="card">${list}</div><div>${detail}</div></div>`;
}

function supervisorsAdmin(){
  return `<div class="card">
    <h3>إضافة سوبر فايزر</h3>
    <form id="addSupForm">
      <label>الاسم</label><input name="name" required>
      <label>البريد الإلكتروني</label><input name="email" type="email" required>
      <div style="margin-top:12px"><button class="btn-primary" type="submit">إضافة</button></div>
    </form>
    <p style="color:var(--muted);font-size:.8rem;margin-top:10px">بعد الإضافة هنا، لازم كمان تعملي حساب دخول بنفس الإيميل من Firebase Console › Authentication › Add user، وتدّي السوبر فايزر كلمة السر.</p>
  </div>`;
}

function selectReport(id){ selectedId=id; seenIds.add(id); localStorage.setItem('seenReports',JSON.stringify([...seenIds])); render(); }

function reportCard(r, withReply){
  const replies=(r.replies||[]).map(rp=>`<div class="reply"><span class="who">${rp.name}</span> — ${new Date(rp.at).toLocaleString('ar-EG')}<br>${rp.text}</div>`).join('');
  return `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:center">
      <div><b>${r.supervisorName}</b> — ${r.date} — فصل ${r.className}</div>
      <button class="btn-secondary" onclick="printReport('${r.id}')">🖨️ طباعة PDF</button>
    </div>
    <p style="white-space:pre-wrap">${r.text}</p>
    ${replies}
    ${withReply?`<div style="margin-top:8px"><textarea id="replyBox_${r.id}" rows="2" placeholder="اكتب ردًا..."></textarea>
      <button class="btn-primary" style="margin-top:6px" onclick="sendReply('${r.id}')">إرسال الرد</button></div>`:''}
  </div>`;
}
