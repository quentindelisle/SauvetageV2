/* =========================================================
   Modes — accueil, mode enseignant, mode élève
   ========================================================= */
(function(){
'use strict';
const { $, $$, esc, toast, ask, go, TITLES, enterHooks, leaveHooks } = App;
QR.config({ toast });

/* ---------- Icônes ---------- */
const I = {
  users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2c2.9.3 5 2.6 5 5.8"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  today:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>',
  scan:'<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>',
  qr:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  person:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
  pool:'<svg viewBox="0 0 24 24"><path d="M2 16c2 0 2-1.5 4-1.5S8 16 10 16s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2 20c2 0 2-1.5 4-1.5S8 20 10 20s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><circle cx="12" cy="6" r="2.5"/><path d="M12 8.5v3"/></svg>',
  pillar:'<svg viewBox="0 0 24 24"><path d="M3 21h18M4 7h16M12 3l8 4H4zM6 7v14M10 7v14M14 7v14M18 7v14"/></svg>',
  chrono:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg>',
  gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  send:'<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  file:'<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/* ---------- Écrans ---------- */
const VIEWS = {
  pclass:'Élèves de la classe', pprog:'Programmation du cycle', plesson:'Leçon du jour', precv:'Récupérer les résultats',
  pbilan:'Bilan de la leçon', pcycle:'Bilan du cycle', ppil:'Piliers d’enseignement', pset:'Réglages',
  epil:'Pilier de la leçon', epar:'Parcours du jour', escan:'Scanner le cours', esend:'Exporter mes résultats',
};
const main = document.querySelector('main');
Object.entries(VIEWS).forEach(([k,t])=>{
  TITLES[k]=t;
  const sec=document.createElement('section'); sec.className='view'; sec.dataset.view=k;
  sec.innerHTML=`<div class="wrap" id="v-${k}"></div>`;
  main.appendChild(sec);
});
const V = (k)=>$('#v-'+k);

/* Accès selon le rôle de l'appareil */
const ELEVE_OK = ['home','view','chrono','epil','epar','escan','esend'];
App.guard = (name)=>{
  const r=Classe.role();
  if(!r) return name==='home';
  if(r==='eleve') return ELEVE_OK.includes(name);
  return !/^e(pil|par|scan|send)$/.test(name);
};

/* ---------- Fenêtres superposées ---------- */
function overlay(title, html, cls=''){
  const ov=document.createElement('div'); ov.className='overlay';
  ov.innerHTML=`<div class="overlay-box ${cls}"><div class="overlay-head"><h3>${title}</h3><button class="iconbtn" data-x aria-label="Fermer">${I.x}</button></div><div class="overlay-body">${html}</div></div>`;
  document.body.appendChild(ov);
  const close=()=>{ QR.stopScan(); ov.remove(); };
  ov.addEventListener('click', e=>{ if(e.target===ov || e.target.closest('[data-x]')) close(); });
  return { el:ov, body:ov.querySelector('.overlay-body'), close };
}
function choice(title, msg, opts){
  return new Promise(res=>{
    const o=overlay(esc(title), `<p>${esc(msg)}</p><div class="btnrow end">${opts.map((x,i)=>`<button class="btn ${x.cls||'ghost'}" data-i="${i}">${esc(x.label)}</button>`).join('')}</div>`, 'sm');
    o.el.addEventListener('click', e=>{ const b=e.target.closest('[data-i]'); if(b){ o.close(); res(opts[+b.dataset.i].value); } });
    o.el.querySelector('[data-x]').addEventListener('click', ()=>res(null));
  });
}
async function askPin(){
  const v = await ask({title:'Code enseignant', msg:'Saisissez le code à 4 chiffres (0000 par défaut).', input:true, ok:'Valider'});
  if(v===null) return false;
  if(Classe.checkPin(v)) return true;
  toast('Code incorrect', true); return false;
}
const fmt = (ms)=>Chrono.fmt(ms);
const pct = (x)=>x.tot ? Math.round(x.yes/x.tot*100) : null;
const pctCls = (p)=>p==null ? 'none' : p>=75 ? 'hi' : p>=50 ? 'mid' : p>=25 ? 'low' : 'vlow';
function attTag(a){ return a==='abs' ? '<span class="tag abs">Absent</span>' : a==='inap' ? '<span class="tag inap">Inapte</span>' : ''; }
function lessonPicker(c, sel, act){
  return `<div class="lesson-picker">${Array.from({length:c.nb},(_,i)=>i+1).map(n=>`<button type="button" class="${n===sel?'on':''} ${n===c.cur?'cur':''}" data-act="${act}" data-n="${n}">${n}</button>`).join('')}</div>`;
}
function needClass(k){
  const c=Classe.active();
  if(!c){ V(k).innerHTML = `<div class="empty">Aucune classe sur cet appareil.<br><br><button class="btn blue" data-act="newClass">${I.plus}Créer une classe</button></div>`; return null; }
  return c;
}
async function newClass(){
  const name = await ask({title:'Nouvelle classe', msg:'Nom de la classe (ex. 2nde 4).', input:true, ok:'Créer'});
  if(!name) return null;
  const c=Classe.newClass(name); toast(`Classe ${c.name} créée`); return c;
}

/* =========================================================
   ACCUEIL (selon le rôle)
   ========================================================= */
const homeHost = $('[data-view="home"]');
enterHooks.home = renderHome;
function hero(sub){
  return `<div class="home-hero compact"><img class="home-logo" src="assets/logo.jpg" alt="N'EPS Sauvetage" width="480" height="480">
    <div><h2 class="home-title">Sauvetage aquatique CA2<br><span>${sub}</span></h2></div></div>`;
}
function tile(act, ico, title, sub, cls=''){ return `<button class="tile ${cls}" data-act="${act}">${ico}<b>${title}</b><span>${sub}</span></button>`; }
function renderHome(){
  const r=Classe.role();
  App.$('#appTitle').textContent = 'Sauvetage CA2';
  if(!r){
    homeHost.innerHTML = `<div class="home">${hero('Parcours, chronométrie & observation')}
      <h3 class="section-title center">Qui utilise cet appareil ?</h3>
      <div class="role-pick">
        <button class="role-btn prof" data-act="roleProf">${I.person}<b>Enseignant</b><span>Classe et appel, programmation du cycle, leçon du jour, QR des tablettes, bilans</span></button>
        <button class="role-btn eleve" data-act="roleEleve">${I.pool}<b>Élève</b><span>Scanner le cours, consulter le pilier et les parcours, chronométrer, envoyer ses résultats</span></button>
      </div>
      <p class="muted small center">Le choix est mémorisé sur cet appareil ; il se change ensuite dans les réglages.</p></div>`;
    return;
  }
  if(r==='prof') return renderProfHome();
  return renderEleveHome();
}
function renderProfHome(){
  const cs=Classe.classes(), c=Classe.active();
  let today='';
  if(c){
    const L=Classe.lesson(c, c.cur);
    const abs=Object.values(L.att).filter(v=>v==='abs').length, inap=Object.values(L.att).filter(v=>v==='inap').length;
    const pils=L.pil.map(Classe.pilier).filter(Boolean);
    today = `<div class="card today-card">
      <div class="today-head"><div><div class="eyebrow">Leçon du jour · ${esc(c.name)}</div>
        <div class="current-name">Leçon ${c.cur} <span class="muted">/ ${c.nb}</span></div></div>
        <button class="btn orange" data-act="showSeanceQR">${I.qr}QR de la leçon</button></div>
      <div class="chips">${pils.length ? pils.map(p=>`<span class="pchip">${esc(p.n)}</span>`).join('') : '<span class="muted small">Aucun pilier programmé pour cette leçon</span>'}</div>
      <div class="muted small">${c.students.length} élève${c.students.length>1?'s':''} · ${L.par.length} parcours · ${abs} absent${abs>1?'s':''} · ${inap} inapte${inap>1?'s':''} · ${Classe.resultsOf(c, c.cur).length} passage(s) reçu(s)</div>
    </div>`;
  }
  homeHost.innerHTML = `<div class="home">${hero('Mode enseignant')}
    ${cs.length ? `<div class="card class-bar"><span class="field-lbl">Classe</span>
      <select id="homeClass">${cs.map(x=>`<option value="${x.id}" ${c&&x.id===c.id?'selected':''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ Nouvelle classe…</option></select></div>` : ''}
    ${c ? today : `<div class="empty">Commencez par créer une classe.<br><br><button class="btn blue lg" data-act="newClass">${I.plus}Créer une classe</button></div>`}
    <div class="tiles">
      ${tile('go:pclass', I.users, 'Élèves', c ? `${c.students.length} élève(s) · import Pronote` : 'Import Pronote')}
      ${tile('go:pprog', I.cal, 'Programmation du cycle', c ? `${c.nb} leçons · piliers par leçon` : 'Leçons et piliers')}
      ${tile('go:plesson', I.today, 'Leçon du jour', 'Appel, parcours, QR des tablettes')}
      ${tile('go:precv', I.scan, 'Récupérer les résultats', 'Scanner les QR des tablettes')}
      ${tile('go:pbilan', I.chart, 'Bilan de la leçon', 'Temps et critères observés')}
      ${tile('go:pcycle', I.person, 'Bilan du cycle', 'Trace individuelle · export Excel')}
      ${tile('go:library', I.pool, 'Parcours', 'Créer, modifier, visualiser')}
      ${tile('go:ppil', I.pillar, 'Piliers', `${Classe.piliers().length} pilier(s) · critères et observables`)}
      ${tile('go:chrono', I.chrono, 'Chronométrer', 'Sur cet appareil (dépannage)')}
    </div>
    <div class="btnrow center home-foot"><button class="btn ghost" data-act="go:pset">${I.gear}Réglages</button></div></div>`;
  const sel=$('#homeClass');
  if(sel) sel.onchange = async ()=>{
    if(sel.value==='__new'){ const nc=await newClass(); if(!nc) sel.value=c?c.id:''; renderHome(); return; }
    Classe.setActive(sel.value); App.ChronoUI.drop(); renderHome();
  };
}
function renderEleveHome(){
  const s=Classe.seance();
  if(!s){
    homeHost.innerHTML = `<div class="home">${hero('Mode élève')}
      <div class="card scan-first"><h3>Récupère le cours</h3>
        <p class="muted">Ton enseignant affiche le QR de la leçon : scanne-le pour récupérer la classe, le pilier et les parcours du jour.</p>
        <button class="btn orange lg" data-act="go:escan">${I.scan}Scanner les infos du cours</button></div>
      <div class="btnrow center home-foot"><button class="btn ghost sm" data-act="toProf">Mode enseignant</button></div></div>`;
    return;
  }
  const nMine=Classe.mineFor(s.cid, s.n).length;
  homeHost.innerHTML = `<div class="home">${hero('Mode élève')}
    <div class="card today-card">
      <div class="today-head"><div><div class="eyebrow">${esc(s.cn)}</div><div class="current-name">Leçon ${s.n}${s.nb?` <span class="muted">/ ${s.nb}</span>`:''}</div></div>
        <button class="btn ghost sm" data-act="go:escan">${I.scan}Rescanner</button></div>
      <div class="chips">${s.pils.length ? s.pils.map(p=>`<span class="pchip">${esc(p.n)}</span>`).join('') : '<span class="muted small">Pas de pilier pour cette leçon</span>'}</div>
      ${s.obj?`<p class="obj">${esc(s.obj)}</p>`:''}
      <div class="muted small">${s.st.length} élèves · ${s.pars.length} parcours · ${nMine} passage(s) enregistré(s) sur cette tablette</div>
    </div>
    <div class="tiles">
      ${tile('go:epil', I.pillar, s.pils.length>1?'Contenus des piliers':'Contenus du pilier', s.pils.map(p=>esc(p.n)).join(' · ') || '—')}
      ${tile('go:epar', I.pool, 'Parcours du jour', `${s.pars.length} parcours · animation`)}
      ${tile('go:chrono', I.chrono, 'Chronométrer', 'Temps + observation du pilier', 'hot')}
      ${tile('go:esend', I.send, 'Exporter mes résultats', `${nMine} passage(s) · QR pour l’enseignant`)}
      ${tile('go:escan', I.scan, 'Scanner les infos du cours', 'Nouvelle leçon')}
    </div>
    <div class="btnrow center home-foot"><button class="btn ghost sm" data-act="toProf">Mode enseignant</button></div></div>`;
}

/* ---------- Actions globales (délégation) ---------- */
document.addEventListener('click', async e=>{
  const a=e.target.closest('[data-act]'); if(!a) return;
  const act=a.dataset.act;
  if(act.startsWith('go:')){ go(act.slice(3)); return; }
  const fn=ACT[act]; if(fn){ e.preventDefault(); await fn(a, e); }
});
const ACT = {
  async roleProf(){ if(!(await askPin())) return; Classe.setRole('prof'); toast('Mode enseignant'); renderHome(); },
  async roleEleve(){ Classe.setRole('eleve'); toast('Mode élève'); renderHome(); },
  async toProf(){ if(!(await askPin())) return; Classe.setRole('prof'); App.ChronoUI.drop(); toast('Mode enseignant'); renderHome(); },
  async newClass(){ if(await newClass()) { const v=App.view(); if(v==='home') renderHome(); else rerender(v); } },
  showSeanceQR(){ const c=Classe.active(); if(c) showSeanceQR(c, c.cur); },
};
function rerender(v){ if(enterHooks[v]) enterHooks[v](); }

/* =========================================================
   ENSEIGNANT · Élèves (appel Pronote)
   ========================================================= */
enterHooks.pclass = renderClass;
function renderClass(){
  const c=needClass('pclass'); if(!c) return;
  const list=Classe.students(c);
  V('pclass').innerHTML = `
    <div class="card"><div class="row"><label class="field grow"><span class="field-lbl">Nom de la classe</span><input type="text" id="clsName" value="${esc(c.name)}" maxlength="40"></label>
      <button class="btn ghost danger" data-act="delClass">Supprimer la classe</button></div></div>
    <div class="card"><h3>Importer l’appel (Pronote)</h3>
      <p class="muted small">Fichier Excel ou CSV exporté de Pronote : « NOM Prénom » en colonne A, ou NOM en colonne A et Prénom en colonne B. Les élèves apparaissent ensuite sous la forme « Prénom N. ».</p>
      <div class="btnrow"><label class="btn blue">${I.file}Choisir un fichier<input type="file" id="impFile" accept=".xlsx,.xls,.csv,.txt" hidden></label></div>
      <details class="paste"><summary>… ou coller la liste</summary>
        <textarea id="impText" rows="6" placeholder="DUPONT Léa&#10;MARTIN Hugo&#10;(ou NOM [tabulation] Prénom)"></textarea>
        <button class="btn ghost" data-act="impText">Importer le texte collé</button></details></div>
    <div class="card"><h3>Ajouter un élève</h3><div class="row">
      <input type="text" id="addNom" placeholder="NOM" class="upper"><input type="text" id="addPrenom" placeholder="Prénom">
      <button class="btn green" data-act="addStudent">${I.plus}Ajouter</button></div></div>
    <div class="card"><div class="row"><h3 class="grow">${list.length} élève${list.length>1?'s':''}</h3>${list.length?'<button class="btn ghost danger sm" data-act="clearStudents">Vider la liste</button>':''}</div>
      ${list.length ? `<div class="stu-grid">${list.map(s=>`<div class="stu"><b>${esc(s.disp)}</b><span class="muted small">${esc(s.nom)} ${esc(s.prenom)}</span>
        <button class="iconbtn sm" data-act="delStudent" data-sid="${s.id}" title="Retirer">${I.x}</button></div>`).join('')}</div>` : '<div class="empty">Aucun élève : importez l’appel Pronote.</div>'}</div>`;
  $('#clsName').onchange = e=>{ Classe.renameClass(c.id, e.target.value); toast('Classe renommée'); };
  $('#impFile').onchange = async e=>{
    const f=e.target.files[0]; e.target.value=''; if(!f) return;
    try{ await importList(c, await Classe.parseFile(f)); }catch(err){ toast('Lecture impossible : '+err.message, true); }
  };
}
async function importList(c, list){
  if(!list.length){ toast('Aucun élève reconnu', true); return; }
  let replace=false;
  if(c.students.length){
    const v=await choice(`Importer ${list.length} élève(s)`, `La classe contient déjà ${c.students.length} élève(s).`, [{label:'Ajouter à la liste', value:'add', cls:'blue'},{label:'Remplacer la liste', value:'rep', cls:'red'}]);
    if(!v) return; replace = v==='rep';
  }
  const n=Classe.addStudents(c, list, replace);
  toast(`${n} élève(s) importé(s)`); renderClass();
}
Object.assign(ACT, {
  async impText(){ const c=Classe.active(); await importList(c, Classe.parseText($('#impText').value)); },
  addStudent(){ const c=Classe.active(); const nom=$('#addNom').value.trim(), prenom=$('#addPrenom').value.trim();
    if(!nom && !prenom) return toast('Saisissez un nom', true);
    Classe.addStudents(c, [{nom:nom.toUpperCase()||prenom.toUpperCase(), prenom:prenom||nom}]); renderClass(); $('#addNom').focus(); },
  async delStudent(b){ const c=Classe.active(); const s=Classe.students(c).find(x=>x.id===b.dataset.sid);
    if(await ask({title:'Retirer cet élève ?', msg:s.disp, ok:'Retirer', danger:true})){ Classe.removeStudent(c, s.id); renderClass(); } },
  async clearStudents(){ const c=Classe.active(); if(await ask({title:'Vider la liste ?', msg:'Tous les élèves de la classe seront retirés.', ok:'Vider', danger:true})){ c.students=[]; Classe.save(); renderClass(); } },
  async delClass(){ const c=Classe.active(); if(await ask({title:`Supprimer ${c.name} ?`, msg:'Élèves, programmation, leçons et résultats de la classe seront effacés de cet appareil.', ok:'Supprimer', danger:true})){ Classe.deleteClass(c.id); toast('Classe supprimée'); go('home'); } },
});

/* =========================================================
   ENSEIGNANT · Programmation du cycle
   ========================================================= */
enterHooks.pprog = renderProg;
function renderProg(){
  const c=needClass('pprog'); if(!c) return;
  const P=Classe.piliers();
  let rows='';
  for(let n=1;n<=c.nb;n++){
    const L=Classe.lesson(c,n);
    rows += `<div class="card lesson-row ${n===c.cur?'is-cur':''}">
      <div class="lr-head"><span class="ltag">Leçon ${n}</span><input type="date" value="${esc(L.date||'')}" data-n="${n}" data-f="date">
        ${n===c.cur?'<span class="badge cur">Leçon du jour</span>':`<button class="btn ghost sm" data-act="setCur" data-n="${n}">Leçon du jour</button>`}</div>
      <div class="pil-chips">${P.map(p=>`<button type="button" class="ptoggle ${L.pil.includes(p.id)?'on':''}" data-act="togPil" data-n="${n}" data-id="${p.id}">${esc(p.n)}</button>`).join('')}</div>
      <input type="text" value="${esc(L.obj||'')}" data-n="${n}" data-f="obj" placeholder="Objectif ou consignes de la leçon (facultatif, transmis aux tablettes)" maxlength="200">
    </div>`;
  }
  V('pprog').innerHTML = `<div class="card"><div class="row"><div class="grow"><span class="field-lbl">Nombre de leçons du cycle</span>
      <div class="stepper"><button class="btn ghost sq" data-act="nbMinus">−</button><output>${c.nb}</output><button class="btn ghost sq" data-act="nbPlus">+</button></div></div>
      <button class="btn ghost" data-act="go:ppil">${I.pillar}Gérer les piliers</button></div>
      <p class="muted small">Pour chaque leçon, choisissez le ou les piliers à observer : sur les tablettes, l’observateur choisit l’un d’eux et renseigne ses 3 critères à chaque longueur.</p></div>${rows}`;
  $$('#v-pprog [data-f]').forEach(inp=>inp.onchange=()=>{ const L=Classe.lesson(c, +inp.dataset.n); L[inp.dataset.f]=inp.value.trim(); Classe.save(); });
}
Object.assign(ACT, {
  nbMinus(){ const c=Classe.active(); Classe.setNb(c, c.nb-1); renderProg(); },
  nbPlus(){ const c=Classe.active(); Classe.setNb(c, c.nb+1); renderProg(); },
  setCur(b){ const c=Classe.active(); Classe.setCur(c, +b.dataset.n); App.ChronoUI.drop(); rerender(App.view()); toast(`Leçon du jour : leçon ${c.cur}`); },
  togPil(b){ const c=Classe.active(); const L=Classe.lesson(c, +b.dataset.n); const id=b.dataset.id;
    L.pil = L.pil.includes(id) ? L.pil.filter(x=>x!==id) : [...L.pil, id]; Classe.save(); b.classList.toggle('on', L.pil.includes(id)); },
});

/* =========================================================
   ENSEIGNANT · Leçon du jour
   ========================================================= */
enterHooks.plesson = renderLesson;
function renderLesson(){
  const c=needClass('plesson'); if(!c) return;
  const n=c.cur, L=Classe.lesson(c,n), S=Classe.students(c);
  const pils=L.pil.map(Classe.pilier).filter(Boolean);
  const abs=S.filter(s=>L.att[s.id]==='abs').length, inap=S.filter(s=>L.att[s.id]==='inap').length;
  V('plesson').innerHTML = `
    <div class="card"><span class="field-lbl">Leçon</span>${lessonPicker(c, n, 'setCur')}</div>
    <div class="card"><div class="row"><div class="grow"><div class="eyebrow">Programmation du cycle</div><h3>Leçon ${n}${L.date?` · ${new Date(L.date).toLocaleDateString('fr-FR')}`:''}</h3></div>
      <button class="btn ghost sm" data-act="go:pprog">Modifier</button></div>
      <div class="chips">${pils.length ? pils.map(p=>`<span class="pchip">${esc(p.n)}</span>`).join('') : '<span class="muted small">Aucun pilier programmé : choisissez-en un dans la programmation du cycle.</span>'}</div>
      ${L.obj?`<p class="obj">${esc(L.obj)}</p>`:''}</div>
    <div class="card"><div class="row"><h3 class="grow">Appel</h3><span class="muted small">${S.length-abs-inap} présent(s) · ${abs} absent(s) · ${inap} inapte(s)</span></div>
      ${S.length ? `<div class="att-grid">${S.map(s=>{ const a=L.att[s.id];
        return `<div class="att ${a?'is-'+a:''}"><b>${esc(s.disp)}</b><div class="att-btns">
          <button class="${a==='abs'?'on abs':''}" data-act="att" data-sid="${s.id}" data-v="abs">Absent</button>
          <button class="${a==='inap'?'on inap':''}" data-act="att" data-sid="${s.id}" data-v="inap">Inapte</button></div></div>`; }).join('')}</div>`
        : `<div class="empty">Aucun élève. <button class="btn blue sm" data-act="go:pclass">Importer l’appel</button></div>`}</div>
    <div class="card"><div class="row"><h3 class="grow">Parcours du jour</h3>
      <button class="btn ghost" data-act="addParcours">${I.plus}Parcours existant</button><button class="btn blue" data-act="createParcours">${I.plus}Créer un parcours</button></div>
      ${L.par.length ? `<div class="grid-cards">${L.par.map(p=>`<article class="pcard"><div class="pcard-head"><div><div class="pcard-name">${esc(p.name)}</div>
          <div class="muted small">${p.n} longueurs · ${esc(Store.summary(p))}</div></div></div><canvas class="schema" data-pid="${esc(p.id)}"></canvas>
          <div class="btnrow"><button class="btn teal" data-act="viewPar" data-pid="${esc(p.id)}">${I.play}Voir</button><button class="btn ghost danger" data-act="rmPar" data-pid="${esc(p.id)}">Retirer</button></div></article>`).join('')}</div>`
        : '<div class="empty">Aucun parcours pour cette leçon.</div>'}</div>
    <div class="card qr-card"><div class="row"><div class="grow"><h3>QR de la leçon</h3>
      <p class="muted small">À faire scanner par chaque tablette élève (« Scanner les infos du cours ») : classe et appel (Prénom N.), pilier(s) et leurs critères, parcours du jour.</p></div>
      <button class="btn orange lg" data-act="showSeanceQR">${I.qr}Afficher le QR</button><button class="btn ghost" data-act="fileSeance">${I.file}Partager en fichier</button></div></div>`;
  requestAnimationFrame(()=>$$('#v-plesson canvas[data-pid]').forEach(cv=>{ const p=L.par.find(x=>x.id===cv.dataset.pid); if(p) Schema.render(cv, p, {compact:true}); }));
}
async function showSeanceQR(c, n){
  const L=Classe.lesson(c,n);
  if(!c.students.length) return toast('Importez d’abord l’appel de la classe', true);
  if(!L.par.length && !await ask({title:'Aucun parcours', msg:'Cette leçon n’a pas de parcours du jour. Afficher le QR quand même ?', ok:'Afficher'})) return;
  const o=overlay(`QR de la leçon · ${esc(c.name)} · leçon ${n}`, `<p class="muted center">Sur chaque tablette élève : <b>Scanner les infos du cours</b>. Les QR défilent seuls ; tenez la tablette à 30–40 cm, luminosité au maximum.</p><div id="qrSeance" class="center"></div>`, 'wide');
  const pkt=Classe.buildSeance(c, n);
  await QR.showPacket(pkt, 'S', o.body.querySelector('#qrSeance'), '');
}
Object.assign(ACT, {
  att(b){ const c=Classe.active(); Classe.setAtt(c, c.cur, b.dataset.sid, b.dataset.v); App.ChronoUI.drop(); renderLesson(); },
  addParcours(){
    const c=Classe.active(), n=c.cur, Lb=Store.library();
    const all=[...Lb.user, ...Lb.builtins];
    const o=overlay('Ajouter un parcours', `<div class="pick-list">${all.map(p=>`<button class="pick-row" data-pid="${esc(p.id)}"><b>${esc(p.name)}</b><span class="muted small">${p.n} longueurs · ${esc(Store.summary(p))}${p.builtin?' · modèle':''}</span></button>`).join('')}</div>`);
    o.el.addEventListener('click', e=>{ const b=e.target.closest('[data-pid]'); if(!b) return;
      const p=all.find(x=>x.id===b.dataset.pid); Classe.addParcours(c, n, p); o.close(); toast(`« ${p.name} » ajouté`); renderLesson(); });
  },
  createParcours(){
    const c=Classe.active(), n=c.cur;
    App.Editor.open(Store.emptyParcours(4), {isNew:true, onSave:(saved)=>{ Classe.addParcours(c, n, saved); history.back(); }});
  },
  viewPar(b){ const c=Classe.active(); const p=Classe.lesson(c,c.cur).par.find(x=>x.id===b.dataset.pid); if(p){ App.setCurrent(p, true); go('view'); } },
  async rmPar(b){ const c=Classe.active(); if(await ask({title:'Retirer ce parcours de la leçon ?', msg:'Il reste dans la bibliothèque.', ok:'Retirer'})){ Classe.removeParcours(c, c.cur, b.dataset.pid); renderLesson(); } },
  async fileSeance(){ const c=Classe.active(); await QR.shareJSON(Classe.buildSeance(c, c.cur), `Sauvetage_${c.name}_lecon${c.cur}.json`.replace(/\s+/g,'_')); },
});

/* =========================================================
   ENSEIGNANT · Récupérer les résultats
   ========================================================= */
const recvLog=[];
enterHooks.precv = ()=>{
  const c=needClass('precv'); if(!c) return;
  V('precv').innerHTML = `<div class="card"><h3>${esc(c.name)} · leçon du jour : ${c.cur}</h3>
      <p class="muted small">Sur chaque tablette élève : <b>Exporter mes résultats</b>, puis scannez la série de QR ici. La caméra reste ouverte pour la tablette suivante. Un passage déjà reçu n’est jamais compté deux fois.</p></div>
    <div id="recvScan"></div>
    <div class="card"><div class="row"><h3 class="grow">Reçu sur cet écran</h3><label class="btn ghost">${I.file}Importer un fichier<input type="file" id="recvFile" accept=".json,application/json" hidden></label></div>
      <ul class="recv-log" id="recvLog"></ul></div>`;
  const log=()=>{ $('#recvLog').innerHTML = recvLog.length ? recvLog.map(x=>`<li>${x}</li>`).join('') : '<li class="muted">Rien pour l’instant.</li>'; };
  log();
  const onPacket = async (p)=>{
    const r=await Classe.applyPacket(p);
    if(r.kind!=='R') throw new Error('Ce QR est une leçon (pour les tablettes élèves)');
    const msg=`${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · tablette ${esc(p.d)} · ${r.total} passage(s), dont ${r.n} nouveau(x)`;
    recvLog.unshift(msg); log(); toast(`✓ ${r.n} nouveau(x) passage(s) reçu(s)`);
    return 'continue';
  };
  QR.startScan($('#recvScan'), ['R'], onPacket, 'Ce QR est une leçon : il se scanne sur les tablettes élèves.');
  $('#recvFile').onchange = async e=>{
    const files=[...e.target.files]; e.target.value='';
    for(const f of files){ try{ await onPacket(JSON.parse(await f.text())); }catch(err){ toast(`${f.name} : ${err.message}`, true); } }
  };
};
leaveHooks.precv = ()=>{ QR.stopScan(); return true; };

/* =========================================================
   ENSEIGNANT · Bilan de la leçon
   ========================================================= */
let bilanN=null;
enterHooks.pbilan = renderBilan;
function renderBilan(){
  const c=needClass('pbilan'); if(!c) return;
  const n = bilanN && bilanN<=c.nb ? bilanN : c.cur;
  const L=Classe.lesson(c,n), rows=Classe.lessonBilan(c,n), res=Classe.resultsOf(c,n);
  const pars=[]; L.par.forEach(p=>pars.push({id:p.id, name:p.name})); res.forEach(r=>{ if(!pars.some(x=>x.id===r.pid)) pars.push({id:r.pid, name:r.pname}); });
  const pils=L.pil.map(id=>Classe.pilier(id)).filter(Boolean);
  // synthèse classe par critère
  const classObs=pils.map(p=>({p, c:Classe.obsCount(res, p.id)}));
  V('pbilan').innerHTML = `<div class="card"><span class="field-lbl">Leçon</span>${lessonPicker(c, n, 'bilanN')}
      <div class="muted small">${res.length} passage(s) reçu(s) · ${rows.filter(r=>r.n).length} élève(s) chronométré(s)</div></div>
    ${classObs.map(({p,c:cc})=>`<div class="card"><div class="eyebrow">Classe · pilier</div><h3>${esc(p.n)}</h3>
      <div class="crit-bars">${p.cr.map((x,k)=>{ const v=pct(cc[k]); return `<div class="cbar"><div><b>${esc(x.t)}</b><span class="muted small">${esc(x.o)}</span></div>
        <div class="bar"><i class="${pctCls(v)}" style="width:${v??0}%"></i></div><span class="pv">${v==null?'—':v+' % oui'}<small>${cc[k].tot?` (${cc[k].yes}/${cc[k].tot})`:''}</small></span></div>`; }).join('')}</div></div>`).join('')}
    <div class="card"><h3>Par élève</h3><div class="table-wrap"><table class="bt">
      <thead><tr><th>Élève</th><th>Passages</th>${pars.map(p=>`<th>${esc(p.name)}<small>meilleur temps</small></th>`).join('')}
        ${pils.map(p=>p.cr.map(x=>`<th class="crit">${esc(x.t)}<small>${esc(p.n)}</small></th>`).join('')).join('')}</tr></thead>
      <tbody>${rows.map(r=>`<tr class="${r.att?'is-att':''}"><td><button class="linkbtn" data-act="openCycle" data-sid="${r.s.id}">${esc(r.s.disp)}</button> ${attTag(r.att)}</td>
        <td class="c">${r.n||'—'}</td>
        ${pars.map(p=>{ const b=r.best[p.id]; return `<td class="c">${b?`<b>${fmt(b.total)}</b>${b.faults?`<small>${b.faults} faute(s)</small>`:''}`:'—'}</td>`; }).join('')}
        ${r.obs.map(o=>{ const P=Classe.pilier(o.pid); return P ? o.c.map(x=>{ const v=pct(x); return `<td class="c"><span class="pc ${pctCls(v)}">${v==null?'—':v+' %'}</span></td>`; }).join('') : ''; }).join('')}
      </tr>`).join('')}</tbody></table></div></div>
    <div class="btnrow"><button class="btn green" data-act="xlsx">${I.file}Export Excel (cycle complet)</button></div>`;
}
Object.assign(ACT, {
  bilanN(b){ bilanN=+b.dataset.n; renderBilan(); },
  openCycle(b){ cycleSid=b.dataset.sid; go('pcycle'); },
  xlsx(){ const c=Classe.active(); try{ Classe.exportXlsx(c, Chrono.fmt, (ms)=>ms==null?'':Math.round(ms/100)/10); }catch(e){ toast(e.message, true); } },
});

/* =========================================================
   ENSEIGNANT · Bilan du cycle (trace individuelle)
   ========================================================= */
let cycleSid=null;
enterHooks.pcycle = renderCycle;
function renderCycle(){
  const c=needClass('pcycle'); if(!c) return;
  const S=Classe.students(c);
  if(!S.length){ V('pcycle').innerHTML='<div class="empty">Aucun élève dans la classe.</div>'; return; }
  if(!S.some(s=>s.id===cycleSid)) cycleSid=S[0].id;
  const s=S.find(x=>x.id===cycleSid);
  const cyc=Classe.studentCycle(c, s.id);
  const allRes=cyc.flatMap(x=>x.res);
  const pres=cyc.filter(x=>!x.att && (x.res.length || x.L.par.length)).length, abs=cyc.filter(x=>x.att==='abs').length, inap=cyc.filter(x=>x.att==='inap').length;
  // évolution des critères par pilier
  const pilIds=[...new Set(cyc.flatMap(x=>x.obs.map(o=>o.pid)))];
  const evo=pilIds.map(pid=>{ const P=Classe.pilier(pid); if(!P) return '';
    const ls=cyc.filter(x=>x.obs.some(o=>o.pid===pid));
    return `<div class="evo"><h4>${esc(P.n)}</h4><div class="table-wrap"><table class="bt"><thead><tr><th>Critère</th>${ls.map(x=>`<th>L${x.n}</th>`).join('')}</tr></thead><tbody>
      ${P.cr.map((cr,k)=>`<tr><td><b>${esc(cr.t)}</b><small class="muted"> ${esc(cr.o)}</small></td>${ls.map(x=>{ if(x.att) return `<td class="c">${attTag(x.att)}</td>`;
        const o=x.obs.find(q=>q.pid===pid).c[k], v=pct(o); return `<td class="c"><span class="pc ${pctCls(v)}">${v==null?'—':`${o.yes}/${o.tot}`}</span></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div></div>`; }).join('');
  V('pcycle').innerHTML = `<div class="cycle">
    <aside class="card cycle-list">${S.map(x=>`<button class="${x.id===s.id?'on':''}" data-act="cycleSid" data-sid="${x.id}">${esc(x.disp)}</button>`).join('')}</aside>
    <div class="cycle-main">
      <div class="card fiche"><div class="row"><div class="grow"><div class="eyebrow">${esc(c.name)} · bilan du cycle</div><h2>${esc(s.prenom)} ${esc(s.nom)}</h2>
        <div class="muted small">${pres} leçon(s) de pratique · ${abs} absence(s) · ${inap} inaptitude(s) · ${allRes.length} passage(s) chronométré(s)</div></div>
        <button class="btn ghost no-print" data-act="print">Imprimer la fiche</button><button class="btn green no-print" data-act="xlsx">${I.file}Excel (classe)</button></div></div>
      ${evo ? `<div class="card"><h3>Critères observés (oui / observations)</h3>${evo}</div>` : ''}
      <div class="card"><h3>Leçon par leçon</h3><div class="table-wrap"><table class="bt"><thead><tr><th>Leçon</th><th>Présence</th><th>Pilier(s)</th><th>Passages</th></tr></thead><tbody>
        ${cyc.map(x=>`<tr><td><b>L${x.n}</b>${x.L.date?`<small>${new Date(x.L.date).toLocaleDateString('fr-FR')}</small>`:''}</td>
          <td>${x.att?attTag(x.att):(x.res.length?'<span class="tag ok">Présent</span>':'<span class="muted">—</span>')}</td>
          <td>${x.L.pil.map(id=>esc(Classe.pilier(id)?.n||'')).join('<br>')||'<span class="muted">—</span>'}</td>
          <td>${x.res.length ? x.res.map(r=>`<div class="pass"><b>${fmt(r.total)}</b> · ${esc(r.pname)}${r.faults?` · ${r.faults} faute(s)`:''}<small>${r.lens.map((l,i)=>`${Store.lenLabel(i)} ${l!=null?fmt(l):'—'}`).join(' · ')}</small></div>`).join('') : '<span class="muted">—</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>
    </div></div>`;
}
Object.assign(ACT, {
  cycleSid(b){ cycleSid=b.dataset.sid; renderCycle(); window.scrollTo(0,0); },
  print(){ window.print(); },
});

/* =========================================================
   ENSEIGNANT · Piliers
   ========================================================= */
enterHooks.ppil = renderPiliers;
function renderPiliers(){
  const P=Classe.piliers();
  V('ppil').innerHTML = `<div class="card"><div class="row"><p class="muted small grow">Un pilier = ce que vous voulez vraiment observer. Il contient des <b>contenus</b> (lus par les élèves) et <b>3 critères</b>, chacun avec son <b>observable</b> que l’observateur coche oui / non à chaque longueur.</p>
      <button class="btn blue" data-act="pilNew">${I.plus}Nouveau pilier</button></div></div>
    <div class="grid-cards pil-cards">${P.map(p=>`<article class="card pil">
      <h3>${esc(p.n)}</h3>${p.c?`<ul class="contenus">${p.c.split('\n').filter(Boolean).map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}
      <ol class="crits">${p.cr.map(x=>`<li><b>${esc(x.t)}</b><span>${esc(x.o)}</span></li>`).join('')}</ol>
      <div class="btnrow"><button class="btn ghost" data-act="pilEdit" data-id="${p.id}">Modifier</button><button class="btn ghost danger" data-act="pilDel" data-id="${p.id}">Supprimer</button></div></article>`).join('')}</div>
    <div class="btnrow center"><button class="btn ghost sm" data-act="pilReset">Rétablir la banque par défaut</button></div>`;
}
function editPilier(p){
  const q = p ? JSON.parse(JSON.stringify(p)) : { n:'', c:'', cr:[{t:'',o:''},{t:'',o:''},{t:'',o:''}] };
  const o=overlay(p?'Modifier le pilier':'Nouveau pilier', `<form class="pil-form">
    <label class="field"><span class="field-lbl">Nom du pilier</span><input type="text" name="n" value="${esc(q.n)}" maxlength="80" required></label>
    <label class="field"><span class="field-lbl">Contenus (une idée par ligne, lus par les élèves)</span><textarea name="c" rows="4">${esc(q.c)}</textarea></label>
    ${[0,1,2].map(k=>`<fieldset><legend>Critère ${k+1}</legend>
      <input type="text" name="t${k}" value="${esc(q.cr[k]?.t||'')}" placeholder="Critère (ex. Alignement)" maxlength="60">
      <input type="text" name="o${k}" value="${esc(q.cr[k]?.o||'')}" placeholder="Observable : ce que l’on voit (oui / non)" maxlength="120"></fieldset>`).join('')}
    <div class="btnrow end"><button type="submit" class="btn green">Enregistrer</button></div></form>`, 'wide');
  o.el.querySelector('form').onsubmit = (e)=>{
    e.preventDefault(); const f=new FormData(e.target);
    Classe.savePilier({ id:q.id, n:f.get('n'), c:f.get('c'), cr:[0,1,2].map(k=>({t:f.get('t'+k), o:f.get('o'+k)})) });
    o.close(); toast('Pilier enregistré'); renderPiliers();
  };
}
Object.assign(ACT, {
  pilNew(){ editPilier(null); },
  pilEdit(b){ editPilier(Classe.pilier(b.dataset.id)); },
  async pilDel(b){ const p=Classe.pilier(b.dataset.id); if(await ask({title:'Supprimer ce pilier ?', msg:`« ${p.n} » sera retiré de la banque (les leçons qui l’utilisent le perdront).`, ok:'Supprimer', danger:true})){ Classe.deletePilier(p.id); renderPiliers(); } },
  async pilReset(){ if(await ask({title:'Rétablir la banque par défaut ?', msg:'Vos piliers modifiés ou ajoutés seront remplacés.', ok:'Rétablir', danger:true})){ Classe.resetPiliers(); renderPiliers(); } },
});

/* =========================================================
   ENSEIGNANT · Réglages
   ========================================================= */
enterHooks.pset = ()=>{
  const url=location.href.split('#')[0];
  V('pset').innerHTML = `
    <div class="card"><h3>Code enseignant</h3><p class="muted small">Protège l’accès au mode enseignant (4 chiffres).</p>
      <div class="row"><input type="text" id="newPin" inputmode="numeric" maxlength="4" placeholder="Nouveau code"><button class="btn blue" data-act="setPin">Enregistrer</button></div></div>
    <div class="card"><h3>Installer l’appli sur les tablettes</h3><div class="row"><img class="app-qr" src="${QR.urlImg(url,5)}" alt="QR d’accès"><div class="grow">
      <p class="muted small">Faites scanner ce QR par l’appareil photo de la tablette, puis « Sur l’écran d’accueil » (iPad) ou « Installer l’application » (Android). L’appli fonctionne ensuite hors-ligne.</p><code>${esc(url)}</code></div></div></div>
    <div class="card"><h3>Sauvegarde</h3><p class="muted small">Classes, programmation, piliers et résultats de cet appareil.</p>
      <div class="btnrow"><button class="btn ghost" data-act="backup">${I.file}Exporter la sauvegarde</button><label class="btn ghost">Restaurer…<input type="file" id="restoreFile" accept=".json" hidden></label></div></div>
    <div class="card"><h3>Autres</h3><div class="btnrow"><button class="btn ghost" data-act="go:results">Passages libres (hors classe)</button>
      <button class="btn ghost danger" data-act="toEleve">Passer cet appareil en mode élève</button></div></div>`;
  $('#restoreFile').onchange = async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
    try{ const obj=JSON.parse(await f.text()); if(!await ask({title:'Restaurer la sauvegarde ?', msg:'Toutes les données de cet appareil seront remplacées.', ok:'Restaurer', danger:true})) return;
      Classe.restore(obj); toast('Sauvegarde restaurée'); go('home'); }catch(err){ toast(err.message, true); } };
};
Object.assign(ACT, {
  setPin(){ const v=$('#newPin').value.trim(); if(Classe.setPin(v)){ toast('Code enregistré'); $('#newPin').value=''; } else toast('Le code doit comporter 4 chiffres', true); },
  backup(){ QR.shareJSON(Classe.backup(), `Sauvetage_sauvegarde_${new Date().toISOString().slice(0,10)}.json`); },
  async toEleve(){ if(await ask({title:'Passer en mode élève ?', msg:'Les données enseignant restent sur l’appareil ; le code sera demandé pour revenir.', ok:'Mode élève'})){ Classe.setRole('eleve'); go('home'); } },
});

/* =========================================================
   ÉLÈVE · Scanner le cours
   ========================================================= */
enterHooks.escan = ()=>{
  V('escan').innerHTML = `<div class="card center"><h3>Scanne le QR de la leçon affiché par ton enseignant</h3>
      <p class="muted small">Laisse défiler les QR devant la caméra : chaque numéro devient vert quand il est lu.</p></div>
    <div id="scanS"></div>
    <div class="btnrow center"><label class="btn ghost">${I.file}Importer un fichier de leçon<input type="file" id="seanceFile" accept=".json,application/json" hidden></label></div>`;
  const done = async (p)=>{
    const r=await Classe.applyPacket(p);
    if(r.kind!=='S') throw new Error('Ce QR contient des résultats : il se scanne sur l’appareil enseignant');
    App.ChronoUI.drop(); Store.saveChronoSession(null);
    if(r.seance.pars[0]) App.setCurrent(r.seance.pars[0], true);
    toast(`✓ ${r.seance.cn} · leçon ${r.seance.n} reçue`);
    setTimeout(()=>go('home', true), 300);
    return 'stop';
  };
  QR.startScan($('#scanS'), ['S'], done, 'Ce QR contient des résultats : il se scanne sur l’appareil enseignant.');
  $('#seanceFile').onchange = async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
    try{ await done(JSON.parse(await f.text())); }catch(err){ toast(err.message, true); } };
};
leaveHooks.escan = ()=>{ QR.stopScan(); return true; };

/* ---------- ÉLÈVE · Contenus du pilier ---------- */
enterHooks.epil = ()=>{
  const s=Classe.seance(); if(!s) return go('home', true);
  V('epil').innerHTML = s.pils.length ? s.pils.map(p=>`<article class="card pil big">
      <div class="eyebrow">${esc(s.cn)} · leçon ${s.n}</div><h2>${esc(p.n)}</h2>
      ${p.c?`<h4>Ce que je dois faire</h4><ul class="contenus">${p.c.split('\n').filter(Boolean).map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}
      <h4>Ce que l’observateur regarde (oui / non, à chaque longueur)</h4>
      <ol class="crits">${p.cr.map(x=>`<li><b>${esc(x.t)}</b><span>${esc(x.o)}</span></li>`).join('')}</ol></article>`).join('')
    : '<div class="empty">Pas de pilier pour cette leçon.</div>';
  if(s.obj) V('epil').insertAdjacentHTML('afterbegin', `<div class="card"><div class="eyebrow">Consignes de la leçon</div><p class="obj">${esc(s.obj)}</p></div>`);
};

/* ---------- ÉLÈVE · Parcours du jour ---------- */
enterHooks.epar = ()=>{
  const s=Classe.seance(); if(!s) return go('home', true);
  V('epar').innerHTML = s.pars.length ? `<div class="grid-cards">${s.pars.map(p=>`<article class="pcard"><div class="pcard-head"><div><div class="pcard-name">${esc(p.name)}</div>
      <div class="muted small">${p.n} longueurs (${p.n*25} m) · ${esc(Store.summary(p))}</div></div></div>
      <canvas class="schema" data-pid="${esc(p.id)}"></canvas>
      <div class="btnrow"><button class="btn teal" data-act="eView" data-pid="${esc(p.id)}">${I.play}Voir l’animation</button><button class="btn red" data-act="eChrono" data-pid="${esc(p.id)}">${I.chrono}Chronométrer</button></div></article>`).join('')}</div>`
    : '<div class="empty">Pas de parcours pour cette leçon.</div>';
  requestAnimationFrame(()=>$$('#v-epar canvas[data-pid]').forEach(cv=>{ const p=s.pars.find(x=>x.id===cv.dataset.pid); if(p) Schema.render(cv, p, {theme:'dark'}); }));
};
Object.assign(ACT, {
  eView(b){ const p=Classe.seance().pars.find(x=>x.id===b.dataset.pid); App.setCurrent(p, true); go('view'); },
  eChrono(b){ const p=Classe.seance().pars.find(x=>x.id===b.dataset.pid); const ses=Store.chronoSession();
    if(ses && ses.taps && ses.taps.length && !ses.saved) return toast('Un passage est en cours dans le chrono', true);
    App.setCurrent(p, true); App.ChronoUI.drop(); Store.saveChronoSession(null); go('chrono'); },
});

/* ---------- ÉLÈVE · Exporter mes résultats ---------- */
let sendN=null;
enterHooks.esend = renderSend;
function renderSend(){
  const s=Classe.seance(); if(!s) return go('home', true);
  const lessons=[...new Set(Classe.mine().filter(r=>r.cid===s.cid).map(r=>r.n))].sort((a,b)=>a-b);
  const n = sendN!=null && lessons.includes(sendN) ? sendN : s.n;
  const list=Classe.mineFor(s.cid, n);
  const names={}; s.st.forEach(x=>{ names[x.id]=x.disp; });
  V('esend').innerHTML = `<div class="card"><div class="row"><div class="grow"><div class="eyebrow">${esc(s.cn)}</div><h3>Leçon ${n} · ${list.length} passage(s) sur cette tablette</h3></div>
      ${lessons.length>1?`<select id="sendN">${lessons.map(x=>`<option value="${x}" ${x===n?'selected':''}>Leçon ${x}</option>`).join('')}</select>`:''}</div>
      <p class="muted small">Montre ces QR à l’appareil de ton enseignant (« Récupérer les résultats »). Tu peux les montrer plusieurs fois : rien n’est compté en double.</p></div>
    ${list.length ? `<div id="qrR" class="center"></div>
      <div class="btnrow center"><button class="btn ghost" data-act="fileMine">${I.file}Partager en fichier à la place</button></div>
      <div class="card"><h3>Passages enregistrés</h3><ul class="mine">${list.map(r=>`<li><b>${esc(names[r.sid]||'?')}</b><span>${esc(r.pname)} · ${fmt(r.total)}${r.faults?` · ${r.faults} faute(s)`:''}</span>
        <button class="iconbtn sm" data-act="delMine" data-id="${esc(r.id)}" title="Supprimer">${I.x}</button></li>`).join('')}</ul></div>`
      : '<div class="empty">Aucun passage enregistré pour cette leçon.<br><br><button class="btn red" data-act="go:chrono">Chronométrer</button></div>'}`;
  if($('#sendN')) $('#sendN').onchange = e=>{ sendN=+e.target.value; renderSend(); };
  if(list.length) QR.showPacket(Classe.buildResults(list), 'R', $('#qrR'), '').then(()=>Classe.markSent(s.cid, n));
}
Object.assign(ACT, {
  fileMine(){ const s=Classe.seance(); const n=sendN||s.n; QR.shareJSON(Classe.buildResults(Classe.mineFor(s.cid, n)), `Sauvetage_${s.cn}_L${n}_tablette_${Classe.deviceId()}.json`.replace(/\s+/g,'_')); },
  async delMine(b){ if(await ask({title:'Supprimer ce passage ?', msg:'Il ne sera plus envoyé à l’enseignant.', ok:'Supprimer', danger:true})){ Classe.deleteResult(null, b.dataset.id); renderSend(); } },
});

window.addEventListener('popstate', ()=>{ $$('.overlay').forEach(o=>o.remove()); });

/* ---------- Démarrage ---------- */
App.start();
})();
