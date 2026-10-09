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
  pbilan:'Bilan de la leçon', pcycle:'Bilan du cycle', pfil:'Fil rouge', ppil:'Piliers d’enseignement', pset:'Réglages',
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
const PCOL = ['#0088E8','#E8403B','#3A9A1E','#7B4BD8','#F59A1B','#0E9AA7','#C2185B','#5B6478'];

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
/* Pavé numérique du code enseignant (comme dans l'appli Biathlon) */
function askPin(title='🔒 Code enseignant'){
  return new Promise(res=>{
    let code='';
    const o=overlay(title, `<div class="pin-dots">${'<span></span>'.repeat(4)}</div>
      <div class="pin-pad">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k=>`<button type="button" data-k="${k}" class="${k==='⌫'||k==='✓'?'fn':''}">${k}</button>`).join('')}</div>
      <p class="muted small center">Code par défaut : 0000 (modifiable dans Réglages)</p>`, 'sm pin');
    const dots=o.el.querySelectorAll('.pin-dots span');
    let done=false;
    const finish=(v)=>{ if(done) return; done=true; o.close(); res(v); };
    o.el.querySelector('[data-x]').addEventListener('click', ()=>finish(false));
    o.el.addEventListener('click', e=>{ if(e.target===o.el) finish(false); });
    const press=(k)=>{
      if(k==='⌫') code=code.slice(0,-1); else if(k!=='✓' && code.length<4) code+=k;
      dots.forEach((d,i)=>d.classList.toggle('f', i<code.length));
      if(code.length===4){
        if(Classe.checkPin(code)) finish(true);
        else { toast('Code incorrect', true); o.el.querySelector('.pin-dots').classList.add('shake'); setTimeout(()=>{ code=''; dots.forEach(d=>d.classList.remove('f')); o.el.querySelector('.pin-dots')?.classList.remove('shake'); }, 400); }
      }
    };
    o.el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>press(b.dataset.k));
    const kb=(e)=>{ if(done) return document.removeEventListener('keydown', kb); if(/^\d$/.test(e.key)) press(e.key); else if(e.key==='Backspace') press('⌫'); };
    document.addEventListener('keydown', kb);
  });
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
  return `<div class="home-hero"><img class="home-logo" src="assets/logo.jpg" alt="N'EPS Sauvetage" width="480" height="480">
    <div><h2 class="home-title">Sauvetage aquatique CA2</h2><div class="home-sub">${sub}</div></div></div>`;
}
/* grosse tuile colorée, façon Biathlon */
function hb(act, emo, title, sub, color, cls=''){ return `<button class="home-btn ${cls}" style="--hb:${color}" data-act="${act}"><span class="ico">${emo}</span><b>${title}</b>${sub?`<small>${sub}</small>`:''}</button>`; }
const C_ = { navy:'#0062C4', blue:'#0088E8', orange:'#F59A1B', green:'#3A9A1E', red:'#E8403B', teal:'#0E9AA7', violet:'#7B4BD8', ink:'#002E6E' };
function renderHome(){
  const r=Classe.role();
  App.$('#appTitle').textContent = 'Sauvetage CA2';
  if(!r){
    homeHost.innerHTML = `<div class="home">${hero('Parcours · chronométrie · observation')}
      <h3 class="section-title center">Qui utilise cet appareil ?</h3>
      <div class="home-grid two">
        ${hb('roleProf','👩‍🏫','Enseignant','Classe, cycle, leçon du jour, QR des tablettes, bilans', C_.navy)}
        ${hb('roleEleve','🏊','Élève','Scanner le cours, piliers, parcours, chrono, résultats', C_.blue)}
      </div>
      <p class="muted small center">Le choix est mémorisé sur cet appareil ; il se change ensuite dans les réglages.</p></div>`;
    return;
  }
  if(r==='prof') return renderProfHome();
  return renderEleveHome();
}
function lessonLine(c, n){
  const L=Classe.lesson(c,n);
  return L.kind==='test' ? `⏱️ Test de vitesse · ${L.tdist} m` : `🏊 ${L.par.length} parcours`;
}
function renderProfHome(){
  const cs=Classe.classes(), c=Classe.active();
  let today='';
  if(c){
    const L=Classe.lesson(c, c.cur);
    const abs=Object.values(L.att).filter(v=>v==='abs').length, inap=Object.values(L.att).filter(v=>v==='inap').length;
    const pils=L.pil.map(Classe.pilier).filter(Boolean);
    today = `<div class="home-lesson">
      <div class="hl-top"><div><div class="eyebrow">Leçon du jour · ${esc(c.name)}</div><div class="big">Leçon ${c.cur} <span>/ ${c.nb}</span></div></div>
        <button class="btn orange" data-act="showSeanceQR">📲 QR de la leçon</button></div>
      <div class="chips">${L.kind==='test'?`<span class="pchip test">⏱️ Test de vitesse ${L.tdist} m (S1)</span>`:''}${pils.length ? pils.map(p=>`<span class="pchip">${esc(p.n)}</span>`).join('') : '<span class="muted small">Aucun pilier programmé</span>'}</div>
      <div class="muted small">👥 ${c.students.length} élève(s) · ${lessonLine(c, c.cur)} · ${abs} absent(s) · ${inap} inapte(s) · 📥 ${Classe.resultsOf(c, c.cur).length} passage(s) reçu(s)</div>
    </div>`;
  }
  homeHost.innerHTML = `<div class="home">${hero('Mode enseignant')}
    ${cs.length ? `<div class="class-chips">${cs.map(x=>`<button class="class-chip ${c&&x.id===c.id?'on':''}" data-act="selClass" data-id="${x.id}">🏫 ${esc(x.name)}</button>`).join('')}<button class="class-chip add" data-act="newClass">＋ Classe</button></div>` : ''}
    ${c ? today : `<div class="home-lesson"><div class="big">Bienvenue !</div><p>Commencez par créer une classe, puis importez l’appel Pronote.</p><button class="btn primary lg" data-act="newClass">＋ Créer une classe</button></div>`}
    <h3 class="section-title">Préparer</h3>
    <div class="home-grid four">
      ${hb('go:pclass','👥','Élèves', c ? `${c.students.length} élève(s) · appel Pronote` : 'Appel Pronote', C_.blue)}
      ${hb('go:pprog','📅','Programmation du cycle', c ? `${c.nb} leçons · tests S1 · piliers` : 'Leçons et piliers', C_.navy)}
      ${hb('go:ppil','🏛️','Piliers', `${Classe.piliers().length} piliers · critères observables`, C_.violet)}
      ${hb('go:library','🗺️','Parcours', 'Créer, modifier, visualiser', C_.teal)}
    </div>
    <h3 class="section-title">En cours</h3>
    <div class="home-grid">
      ${hb('go:plesson','✅','Leçon du jour', 'Appel · parcours · QR', C_.orange)}
      ${hb('go:precv','📥','Récupérer les résultats', 'Scanner les tablettes', C_.green)}
      ${hb('go:chrono','⏱️','Chronométrer', 'Sur cet appareil', C_.red)}
    </div>
    <h3 class="section-title">Bilans</h3>
    <div class="home-grid">
      ${hb('go:pbilan','🔎','Bilan de la leçon', 'Temps · critères · observateurs', C_.teal)}
      ${hb('go:pfil', yarnIcon(46), 'Fil rouge', 'Nageur et observateur', C_.red)}
      ${hb('go:pcycle','📊','Bilan du cycle', 'Trace individuelle · Excel', C_.ink)}
    </div>
    <div class="btnrow center home-foot"><button class="btn ghost" data-act="go:pset">⚙️ Réglages</button></div></div>`;
}
function renderEleveHome(){
  const s=Classe.seance();
  if(!s){
    homeHost.innerHTML = `<div class="home">${hero('Mode élève')}
      <div class="home-lesson"><div class="big">Récupère le cours</div>
        <p>Ton enseignant affiche le QR de la leçon : scanne-le pour récupérer la classe, le pilier et les parcours du jour.</p></div>
      <div class="home-grid one">${hb('go:escan','📷','Scanner les infos du cours','', C_.orange, 'xl')}</div>
      <div class="btnrow center home-foot"><button class="btn ghost small" data-act="toProf">🔒 Mode enseignant</button></div></div>`;
    return;
  }
  const nMine=Classe.mineFor(s.cid, s.n).length;
  const test = s.kind==='test';
  homeHost.innerHTML = `<div class="home">${hero('Mode élève')}
    <div class="home-lesson">
      <div class="hl-top"><div><div class="eyebrow">${esc(s.cn)}</div><div class="big">Leçon ${s.n}${s.nb?` <span>/ ${s.nb}</span>`:''}</div></div>
        <button class="btn ghost small" data-act="go:escan">📷 Rescanner</button></div>
      <div class="chips">${test?`<span class="pchip test">⏱️ Test de vitesse ${s.tdist} m</span>`:''}${s.pils.map(p=>`<span class="pchip">${esc(p.n)}</span>`).join('')}</div>
      ${s.obj?`<p class="obj">${esc(s.obj)}</p>`:''}
      <div class="muted small">👥 ${s.st.length} élèves · ${test ? `test sur ${s.tdist} m : on mesure ta vitesse de nage de sauveteur` : `🏊 ${s.pars.length} parcours`} · ${nMine} passage(s) sur cette tablette</div>
    </div>
    <div class="home-grid">
      ${hb('go:chrono','⏱️','Chronométrer', test ? 'Test de vitesse + observation' : 'Temps + observation du pilier', C_.red, 'xl')}
      ${s.pils.length ? hb('go:epil','🏛️', s.pils.length>1?'Les piliers':'Le pilier', s.pils.map(p=>esc(p.n)).join(' · '), C_.violet) : ''}
      ${test ? '' : hb('go:epar','🗺️','Parcours du jour', `${s.pars.length} parcours · animation`, C_.blue)}
      ${hb('go:esend','📤','Exporter mes résultats', `${nMine} passage(s) · QR pour l’enseignant`, C_.green)}
      ${hb('go:escan','📷','Scanner les infos du cours', 'Nouvelle leçon', C_.orange)}
    </div>
    <div class="btnrow center home-foot"><button class="btn ghost small" data-act="toProf">🔒 Mode enseignant</button></div></div>`;
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
  selClass(b){ Classe.setActive(b.dataset.id); App.ChronoUI.drop(); renderHome(); },
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
    const test=L.kind==='test';
    rows += `<div class="card lesson-row ${n===c.cur?'is-cur':''} ${test?'is-test':''}">
      <div class="lr-head"><span class="ltag">Leçon ${n}</span><input type="date" value="${esc(L.date||'')}" data-n="${n}" data-f="date">
        <div class="seg kind"><button type="button" class="${test?'':'on'}" data-act="setKind" data-n="${n}" data-k="parcours">🏊 Parcours</button><button type="button" class="${test?'on':''}" data-act="setKind" data-n="${n}" data-k="test">⏱️ Test S1</button></div>
        ${n===c.cur?'<span class="badge cur">Leçon du jour</span>':`<button class="btn ghost sm" data-act="setCur" data-n="${n}">Leçon du jour</button>`}</div>
      ${test ? `<div class="test-cfg"><span>Test de vitesse de nage de sauveteur sur</span>
          <select data-n="${n}" data-f="tdist">${Classe.TEST_DISTS.map(d=>`<option value="${d}" ${L.tdist===d?'selected':''}>${d} m</option>`).join('')}</select>
          <span>départ</span><select data-n="${n}" data-f="tent">${Store.ENTREE_ORDER.map(e=>`<option value="${e}" ${L.tent===e?'selected':''}>${Store.ENTREES[e].label}</option>`).join('')}</select>
          <span class="muted small">La vitesse mesurée sert de référence pour les parcours des leçons suivantes.</span></div>` : ''}
      <div class="pil-chips">${P.map(p=>`<button type="button" class="ptoggle ${L.pil.includes(p.id)?'on':''}" data-act="togPil" data-n="${n}" data-id="${p.id}">${esc(p.n)}</button>`).join('')}</div>
      <input type="text" value="${esc(L.obj||'')}" data-n="${n}" data-f="obj" placeholder="Objectif ou consignes de la leçon (facultatif, transmis aux tablettes)" maxlength="200">
    </div>`;
  }
  V('pprog').innerHTML = `<div class="card"><div class="row"><div class="grow"><span class="field-lbl">Nombre de leçons du cycle</span>
      <div class="stepper"><button class="btn ghost sq" data-act="nbMinus">−</button><output>${c.nb}</output><button class="btn ghost sq" data-act="nbPlus">+</button></div></div>
      <button class="btn ghost" data-act="go:ppil">${I.pillar}Gérer les piliers</button></div>
      <p class="muted small">Chaque séquence commence par un <b>test S1</b> : on mesure la vitesse de nage de sauveteur de chaque élève, reprise ensuite sur les parcours (fil rouge du nageur : vitesse stable, aucun obstacle raté).<br>
      Pour chaque leçon, choisissez le ou les piliers à observer : l’observateur en choisit un et renseigne ses 3 critères une fois par aller-retour.</p></div>${rows}`;
  $$('#v-pprog [data-f]').forEach(inp=>inp.onchange=()=>{ const L=Classe.lesson(c, +inp.dataset.n); const f=inp.dataset.f; L[f] = f==='tdist' ? +inp.value : inp.value.trim(); Classe.save(); });
}
Object.assign(ACT, {
  nbMinus(){ const c=Classe.active(); Classe.setNb(c, c.nb-1); renderProg(); },
  nbPlus(){ const c=Classe.active(); Classe.setNb(c, c.nb+1); renderProg(); },
  setKind(b){ const c=Classe.active(); const L=Classe.lesson(c, +b.dataset.n); L.kind=b.dataset.k; Classe.save(); App.ChronoUI.drop(); renderProg(); },
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
    ${L.kind==='test' ? `<div class="card test-card"><h3>⏱️ Test de vitesse de nage de sauveteur (S1)</h3>
      <p>Chaque élève nage <b>${L.tdist} m</b> sans obstacle (départ : ${esc(Store.ENTREES[L.tent].label.toLowerCase())}). Sa vitesse devient sa <b>vitesse de nage de sauveteur</b>, reprise sur les parcours des leçons suivantes.</p>
      <button class="btn ghost sm" data-act="go:pprog">Modifier dans la programmation</button></div>` : `<div class="card"><div class="row"><h3 class="grow">Parcours du jour</h3>
      <button class="btn ghost" data-act="addParcours">${I.plus}Parcours existant</button><button class="btn blue" data-act="createParcours">${I.plus}Créer un parcours</button></div>
      <p class="muted small">Ajoutez autant de parcours que nécessaire : chaque élève peut avoir le sien (ci-dessous), ou le choisir lui-même.</p>
      ${L.par.length ? `<div class="grid-cards">${L.par.map((p,i)=>`<article class="pcard" style="--pc:${PCOL[i%PCOL.length]}"><div class="pcard-head"><div><div class="pcard-name"><span class="pnum">P${i+1}</span> ${esc(p.name)}</div>
          <div class="muted small">${p.n} longueurs · ${esc(Store.summary(p))}</div>
          <div class="small"><b>${S.filter(x=>L.asg[x.id]===p.id).length}</b> élève(s) attribué(s)</div></div></div><canvas class="schema" data-pid="${esc(p.id)}"></canvas>
          <div class="btnrow"><button class="btn teal" data-act="viewPar" data-pid="${esc(p.id)}">${I.play}Voir</button><button class="btn ghost danger" data-act="rmPar" data-pid="${esc(p.id)}">Retirer</button></div></article>`).join('')}</div>`
        : '<div class="empty">Aucun parcours pour cette leçon.</div>'}</div>
    ${L.par.length>1 && S.length ? `<div class="card asg-card"><div class="row"><div class="grow"><h3>🧭 Qui fait quel parcours ?</h3>
        <p class="muted small">Touchez un numéro pour attribuer un parcours à l’élève. « Au choix » : l’élève choisit sur la tablette. Au chrono, le parcours de l’élève se sélectionne tout seul.</p></div></div>
      <div class="asg-all"><span class="field-lbl">Tout le monde :</span><button type="button" class="asg-b" data-act="asgAll" data-pid="">Au choix</button>${L.par.map((p,i)=>`<button type="button" class="asg-b" style="--pc:${PCOL[i%PCOL.length]}" data-act="asgAll" data-pid="${esc(p.id)}">P${i+1}</button>`).join('')}</div>
      <div class="asg-grid">${S.map(st=>{ const a=L.asg[st.id]||'';
        return `<div class="asg ${L.att[st.id]?'is-'+L.att[st.id]:''}"><b>${esc(st.disp)}</b><div class="asg-btns">
          <button type="button" class="asg-b ${!a?'on':''}" data-act="asg" data-sid="${st.id}" data-pid="">Au choix</button>
          ${L.par.map((p,i)=>`<button type="button" class="asg-b ${a===p.id?'on':''}" style="--pc:${PCOL[i%PCOL.length]}" data-act="asg" data-sid="${st.id}" data-pid="${esc(p.id)}" title="${esc(p.name)}">P${i+1}</button>`).join('')}</div></div>`; }).join('')}</div></div>` : ''}`}
    <div class="card qr-card"><div class="row"><div class="grow"><h3>QR de la leçon</h3>
      <p class="muted small">À faire scanner par chaque tablette élève (« Scanner les infos du cours ») : classe et appel (Prénom N.), pilier(s) et leurs critères, parcours du jour.</p></div>
      <button class="btn orange lg" data-act="showSeanceQR">${I.qr}Afficher le QR</button><button class="btn ghost" data-act="fileSeance">${I.file}Partager en fichier</button></div></div>`;
  requestAnimationFrame(()=>$$('#v-plesson canvas[data-pid]').forEach(cv=>{ const p=L.par.find(x=>x.id===cv.dataset.pid); if(p) Schema.render(cv, p, {compact:true}); }));
}
async function showSeanceQR(c, n){
  const L=Classe.lesson(c,n);
  if(!c.students.length) return toast('Importez d’abord l’appel de la classe', true);
  if(L.kind!=='test' && !L.par.length && !await ask({title:'Aucun parcours', msg:'Cette leçon n’a pas de parcours du jour. Afficher le QR quand même ?', ok:'Afficher'})) return;
  const o=overlay(`QR de la leçon · ${esc(c.name)} · leçon ${n}`, `<p class="muted center">Sur chaque tablette élève : <b>Scanner les infos du cours</b>. Les QR défilent seuls ; tenez la tablette à 30–40 cm, luminosité au maximum.</p><div id="qrSeance" class="center"></div>`, 'wide');
  const pkt=Classe.buildSeance(c, n);
  await QR.showPacket(pkt, 'S', o.body.querySelector('#qrSeance'), '');
}
Object.assign(ACT, {
  asg(b){ const c=Classe.active(); Classe.setAsg(c, c.cur, b.dataset.sid, b.dataset.pid||null); App.ChronoUI.drop(); renderLesson(); },
  asgAll(b){ const c=Classe.active(); Classe.students(c).forEach(st=>Classe.setAsg(c, c.cur, st.id, b.dataset.pid||null)); App.ChronoUI.drop(); renderLesson(); },
  att(b){ const c=Classe.active(); Classe.setAtt(c, c.cur, b.dataset.sid, b.dataset.v); App.ChronoUI.drop(); renderLesson(); },
  addParcours(){
    const c=Classe.active(), n=c.cur, Lb=Store.library();
    let tab = Lb.user.length ? 'user' : 'model', q='';
    const o=overlay('🗺️ Choisir les parcours du jour', `<p class="pp-hint">Touchez les parcours pour les <b>ajouter ou les retirer</b> : vous pouvez en sélectionner plusieurs. <span class="pp-count"></span></p><div class="pp-bar"><div class="seg"><button type="button" data-tab="user">Mes parcours (${Lb.user.length})</button><button type="button" data-tab="model">Modèles (${Lb.builtins.length})</button></div>
        <input type="search" placeholder="Rechercher…" class="pp-q"></div><div class="par-grid pp-grid"></div>
      <div class="btnrow end"><button type="button" class="btn primary lg" data-done>Terminé</button></div>`, 'wide');
    const grid=o.el.querySelector('.pp-grid');
    const draw=()=>{
      const L=Classe.lesson(c,n);
      o.el.querySelector('.pp-count').innerHTML = `<b>${L.par.length}</b> sélectionné(s)${L.par.length?' : '+L.par.map((p,i)=>`P${i+1} ${esc(p.name)}`).join(' · '):''}`;
      o.el.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
      const list=(tab==='user'?Lb.user:Lb.builtins).filter(p=>!q || (p.name+' '+Store.summary(p)).toLowerCase().includes(q));
      grid.innerHTML = list.length ? list.map(p=>{ const on=L.par.some(x=>x.id===p.id);
        return `<button type="button" class="par-card ${on?'on':''}" data-pid="${esc(p.id)}">${on?'<span class="check">✓</span>':''}<canvas class="schema"></canvas>
          <b>${esc(p.name)}</b><span class="muted small">${p.n*25} m · ${esc(Store.ENTREES[Store.validEntree(p.entree)].label)}</span><span class="muted small">${esc(Store.summary(p).replace(/^[^·]*· ?/,''))}</span></button>`; }).join('')
        : '<div class="empty">Aucun parcours.</div>';
      requestAnimationFrame(()=>grid.querySelectorAll('.par-card').forEach(b=>{ const p=[...Lb.user,...Lb.builtins].find(x=>x.id===b.dataset.pid); Schema.render(b.querySelector('canvas'), p, {compact:true}); }));
    };
    o.el.querySelector('.pp-q').oninput=e=>{ q=e.target.value.trim().toLowerCase(); draw(); };
    o.el.addEventListener('click', e=>{
      const t=e.target.closest('[data-tab]'); if(t){ tab=t.dataset.tab; draw(); return; }
      if(e.target.closest('[data-done]')){ o.close(); renderLesson(); return; }
      const b=e.target.closest('[data-pid]'); if(!b) return;
      const p=[...Lb.user,...Lb.builtins].find(x=>x.id===b.dataset.pid); const L=Classe.lesson(c,n);
      if(L.par.some(x=>x.id===p.id)) Classe.removeParcours(c,n,p.id); else Classe.addParcours(c,n,p);
      draw();
    });
    o.el.querySelector('[data-x]').addEventListener('click', ()=>renderLesson());
    draw();
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

/* ---------- Dessins des piliers (petites illustrations) ---------- */
function swimmerG(x, y, rot=0, o={}){
  const arms = o.arms==='side' ? `<path d="M10 2 L-6 6" stroke="#F2C29B" stroke-width="4.5" stroke-linecap="round"/>`
    : o.arms==='stroke' ? `<path d="M10 0 Q18 -12 28 -4" fill="none" stroke="#F2C29B" stroke-width="4.5" stroke-linecap="round"/><path d="M10 2 L2 9" stroke="#D9A57E" stroke-width="4.5" stroke-linecap="round"/>`
    : `<path d="M10 -1 L34 -2" stroke="#F2C29B" stroke-width="4.5" stroke-linecap="round"/>`;
  const legs = o.legs==='tuck' ? `<path d="M-14 0 L-6 -10 L-18 -14" fill="none" stroke="#F2C29B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M-14 1 L-34 ${o.kick?-3:1}" stroke="#F2C29B" stroke-width="5" stroke-linecap="round"/><path d="M-14 2 L-33 ${o.kick?6:3}" stroke="#D9A57E" stroke-width="5" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${legs}
    <rect x="-17" y="-5.5" width="30" height="11" rx="5.5" fill="#F2C29B"/><rect x="-17" y="-5.5" width="12" height="11" rx="4" fill="#0D47A1"/>
    ${arms}<circle cx="18" cy="-1" r="6.5" fill="#F2C29B"/><path d="M12.5 -2 A6.5 6.5 0 0 1 24 -4.5 L22 1 Z" fill="#E53935"/></g>`;
}
const WATER = (y=30)=>`<rect x="0" y="${y}" width="120" height="${80-y}" fill="#BFE6FF"/><path d="M0 ${y} q7.5 -3 15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0" fill="none" stroke="#5AB4F0" stroke-width="2"/>`;
function pilArt(id, size=72){
  let g='';
  if(id==='alignement') g = WATER(30)+swimmerG(64,33,0,{kick:true})+`<path d="M18 33 L104 33" stroke="#3A9A1E" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M98 28 l8 5 -8 5" fill="none" stroke="#3A9A1E" stroke-width="2.5"/>`;
  else if(id==='regard') g = WATER(26)+swimmerG(52,29,0,{arms:'stroke'})+`<path d="M74 33 L88 66" stroke="#F59A1B" stroke-width="2.5" stroke-dasharray="4 3"/><path d="M84 62 l4 6 2 -7" fill="none" stroke="#F59A1B" stroke-width="2.5"/><rect x="0" y="72" width="120" height="8" fill="#7FC3EE"/><circle cx="74" cy="29" r="2" fill="#002E6E"/>`;
  else if(id==='coulee') g = WATER(20)+swimmerG(52,48,0)+`<path d="M14 58 h20 M10 50 h18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/><path d="M96 26 V74" stroke="#E8403B" stroke-width="2.5" stroke-dasharray="4 3"/><text x="98" y="36" font-size="11" font-weight="900" fill="#E8403B">5 m</text>`;
  else if(id==='entree') g = WATER(46)+`<rect x="0" y="34" width="20" height="46" fill="#CFC6B8"/><path d="M14 32 Q50 0 76 44" fill="none" stroke="#F59A1B" stroke-width="2" stroke-dasharray="4 3"/>`+swimmerG(70,40,48)+`<path d="M78 46 l-6 -7 M84 46 l2 -9 M90 46 l7 -6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
  else if(id==='virage') g = WATER(18)+`<rect x="104" y="18" width="16" height="62" fill="#CFC6B8"/>`+swimmerG(86,44,180,{legs:'tuck',arms:'side'})+`<path d="M60 30 Q96 14 98 40 Q96 64 58 60" fill="none" stroke="#F59A1B" stroke-width="3"/><path d="M62 55 l-6 5 7 3" fill="none" stroke="#F59A1B" stroke-width="3"/>`;
  else if(id==='immersion') g = WATER(18)+`<path d="M70 76 a14 14 0 0 1 28 0" fill="none" stroke="#222" stroke-width="3.5"/><rect x="0" y="76" width="120" height="4" fill="#7FC3EE"/>`+swimmerG(46,40,65,{});
  else if(id==='remorquage') g = WATER(36)+`<g transform="translate(72 38) rotate(-8)"><rect x="-4" y="-6" width="30" height="12" rx="6" fill="#FFB300" stroke="#C77F00"/><circle cx="32" cy="-3" r="7" fill="#FFD54F" stroke="#C77F00"/></g>`+swimmerG(48,42,180,{arms:'side',kick:true});
  else g = WATER(30)+swimmerG(60,33,0,{arms:'stroke',kick:true});
  return `<svg class="pil-art" viewBox="0 0 120 80" style="width:${size*1.5}px;height:${size}px" aria-hidden="true"><rect width="120" height="80" rx="10" fill="#EAF6FF"/>${g}</svg>`;
}

/* =========================================================
   FIL ROUGE (nageur / observateur) — dessin repris de l'appli Biathlon
   ========================================================= */
const LV = Classe.COMP_LV;
function yarnIcon(s=22){ return `<svg class="yarn-ico" viewBox="-21 -21 42 42" style="width:${s}px;height:${s}px"><circle r="19" fill="#E8403B" stroke="#A90F14" stroke-width="2"/>
  <path d="M-15 -8 Q 0 -20 15 -6 M-18 2 Q 0 -12 18 4 M-14 11 Q 2 -2 15 12 M-6 -18 Q 8 0 -2 18 M5 -18 Q 16 2 6 18" fill="none" stroke="#FFB3AE" stroke-width="2.5" stroke-linecap="round"/></svg>`; }
const compDot = (lv, sug, big)=> lv ? `<span class="cdot ${big?'big':''}" style="background:${LV[lv].c}" title="${LV[lv].n}"></span>`
  : sug ? `<span class="cdot sug ${big?'big':''}" style="border-color:${LV[sug].c};background:${LV[sug].c}55" title="Proposé : ${LV[sug].n}"></span>`
  : `<span class="cdot none ${big?'big':''}" title="Non évalué"></span>`;
const FR_K = { N:{ t:'Nageur', ico:'🏊', fn:(c,n,sid)=>Classe.frSwim(c,n,sid), d:'ne rater aucun obstacle et garder une vitesse de nage stable, proche de sa vitesse de sauveteur (test S1)' },
               O:{ t:'Observateur', ico:'👀', fn:(c,n,sid)=>Classe.frObs(c,n,sid), d:'rester concentré pour aider son partenaire : observer ses passages et renseigner tous les critères' } };
/* une pelote de laine rouge et son fil, un nœud coloré par leçon */
function yarnSVG(c, sid, k){
  const N=Math.max(c.cur, 1), x0=66, step=46, W=x0+N*step+10, y=40;
  let thread=`M30 ${y+4} C 44 ${y+16}, 52 ${y-8}, ${x0} ${y}`;
  for(let i=0;i<N;i++){ const a=x0+i*step, b=a+step, m=(a+b)/2; thread+=` S ${m} ${i%2?y-9:y+9}, ${b} ${y}`; }
  let knots='';
  for(let n=1;n<=N;n++){
    const x=x0+(n-1)*step+step/2, L=Classe.lesson(c,n), at=L.att[sid], f=FR_K[k].fn(c,n,sid), test=L.kind==='test' && k==='N';
    const fill = (at && !(k==='O' && at==='inap')) ? '#C9D1E0' : f && f.lv ? LV[f.lv].c : '#fff';
    knots+=`<g><title>L${n}${test?' · test S1':''}${at ? (at==='abs'?' · absent':' · inapte') : ''}${f ? ' · '+(f.lv?LV[f.lv].n+' · ':'')+f.why : ''}</title>
      ${n===c.cur ? `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#F59A1B" stroke-width="3" stroke-dasharray="4 3"/>` : ''}
      <circle cx="${x}" cy="${y}" r="12" fill="${fill}" stroke="${f && f.lv || at ? '#fff' : '#B0B8C8'}" stroke-width="3" ${f && f.lv || at ? '' : 'stroke-dasharray="3 3"'}/>
      ${at ? `<text x="${x}" y="${y+5}" text-anchor="middle" font-size="13" font-weight="900" fill="#0A1633">${at==='abs'?'A':'I'}</text>` : test ? `<text x="${x}" y="${y+5}" text-anchor="middle" font-size="12" font-weight="900" fill="#0062C4">S1</text>` : ''}
      <text x="${x}" y="13" text-anchor="middle" font-size="13" font-weight="900" fill="#002E6E">L${n}</text></g>`;
  }
  return `<svg class="yarn-svg" viewBox="0 0 ${W} 64" style="max-width:${W*1.25}px">
    <path d="${thread}" fill="none" stroke="#D0161B" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(26 42)"><circle r="19" fill="#E8403B"/><circle r="19" fill="none" stroke="#A90F14" stroke-width="2"/>
      <path d="M-15 -8 Q 0 -20 15 -6 M-18 2 Q 0 -12 18 4 M-14 11 Q 2 -2 15 12 M-6 -18 Q 8 0 -2 18 M5 -18 Q 16 2 6 18" fill="none" stroke="#FFB3AE" stroke-width="2" stroke-linecap="round"/></g>
    ${knots}</svg>`;
}
function frStrip(c, sid, k){
  const sg=Classe.frSuggest(c, sid, k), fin=Classe.frFinal(c, sid, k);
  return `<div class="fr-strip"><div class="fr-h"><b>${yarnIcon(22)} Fil rouge ${FR_K[k].ico} ${FR_K[k].t}</b>
      <span class="fr-moy">${fin ? `${compDot(fin,null,true)} ${LV[fin].n} <small>(décision)</small>` : sg ? `${compDot(null, sg.lv, true)} proposé : ${LV[sg.lv].n}` : '<span class="muted">pas encore évalué</span>'}</span></div>
    ${yarnSVG(c, sid, k)}</div>`;
}
let filSid=null;
enterHooks.pfil = renderFil;
function renderFil(){
  const c=needClass('pfil'); if(!c) return;
  const S=Classe.students(c);
  if(filSid && S.some(s=>s.id===filSid)) return renderFilDetail(c, S.find(s=>s.id===filSid));
  V('pfil').innerHTML = `<div class="card"><h2>${yarnIcon(28)} Fil rouge</h2>
      <div class="fr-legend"><b>🏊 Nageur</b> · ${FR_K.N.d}.</div>
      <div class="fr-legend"><b>👀 Observateur</b> · ${FR_K.O.d}.</div>
      <div class="fr-legend">${[1,2,3,4].map(k=>`${compDot(k)} ${LV[k].n}`).join(' · ')} · ${compDot(null,3)} proposé par l’appli · ${compDot(null)} non évalué</div></div>
    <div class="fil-tiles">${S.map(s=>{ const r=['N','O'].map(k=>({k, fin:Classe.frFinal(c,s.id,k), sg:Classe.frSuggest(c,s.id,k)}));
      return `<button class="fil-tile ${r.every(x=>x.fin)?'done':''}" data-act="filSid" data-sid="${s.id}">${r.every(x=>x.fin)?'<span class="check">✓</span>':''}
        <span class="name">${esc(s.disp)}</span>
        ${r.map(x=>`<span class="fil-row">${FR_K[x.k].ico} ${compDot(x.fin, x.sg && x.sg.lv)} <span class="muted small">${x.fin ? LV[x.fin].n : x.sg ? 'proposé : '+LV[x.sg.lv].n : '—'}</span></span>`).join('')}</button>`; }).join('')}</div>`;
}
function compPick(c, sid, k){
  const sg=Classe.frSuggest(c, sid, k), fin=Classe.frFinal(c, sid, k);
  return `<div class="comp-pick"><div class="comp-h">${yarnIcon(20)} <b>${FR_K[k].ico} ${FR_K[k].t}</b> · couleur finale (décision de l’enseignant)</div>
    <div class="comp-aid">Proposition de l’appli : ${sg ? `${compDot(sg.lv)} <b>${LV[sg.lv].n}</b> (moyenne des leçons : ${String(Math.round(sg.moy*10)/10).replace('.',',')} / 4)` : '<b>—</b> (pas assez de données)'}</div>
    <div class="comp-btns">${[1,2,3,4].map(v=>`<button class="cbtn ${fin===v?'on':''} ${sg&&sg.lv===v&&!fin?'reco':''}" style="--cc:${LV[v].c};--cf:${LV[v].f}" data-act="frSet" data-sid="${sid}" data-k="${k}" data-v="${v}">${LV[v].n}</button>`).join('')}
      ${fin ? `<button class="btn ghost small" data-act="frSet" data-sid="${sid}" data-k="${k}" data-v="0">Effacer</button>` : ''}</div></div>`;
}
function frTable(c, sid){
  let rows='';
  for(let n=1;n<=c.nb;n++){
    const L=Classe.lesson(c,n), at=L.att[sid], fN=Classe.frSwim(c,n,sid), fO=Classe.frObs(c,n,sid);
    if(!fN && !fO && !at) continue;
    rows+=`<tr><td><b>L${n}</b>${L.kind==='test'?'<small>test S1</small>':''}${at?attTag(at):''}</td>
      <td>${fN ? `${compDot(fN.lv,null,true)} <span class="why">${fN.lv?`<b>${LV[fN.lv].n}</b> · `:''}${esc(fN.why)}</span>` : L.kind==='test' ? '<span class="muted small">test : mesure de la vitesse</span>' : ''}</td>
      <td>${fO ? `${compDot(fO.lv,null,true)} <span class="why">${fO.lv?`<b>${LV[fO.lv].n}</b> · `:''}${esc(fO.why)}</span>` : ''}</td></tr>`;
  }
  return `<div class="table-wrap"><table class="bt"><thead><tr><th>Leçon</th><th>🏊 Nageur</th><th>👀 Observateur</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">Pas encore de données</td></tr>'}</tbody></table></div>`;
}
const FR_RULES = `<details class="rule"><summary>Comment l’appli propose les couleurs</summary>
  <p><b>🏊 Nageur</b> (leçons de parcours) : écart moyen entre la vitesse de nage du passage (nage seule, hors obstacles chronométrés) et sa vitesse de sauveteur mesurée au dernier test S1.</p>
  <table class="bt"><tr><th></th><th>Écart à la vitesse de sauveteur</th></tr><tr><td>${compDot(4)} Très bonne</td><td>5 % et moins</td></tr><tr><td>${compDot(3)} Satisfaisante</td><td>6 à 10 %</td></tr><tr><td>${compDot(2)} Fragile</td><td>11 à 20 %</td></tr><tr><td>${compDot(1)} Insuffisante</td><td>plus de 20 %</td></tr></table>
  <p>Obstacle raté (faute) : un niveau de moins si au plus 1 faute par passage en moyenne, deux niveaux de moins au-delà.</p>
  <p><b>👀 Observateur</b> : part des critères renseignés (oui ou non) sur les passages qu’il a observés. 95 % et plus → très bonne · 80 % → satisfaisante · 50 % → fragile · moins → insuffisante. Présent mais aucun passage observé → insuffisante.</p>
  <p>Couleur proposée sur le cycle = moyenne des leçons. La couleur finale reste votre décision.</p></details>`;
function renderFilDetail(c, s){
  V('pfil').innerHTML = `<div class="entry-name"><div class="who">${esc(s.prenom)} ${esc(s.nom)}</div><button class="btn ghost" data-act="filBack">← Tous les élèves</button></div>
    <div class="card">${frStrip(c, s.id, 'N')}${frStrip(c, s.id, 'O')}</div>
    <div class="card"><h3>📋 Leçon par leçon</h3>${frTable(c, s.id)}${FR_RULES}</div>
    <div class="card">${compPick(c, s.id, 'N')}${compPick(c, s.id, 'O')}</div>`;
}
Object.assign(ACT, {
  filSid(b){ filSid=b.dataset.sid; renderFil(); window.scrollTo(0,0); },
  filBack(){ filSid=null; renderFil(); },
  openFil(b){ filSid=b.dataset.sid; go('pfil'); },
  frSet(b){ const c=Classe.active(); Classe.setFrFinal(c, b.dataset.sid, b.dataset.k, +b.dataset.v); rerender(App.view()); },
});

/* =========================================================
   ENSEIGNANT · Bilan de la leçon
   ========================================================= */
let bilanN=null;
enterHooks.pbilan = renderBilan;
function renderBilan(){
  const c=needClass('pbilan'); if(!c) return;
  const n = bilanN && bilanN<=c.nb ? bilanN : c.cur;
  const L=Classe.lesson(c,n), rows=Classe.lessonBilan(c,n), res=Classe.resultsOf(c,n), test=L.kind==='test';
  const pars=[]; if(!test){ L.par.forEach(p=>pars.push({id:p.id, name:p.name})); res.forEach(r=>{ if(!r.test && !pars.some(x=>x.id===r.pid)) pars.push({id:r.pid, name:r.pname}); }); }
  const pils=L.pil.map(id=>Classe.pilier(id)).filter(Boolean);
  const classObs=pils.map(p=>({p, c:Classe.obsCount(res, p.id)}));
  const D={}; rows.forEach(r=>{ D[r.s.id]=r.s.disp; });
  V('pbilan').innerHTML = `<div class="card"><span class="field-lbl">Leçon</span>${lessonPicker(c, n, 'bilanN')}
      <div class="muted small">${test?`⏱️ Test de vitesse ${L.tdist} m · `:''}${res.length} passage(s) reçu(s) · ${rows.filter(r=>r.n).length} élève(s) chronométré(s) · ${rows.filter(r=>r.observed).length} observateur(s)</div></div>
    ${classObs.map(({p,c:cc})=>`<div class="card"><div class="pil-head">${pilArt(p.id, 64)}<div><div class="eyebrow">Classe · pilier</div><h3>${esc(p.n)}</h3></div></div>
      <div class="crit-bars">${p.cr.map((x,k)=>{ const v=pct(cc[k]); return `<div class="cbar"><div><b>${esc(x.t)}</b><span class="muted small">${esc(x.o)}</span></div>
        <div class="bar"><i class="${pctCls(v)}" style="width:${v??0}%"></i></div><span class="pv">${v==null?'—':v+' % oui'}<small>${cc[k].tot?` (${cc[k].yes}/${cc[k].tot})`:''}</small></span></div>`; }).join('')}</div></div>`).join('')}
    <div class="card"><h3>Par élève</h3><div class="table-wrap"><table class="bt">
      <thead><tr><th>Élève</th><th>Passages</th><th>Observé par</th><th>A observé</th>
        ${test ? '<th>Vitesse mesurée<small>meilleur passage</small></th>' : `<th>Vitesse de sauveteur<small>dernier test</small></th>${pars.map(p=>`<th>${esc(p.name)}<small>meilleur temps</small></th>`).join('')}`}
        ${pils.map(p=>p.cr.map(x=>`<th class="crit">${esc(x.t)}<small>${esc(p.n)}</small></th>`).join('')).join('')}
        <th>${yarnIcon(16)} 🏊</th><th>${yarnIcon(16)} 👀</th></tr></thead>
      <tbody>${rows.map(r=>{ const obsBy=[...new Set(res.filter(x=>x.sid===r.s.id && x.oid).map(x=>D[x.oid]||'?'))];
        return `<tr class="${r.att?'is-att':''}"><td><button class="linkbtn" data-act="openCycle" data-sid="${r.s.id}">${esc(r.s.disp)}</button> ${attTag(r.att)}</td>
        <td class="c">${r.n||'—'}</td><td>${obsBy.length?esc(obsBy.join(', ')):'<span class="muted">—</span>'}</td><td class="c">${r.observed||'—'}</td>
        ${test ? `<td class="c">${r.testV?`<b>${Classe.fmtSpeed(r.testV)}</b>`:'—'}</td>` : `<td class="c">${r.ref?`${Classe.fmtSpeed(r.ref.v)}<small>L${r.ref.k}</small>`:'<span class="muted">—</span>'}</td>
          ${pars.map(p=>{ const b=r.best[p.id]; const v=b?Classe.speedOf(b):null; const e=v&&r.ref?v/r.ref.v-1:null;
            return `<td class="c">${b?`<b>${fmt(b.total)}</b>${b.faults?`<small>${b.faults} faute(s)</small>`:''}${e!=null?`<small class="${Math.abs(e)<=0.1?'ok':'ko'}">vitesse ${e>=0?'+':''}${Math.round(e*100)} %</small>`:''}`:'—'}</td>`; }).join('')}`}
        ${r.obs.map(o=>{ const P=Classe.pilier(o.pid); return P ? o.c.map(x=>{ const v=pct(x); return `<td class="c"><span class="pc ${pctCls(v)}">${v==null?'—':v+' %'}</span></td>`; }).join('') : ''; }).join('')}
        <td class="c" title="${esc(r.frN?.why||'')}">${compDot(r.frN?.lv)}</td><td class="c" title="${esc(r.frO?.why||'')}">${compDot(r.frO?.lv)}</td>
      </tr>`; }).join('')}</tbody></table></div></div>
    <div class="btnrow"><button class="btn green" data-act="xlsx">📁 Export Excel (cycle complet)</button><button class="btn ghost" data-act="go:pfil">${yarnIcon(20)} Fil rouge</button></div>`;
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
  const D={}; S.forEach(x=>{ D[x.id]=x.disp; });
  const cyc=Classe.studentCycle(c, s.id);
  const allRes=cyc.flatMap(x=>x.res), allObs=cyc.flatMap(x=>x.observed);
  const pres=cyc.filter(x=>!x.att && (x.res.length || x.L.par.length || x.L.kind==='test')).length, abs=cyc.filter(x=>x.att==='abs').length, inap=cyc.filter(x=>x.att==='inap').length;
  const tests=cyc.filter(x=>x.L.kind==='test').map(x=>{ const vs=x.res.filter(r=>r.test).map(Classe.speedOf).filter(Boolean); return {n:x.n, v:vs.length?Math.max(...vs):null, d:x.L.tdist}; });
  const pilIds=[...new Set(cyc.flatMap(x=>x.obs.map(o=>o.pid)))];
  const evo=pilIds.map(pid=>{ const P=Classe.pilier(pid); if(!P) return '';
    const ls=cyc.filter(x=>x.obs.some(o=>o.pid===pid));
    return `<div class="evo"><div class="pil-head">${pilArt(P.id, 48)}<h4>${esc(P.n)}</h4></div><div class="table-wrap"><table class="bt"><thead><tr><th>Critère</th>${ls.map(x=>`<th>L${x.n}</th>`).join('')}</tr></thead><tbody>
      ${P.cr.map((cr,k)=>`<tr><td><b>${esc(cr.t)}</b><small class="muted"> ${esc(cr.o)}</small></td>${ls.map(x=>{ if(x.att) return `<td class="c">${attTag(x.att)}</td>`;
        const o=x.obs.find(q=>q.pid===pid).c[k], v=pct(o); return `<td class="c"><span class="pc ${pctCls(v)}">${v==null?'—':`${o.yes}/${o.tot}`}</span></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div></div>`; }).join('');
  V('pcycle').innerHTML = `<div class="cycle">
    <aside class="card cycle-list">${S.map(x=>`<button class="${x.id===s.id?'on':''}" data-act="cycleSid" data-sid="${x.id}">${esc(x.disp)}</button>`).join('')}</aside>
    <div class="cycle-main">
      <div class="card fiche"><div class="row"><div class="grow"><div class="eyebrow">${esc(c.name)} · bilan du cycle</div><h2>${esc(s.prenom)} ${esc(s.nom)}</h2>
        <div class="muted small">${pres} leçon(s) de pratique · ${abs} absence(s) · ${inap} inaptitude(s) · 🏊 ${allRes.length} passage(s) nagé(s) · 👀 ${allObs.length} passage(s) observé(s)</div></div>
        <button class="btn ghost no-print" data-act="print">🖨️ Imprimer la fiche</button><button class="btn green no-print" data-act="xlsx">📁 Excel (classe)</button></div>
        <div class="speed-row">${tests.length ? tests.map(t=>`<span class="speed-chip">⏱️ Test S1 · L${t.n} (${t.d} m) : <b>${t.v?Classe.fmtSpeed(t.v):'—'}</b></span>`).join('') : '<span class="muted small">Aucun test de vitesse programmé.</span>'}</div></div>
      <div class="card">${frStrip(c, s.id, 'N')}${frStrip(c, s.id, 'O')}<div class="btnrow no-print"><button class="btn ghost small" data-act="openFil" data-sid="${s.id}">Décider des couleurs finales →</button></div></div>
      ${evo ? `<div class="card"><h3>👀 Critères observés sur ses passages (oui / observations)</h3>${evo}</div>` : ''}
      <div class="card"><h3>📋 Leçon par leçon</h3><div class="table-wrap"><table class="bt"><thead><tr><th>Leçon</th><th>Présence</th><th>Pilier(s)</th><th>🏊 Ses passages</th><th>👀 Ce qu’il a observé</th></tr></thead><tbody>
        ${cyc.map(x=>`<tr><td><b>L${x.n}</b>${x.L.kind==='test'?`<small>test S1 · ${x.L.tdist} m</small>`:''}${x.L.date?`<small>${new Date(x.L.date).toLocaleDateString('fr-FR')}</small>`:''}</td>
          <td>${x.att?attTag(x.att):(x.res.length||x.observed.length?'<span class="tag ok">Présent</span>':'<span class="muted">—</span>')}</td>
          <td>${x.L.pil.map(id=>esc(Classe.pilier(id)?.n||'')).join('<br>')||'<span class="muted">—</span>'}</td>
          <td>${x.res.length ? x.res.map(r=>{ const v=Classe.speedOf(r), e=v&&x.ref&&!r.test?v/x.ref.v-1:null;
              return `<div class="pass"><b>${fmt(r.total)}</b> · ${esc(r.pname)}${r.faults?` · <span class="ko">${r.faults} faute(s)</span>`:''}${r.oid?` · observé par ${esc(D[r.oid]||'?')}`:''}
              <small>${v?`vitesse ${Classe.fmtSpeed(v)}${e!=null?` (${e>=0?'+':''}${Math.round(e*100)} %)`:''} · `:''}${r.lens.map((l,i)=>`${Store.lenLabel(i)} ${l!=null?fmt(l):'—'}`).join(' · ')}</small></div>`; }).join('') : '<span class="muted">—</span>'}</td>
          <td>${x.observed.length ? `${x.observed.length} passage(s) : ${esc([...new Set(x.observed.map(r=>D[r.sid]||'?'))].join(', '))}${x.frO&&x.frO.x!=null?`<small>critères renseignés ${Math.round(x.frO.x*100)} %</small>`:''}` : '<span class="muted">—</span>'}</td></tr>`).join('')}
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
  V('ppil').innerHTML = `<div class="card"><div class="row"><p class="muted small grow">Un pilier = ce que vous voulez vraiment observer. Il contient des <b>contenus</b> (lus par les élèves) et <b>3 critères</b>, chacun avec son <b>observable</b> que l’observateur coche oui / non une fois par aller-retour.</p>
      <button class="btn blue" data-act="pilNew">${I.plus}Nouveau pilier</button></div></div>
    <div class="grid-cards pil-cards">${P.map(p=>`<article class="card pil">
      <div class="pil-head">${pilArt(p.id, 76)}<h3>${esc(p.n)}</h3></div>${p.c?`<ul class="contenus">${p.c.split('\n').filter(Boolean).map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}
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
      <div class="pil-head">${pilArt(p.id, 96)}<div><div class="eyebrow">${esc(s.cn)} · leçon ${s.n}</div><h2>${esc(p.n)}</h2></div></div>
      ${p.c?`<h4>🏊 Ce que je dois faire</h4><ul class="contenus">${p.c.split('\n').filter(Boolean).map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}
      <h4>👀 Ce que l’observateur regarde (oui / non, une fois par aller-retour)</h4>
      <ol class="crits">${p.cr.map(x=>`<li><b>${esc(x.t)}</b><span>${esc(x.o)}</span></li>`).join('')}</ol></article>`).join('')
    : '<div class="empty">Pas de pilier pour cette leçon.</div>';
  if(s.obj) V('epil').insertAdjacentHTML('afterbegin', `<div class="card"><div class="eyebrow">Consignes de la leçon</div><p class="obj">${esc(s.obj)}</p></div>`);
};

/* ---------- ÉLÈVE · Parcours du jour ---------- */
enterHooks.epar = ()=>{
  const s=Classe.seance(); if(!s) return go('home', true);
  V('epar').innerHTML = s.pars.length ? `<div class="grid-cards">${s.pars.map((p,i)=>{ const who=s.st.filter(x=>x.pid===p.id).map(x=>x.disp);
      return `<article class="pcard" style="--pc:${PCOL[i%PCOL.length]}"><div class="pcard-head"><div><div class="pcard-name"><span class="pnum">P${i+1}</span> ${esc(p.name)}</div>
      <div class="muted small">${p.n} longueurs (${p.n*25} m) · ${esc(Store.summary(p))}</div>
      <div class="par-who">👥 ${who.length ? esc(who.join(', ')) : 'au choix'}</div></div></div>
      <canvas class="schema" data-pid="${esc(p.id)}"></canvas>
      <div class="btnrow"><button class="btn teal" data-act="eView" data-pid="${esc(p.id)}">${I.play}Voir l’animation</button><button class="btn red" data-act="eChrono" data-pid="${esc(p.id)}">${I.chrono}Chronométrer</button></div></article>`; }).join('')}</div>`
    : '<div class="empty">Pas de parcours pour cette leçon.</div>';
  requestAnimationFrame(()=>$$('#v-epar canvas[data-pid]').forEach(cv=>{ const p=s.pars.find(x=>x.id===cv.dataset.pid); if(p) Schema.render(cv, p, {theme:'light'}); }));
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
