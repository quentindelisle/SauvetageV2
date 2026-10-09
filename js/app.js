/* =========================================================
   App — navigation et interfaces
   ========================================================= */
const App = {};
(function(){
'use strict';

/* ---------- Petits utilitaires ---------- */
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const esc = (s)=>String(s??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const vibrate = (p)=>{ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };
const PAIR_COLORS = ['#2f80ed','#7c5cff','#22a861','#f39c12','#e91e63','#00acc1'];
const pairColor = (i)=>PAIR_COLORS[Math.floor(i/2)%PAIR_COLORS.length];

function toast(msg, err=false){
  const t = document.createElement('div');
  t.className = 'toast'+(err?' err':''); t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>t.remove(), 2600);
}

/** Boîte de dialogue : confirm (input=false) ou prompt (input=true) */
function ask({title='', msg='', ok='OK', cancel='Annuler', input=false, value='', danger=false}={}){
  const d = $('#dlg');
  $('#dlgTitle').textContent = title; $('#dlgMsg').textContent = msg;
  const inp = $('#dlgInput'); inp.hidden = !input; inp.value = value;
  $('#dlgOk').textContent = ok; $('#dlgCancel').textContent = cancel;
  $('#dlgOk').className = 'btn ' + (danger ? 'red' : 'blue');
  $('#dlgCancel').hidden = cancel===null;
  return new Promise(res=>{
    const done = ()=>{ d.removeEventListener('close', done); res(d.returnValue==='ok' ? (input ? inp.value.trim() : true) : (input ? null : false)); };
    d.addEventListener('close', done);
    d.returnValue = 'cancel';
    d.showModal();
    if(input) setTimeout(()=>{ inp.focus(); inp.select(); }, 30);
  });
}
$('#dlgInput').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#dlg').close('ok'); } });

/* ---------- État ---------- */
let cur = Store.current();
function setCurrent(p, silent=false){
  cur = Store.clone(p);
  Store.setCurrent(cur);
  updateChrome();
  if(!silent) toast('Parcours actif : ' + cur.name);
}

/* ---------- Navigation ---------- */
const TITLES = { home:'Sauvetage CA2', library:'Parcours', editor:'Éditeur de parcours', view:'Visualisation', chrono:'Chronométrie', results:'Passages libres' };
let view = null;
const leaveHooks = {}, enterHooks = {};

function go(name, replace=false){
  const h = '#/'+name;
  if(location.hash===h){ show(name); return; }
  if(replace) history.replaceState(null,'',h); else history.pushState(null,'',h);
  show(name);
}
async function show(name){
  if(!TITLES[name]) name='home';
  if(App.guard && !App.guard(name)) name='home';
  if(view===name){ if(enterHooks[name] && name==='home') enterHooks[name](); return; }
  if(view && leaveHooks[view]){
    const ok = await leaveHooks[view](name);
    if(ok===false){ history.pushState(null,'','#/'+view); return; }
  }
  view = name;
  $$('.view').forEach(v=>v.classList.toggle('active', v.dataset.view===name));
  document.body.classList.toggle('at-home', name==='home');
  $('#appTitle').textContent = TITLES[name];
  window.scrollTo(0,0);
  if(enterHooks[name]) enterHooks[name]();
}
window.addEventListener('popstate', ()=>show((location.hash.match(/^#\/(\w+)/)||[])[1]||'home'));
$('#btnBack').addEventListener('click', ()=>{ if(history.length>1 && view!=='home') history.back(); else go('home'); });
$('#chipCurrent').addEventListener('click', ()=>go(Classe.role()==='eleve' ? 'epar' : 'library'));
document.addEventListener('click', e=>{
  const g = e.target.closest('[data-go]'); if(g){ go(g.dataset.go); return; }
  const a = e.target.closest('[data-action]'); if(a && actions[a.dataset.action]) actions[a.dataset.action](a);
});
const actions = {
  newParcours(){ Editor.open(Store.emptyParcours(4), {isNew:true}); },
};

function updateChrome(){
  $('#chipCurrentName').textContent = cur.name;
}

/* =========================================================
   ACCUEIL
   ========================================================= */
/* =========================================================
   BIBLIOTHÈQUE
   ========================================================= */
enterHooks.library = renderLibrary;
function renderLibrary(){
  const L = Store.library();
  const card = (p)=>{
    const isCur = p.id===cur.id;
    const el = document.createElement('article');
    el.className = 'pcard'+(isCur?' is-current':'');
    el.innerHTML = `
      <div class="pcard-head">
        <div><div class="pcard-name">${esc(p.name)}</div>
        <div class="muted small">${p.n} longueurs · ${esc(Store.summary(p))}</div></div>
        ${isCur ? '<span class="badge cur">Actif</span>' : (p.builtin ? '<span class="badge">Modèle</span>' : '')}
      </div>
      <canvas class="schema"></canvas>
      <div class="btnrow">
        <button class="btn teal" data-a="use">${isCur?'Visualiser':'Utiliser'}</button>
        <button class="btn ghost" data-a="edit">${p.builtin?'Dupliquer':'Modifier'}</button>
        <button class="btn ghost" data-a="export" title="Exporter en .json">Exporter</button>
        ${p.builtin ? '' : '<button class="btn ghost danger" data-a="del" title="Supprimer">Suppr.</button>'}
      </div>`;
    el.addEventListener('click', async e=>{
      const b = e.target.closest('[data-a]'); if(!b) return;
      const a = b.dataset.a;
      if(a==='use'){ if(!isCur) await switchCurrent(p); if(p.id===cur.id) go(isCur?'view':'home'); }
      else if(a==='edit'){
        if(p.builtin){ const c=Store.clone(p); c.id=Store.uid(); c.builtin=false; c.name=p.name+' (copie)'; Editor.open(c, {isNew:true}); }
        else Editor.open(p);
      }
      else if(a==='export'){ Exporter.parcoursJson(p); }
      else if(a==='del'){
        if(await ask({title:'Supprimer ce parcours ?', msg:`« ${p.name} » sera supprimé de cet appareil.\nPensez à l’exporter si vous voulez le garder.`, ok:'Supprimer', danger:true})){
          Store.deleteFromLibrary(p.id); toast('Parcours supprimé'); renderLibrary();
        }
      }
    });
    return el;
  };
  const u = $('#libUser'), b = $('#libBuiltin');
  u.innerHTML=''; b.innerHTML='';
  if(!L.user.length) u.innerHTML = '<div class="empty">Aucun parcours enregistré sur cet appareil.<br>Créez-en un ou importez un fichier .json.</div>';
  L.user.forEach(p=>u.appendChild(card(p)));
  L.builtins.forEach(p=>b.appendChild(card(p)));
  requestAnimationFrame(()=>{
    $$('#libUser .pcard, #libBuiltin .pcard').forEach((el,i)=>{
      const p = i < L.user.length ? L.user[i] : L.builtins[i-L.user.length];
      Schema.render(el.querySelector('canvas'), p, {compact:true});
    });
  });
}

async function switchCurrent(p){
  const s = Store.chronoSession();
  if(s && s.taps && s.taps.length && !s.saved){
    const ok = await ask({title:'Passage en cours', msg:'Un passage chronométré non enregistré est en cours. Changer de parcours l’effacera.', ok:'Changer quand même', danger:true});
    if(!ok) return false;
    Store.saveChronoSession(null); ChronoUI.drop();
  }
  setCurrent(p);
  return true;
}

$('#fileImport').addEventListener('change', async e=>{
  const files = Array.from(e.target.files||[]);
  let okN=0, last=null;
  for(const f of files){
    try{
      const txt = await f.text();
      const json = JSON.parse(txt);
      const list = Array.isArray(json) ? json : [json];
      list.forEach(item=>{
        const p = Store.normalize(item);
        p.builtin=false;
        if(Store.findParcours(p.id) && Store.findParcours(p.id).builtin) p.id = Store.uid();
        last = Store.saveToLibrary(p); okN++;
      });
    }catch(err){ toast(`Import impossible : ${f.name}`, true); }
  }
  e.target.value='';
  if(okN){
    toast(`${okN} parcours importé${okN>1?'s':''}`);
    if(okN===1 && last && await ask({title:'Parcours importé', msg:`Utiliser « ${last.name} » comme parcours actif ?`, ok:'Utiliser', cancel:'Plus tard'})) await switchCurrent(Store.normalize(last));
    renderLibrary();
  }
});

/* =========================================================
   ÉDITEUR
   ========================================================= */
const Editor = (function(){
  let draft=null, dirty=false, isNew=false, onSave=null;
  const T = Store.TYPES;

  function open(p, opts={}){
    draft = Store.clone(p); isNew = !!opts.isNew; dirty = !!opts.isNew && Store.countObstacles(draft)>0; onSave = opts.onSave || null;
    $('#edName').value = draft.name;
    renderAll();
    go('editor');
  }
  function nextObsId(){ return draft.obstacles.flat().reduce((m,o)=>Math.max(m,o.id),0)+1; }
  function touch(){ dirty=true; refreshPreview(); }

  function refreshPreview(){
    $$('#edEntree button').forEach(b=>b.classList.toggle('on', b.dataset.entree===Store.validEntree(draft.entree)));
    $('#edLenVal').textContent = draft.n;
    $('#edLenMeters').textContent = (draft.n*25)+' m';
    $('#edLenMinus').disabled = draft.n<=1;
    $('#edLenPlus').disabled = draft.n>=Store.MAX_LEN;
    Schema.render($('#edSchema'), draft, {theme:'light'});
    const w = Store.warnings(draft);
    $('#edWarnings').innerHTML = w.length ? w.map(x=>`<li>${esc(x)}</li>`).join('') : (Store.countObstacles(draft) ? '<li class="ok">Parcours cohérent.</li>' : '<li>Ajoutez des obstacles dans les longueurs.</li>');
  }

  function rangeField(label, key, o, i, min, max){
    return `<div class="field"><span class="field-lbl">${label}</span>
      <div class="range" data-key="${key}">
        <input type="range" min="${min}" max="${max}" step="1" value="${o[key]}" aria-label="${label}">
        <input type="number" min="${min}" max="${max}" step="1" value="${o[key]}" inputmode="numeric" aria-label="${label} (m)">
      </div></div>`;
  }

  function renderLength(i){
    const host = $(`#edLen${i}`); if(!host) return;
    const arr = draft.obstacles[i];
    host.querySelector('.obslist').innerHTML = arr.map(o=>{
      const ex = T[o.type].extra;
      return `<div class="obs" data-id="${o.id}">
        <label class="field"><span class="field-lbl">Obstacle</span>
          <select data-k="type">${Store.TYPE_ORDER.map(t=>`<option value="${t}" ${o.type===t?'selected':''}>${T[t].label}</option>`).join('')}</select></label>
        ${rangeField('Placement (m)', 'dist', o, i, 0, 25)}
        ${ex ? rangeField(ex.label+' (m)', ex.key, o, i, ex.key==='depl'?1:0, 25) : '<div class="field"><span class="field-lbl">&nbsp;</span><div class="noextra">—</div></div>'}
        <button class="del" data-k="del" aria-label="Supprimer l’obstacle" title="Supprimer"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div>`;
    }).join('');
    const add = host.querySelector('.addobs');
    add.disabled = arr.length>=Store.MAX_OBS_PER_LEN;
    add.innerHTML = arr.length>=Store.MAX_OBS_PER_LEN ? `Maximum ${Store.MAX_OBS_PER_LEN} obstacles par longueur` : '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Ajouter un obstacle';
    host.querySelector('.cnt').textContent = arr.length ? `${arr.length} obstacle${arr.length>1?'s':''}` : 'Nage libre';
  }

  function renderAll(){
    const host = $('#edLengths'); host.innerHTML='';
    for(let i=0;i<draft.n;i++){
      const c = document.createElement('div');
      c.className='card lencard'; c.id='edLen'+i; c.dataset.li=i;
      c.style.setProperty('--c', pairColor(i));
      c.innerHTML = `<div class="lencard-head"><span class="lentag">${Store.lenLabel(i)}</span><span class="muted small cnt"></span>
        <span class="muted small">${i%2===0?'départ mur A →':'← départ mur B'}</span></div>
        <div class="obslist"></div>
        <button class="btn ghost addobs" data-k="add"></button>`;
      host.appendChild(c);
      renderLength(i);
    }
    requestAnimationFrame(refreshPreview);
  }

  function findObs(li, id){ return draft.obstacles[li].find(o=>o.id===id); }

  // délégation d'événements
  const host = $('#edLengths');
  host.addEventListener('click', e=>{
    const card = e.target.closest('.lencard'); if(!card) return;
    const li = +card.dataset.li;
    const k = e.target.closest('[data-k]'); if(!k) return;
    if(k.dataset.k==='add'){
      const arr = draft.obstacles[li]; if(arr.length>=Store.MAX_OBS_PER_LEN) return;
      const last = arr.length ? Math.max(...arr.map(o=>o.dist + (o.depl||0))) : 5;
      arr.push({id:nextObsId(), type:'cerceau', dist:Math.min(22, arr.length ? last+4 : 10)});
      renderLength(li); touch();
    }else if(k.dataset.k==='del'){
      const id = +k.closest('.obs').dataset.id;
      draft.obstacles[li] = draft.obstacles[li].filter(o=>o.id!==id);
      renderLength(li); touch();
    }
  });
  host.addEventListener('input', e=>{
    const obsEl = e.target.closest('.obs'); if(!obsEl) return;
    const li = +e.target.closest('.lencard').dataset.li;
    const o = findObs(li, +obsEl.dataset.id); if(!o) return;
    const rg = e.target.closest('.range');
    if(rg){
      const key = rg.dataset.key;
      const min = +e.target.min, max = +e.target.max;
      let v = parseInt(e.target.value,10); if(!isFinite(v)) return;
      v = Math.max(min, Math.min(max, v));
      o[key] = v;
      rg.querySelectorAll('input').forEach(x=>{ if(x!==e.target) x.value=v; });
      touch();
    }
  });
  host.addEventListener('change', e=>{
    if(e.target.dataset.k!=='type') return;
    const li = +e.target.closest('.lencard').dataset.li;
    const o = findObs(li, +e.target.closest('.obs').dataset.id); if(!o) return;
    o.type = e.target.value; delete o.depl; delete o.remorque;
    const ex = T[o.type].extra; if(ex) o[ex.key] = ex.def;
    renderLength(li); touch();
  });
  host.addEventListener('focusout', e=>{ // re-trier par placement après saisie
    if(!e.target.closest('.range')) return;
    const li = +e.target.closest('.lencard').dataset.li;
    const before = draft.obstacles[li].map(o=>o.id).join();
    draft.obstacles[li].sort((a,b)=>a.dist-b.dist);
    if(before !== draft.obstacles[li].map(o=>o.id).join()) setTimeout(()=>renderLength(li), 0);
  });

  $('#edName').addEventListener('input', e=>{ draft.name = e.target.value; dirty=true; });
  $$('#edEntree button').forEach(b=>b.addEventListener('click', ()=>{
    if(draft.entree===b.dataset.entree) return;
    draft.entree = b.dataset.entree; touch();
  }));
  $('#edLenPlus').addEventListener('click', ()=>{
    if(draft.n>=Store.MAX_LEN) return;
    draft.n++; draft.obstacles.push([]); renderAll(); touch();
    setTimeout(()=>$(`#edLen${draft.n-1}`)?.scrollIntoView({behavior:'smooth', block:'nearest'}), 50);
  });
  $('#edLenMinus').addEventListener('click', async ()=>{
    if(draft.n<=1) return;
    const lost = draft.obstacles[draft.n-1].length;
    if(lost && !await ask({title:'Retirer la dernière longueur ?', msg:`${Store.lenLabel(draft.n-1)} contient ${lost} obstacle${lost>1?'s':''} qui seront supprimés.`, ok:'Retirer', danger:true})) return;
    draft.n--; draft.obstacles.pop(); renderAll(); touch();
  });

  $('#edSave').addEventListener('click', async ()=>{
    let name = ($('#edName').value||'').trim();
    if(!name){
      name = await ask({title:'Nom du parcours', msg:'Donnez un nom pour le retrouver facilement (ex. « Niveau 2 — 2nde 4 »).', input:true, ok:'Enregistrer'});
      if(!name) return;
      $('#edName').value = name;
    }
    if(Store.nameExists(name, draft.id) && !await ask({title:'Nom déjà utilisé', msg:`Un autre parcours s’appelle déjà « ${name} ». Enregistrer quand même ?`, ok:'Enregistrer'})) return;
    draft.name = name;
    draft.obstacles.forEach(a=>a.sort((x,y)=>x.dist-y.dist));
    const saved = Store.normalize(Store.saveToLibrary(draft));
    dirty=false;
    if(onSave){ const cb=onSave; onSave=null; toast('Parcours enregistré'); cb(saved); return; }
    const switched = await switchCurrent(saved);
    if(switched===false) toast('Parcours enregistré');
    go('library', true);
  });
  $('#edCancel').addEventListener('click', ()=>history.back());

  leaveHooks.editor = async ()=>{
    if(!dirty) return true;
    const ok = await ask({title:'Quitter sans enregistrer ?', msg:'Les modifications de ce parcours seront perdues.', ok:'Quitter', danger:true});
    if(ok) dirty=false;
    return ok;
  };
  enterHooks.editor = ()=>{ if(!draft) open(Store.emptyParcours(4), {isNew:true}); else requestAnimationFrame(refreshPreview); };
  window.addEventListener('resize', ()=>{ if(view==='editor') refreshPreview(); });

  return { open };
})();

/* =========================================================
   VISUALISATION
   ========================================================= */
(function(){
  Sim.attach($('#cvTop'), $('#cvSide'));
  let loadedKey = null;
  const key = ()=>cur.id+'|'+JSON.stringify(cur.obstacles)+'|'+cur.n+'|'+cur.entree;
  const btn = $('#simPlay');
  const STATE_LBL = { ready:'Prêt', running:'En cours', paused:'En pause', done:'Terminé' };

  Sim.on('state', st=>{
    const playing = st.state==='running';
    btn.className = 'btn ' + (playing ? 'orange' : 'green');
    btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg><span>Pause</span>'
      : `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><span>${st.state==='paused'?'Reprendre':(st.state==='done'?'Revoir':'Lancer')}</span>`;
    frame(st);
  });
  function frame(st){
    const lbl = st.state==='done' ? 'Parcours terminé' :
      `${STATE_LBL[st.state]} — ${st.dir} ${st.pair} (longueur ${st.len}/${st.n}) · ${st.meters.toFixed(0)} m`;
    $('#simStatus').textContent = lbl;
    $('#simProgress').style.width = (st.progress*100).toFixed(1)+'%';
    const a = Math.floor((st.len-1)/2)*2+1;
    $('#simPairLbl').textContent = `Aller ${st.pair}${a+1<=st.n ? ' / Retour '+st.pair : ''}`;
  }
  let lastFrame=0;
  Sim.on('frame', st=>{ const n=performance.now(); if(n-lastFrame>120){ lastFrame=n; frame(st); } });

  btn.addEventListener('click', ()=>Sim.toggle());
  $('#simReset').addEventListener('click', ()=>Sim.reset());
  const speeds = $$('#simSpeed button');
  function setSpeed(v){ Sim.setSpeed(v); Store.setSetting('simSpeed', v); speeds.forEach(b=>b.classList.toggle('on', +b.dataset.speed===v)); }
  speeds.forEach(b=>b.addEventListener('click', ()=>setSpeed(+b.dataset.speed)));
  setSpeed(Store.settings().simSpeed||1);

  enterHooks.view = ()=>{
    requestAnimationFrame(()=>{
      if(loadedKey!==key()){ loadedKey=key(); Sim.setActive(true); Sim.load(cur); }
      else Sim.setActive(true);
    });
  };
  leaveHooks.view = ()=>{ Sim.pause(); Sim.setActive(false); return true; };
  document.addEventListener('keydown', e=>{
    if(view!=='view' || e.target.matches('input,select,textarea')) return;
    if(e.code==='Space'){ e.preventDefault(); Sim.toggle(); }
  });
})();

/* =========================================================
   CHRONOMÉTRIE
   ========================================================= */
const ChronoUI = (function(){
  let s = null;           // session
  let timer = null, lastTap = 0, wakeLock = null, ctx = null;
  const clock = $('#chronoClock'), tapBtn = $('#tapBtn');

  /* ---- contexte de leçon (classe, élèves, piliers, parcours du jour) ---- */
  function sameParcours(a, b){ return a && b && a.id===b.id && JSON.stringify(a.obstacles)===JSON.stringify(b.obstacles) && a.n===b.n && a.entree===b.entree; }
  function newSess(p, keep){
    const n = Chrono.newSession(p, {timeObstacles: keep && keep.timeObstacles!=null ? keep.timeObstacles : Store.settings().timeObstacles, student: keep && keep.student});
    if(ctx){
      const k = keep && keep.ctx || {};
      const pilId = k.pil !== undefined ? k.pil : (ctx.piliers[0] ? ctx.piliers[0].id : null);
      n.ctx = { cid:ctx.cid, n:ctx.n, sid:k.sid||null, disp:k.disp||'', oid:k.oid||null, odisp:k.odisp||'', pil: ctx.piliers.some(x=>x.id===pilId) ? pilId : null, prev:k.prev||null };
      n.ob = []; n.obSel = null;
    }
    return n;
  }
  function ensureSession(){
    ctx = Classe.context();
    if(ctx && ctx.parcours.length && !ctx.parcours.some(p=>sameParcours(p, cur))) setCurrent(ctx.parcours[0], true);
    s = s || Store.chronoSession();
    if(s && s.taps.length && !sameParcours(s.parcours, cur)) setCurrent(s.parcours, true);
    if(s){
      const ctxOk = ctx ? (s.ctx && s.ctx.cid===ctx.cid && s.ctx.n===ctx.n) : !s.ctx;
      const parOk = sameParcours(s.parcours, cur);
      if((!ctxOk || !parOk) && !s.taps.length) s = null;
    }
    if(!s) s = newSess(cur, null);
    persist();
  }
  function persist(){ Store.saveChronoSession(s); }
  const pil = ()=> (ctx && s && s.ctx && s.ctx.pil) ? ctx.piliers.find(p=>p.id===s.ctx.pil) : null;

  /* ---- carte « passage » (parcours, pilier observé, nageur, observateur) ---- */
  const stu = (id)=>ctx && ctx.students.find(x=>x.id===id);
  const parName = (pid)=>{ const p=ctx && ctx.parcours.find(x=>x.id===pid); return p ? p.name : ''; };
  /* différenciation : le nageur fait le parcours que l'enseignant lui a attribué */
  function followAsg(){
    const st=stu(s.ctx.sid); if(!st || !st.pid || s.taps.length || st.pid===cur.id) return;
    const p=ctx.parcours.find(x=>x.id===st.pid); if(!p) return;
    setCurrent(p, true);
    s = newSess(cur, {timeObstacles:s.timeObstacles, ctx:Object.assign({}, s.ctx)}); persist();
    toast(`Parcours de ${st.disp} : ${p.name}`);
  }
  function renderPassage(){
    const free = !ctx;
    $('#stFree').hidden = !free;
    $('#stCtx').hidden = free;
    if(free) return;
    const locked = s.taps.length>0;
    const pars = ctx.parcours.length ? ctx.parcours : [cur];
    const sw = stu(s.ctx.sid), vref = sw && sw.vref;
    $('#stCtx').innerHTML = `
      ${ctx.test ? `<div class="test-banner">⏱️ <b>Test de vitesse de nage de sauveteur</b> · ${ctx.tdist} m sans obstacle</div>` : ''}
      <button type="button" class="par-btn" id="ctxPar" ${locked||pars.length<2?'disabled':''}>
        <canvas class="schema"></canvas>
        <span class="par-info"><span class="field-lbl">Parcours</span><b>${esc(cur.name)}</b>
          <span class="muted small">${cur.n*25} m · ${esc(Store.ENTREES[Store.validEntree(cur.entree)].label)}${pars.length>1 && !locked ? ' · toucher pour changer' : ''}</span></span></button>
      <div class="duo">
        <button class="swimmer-btn ${s.ctx.sid?'':'empty'}" id="ctxSwimmer" type="button" ${locked?'disabled':''}>
          <span class="field-lbl">🏊 Nageur</span><b>${s.ctx.sid ? esc(s.ctx.disp) : 'Choisir…'}</b>
          <span class="muted small">${vref ? `Vitesse de sauveteur : ${Classe.fmtSpeed(vref)}` : (ctx.test ? 'Test : sa vitesse sera mesurée' : 'Pas encore de vitesse de sauveteur')}</span></button>
        <button class="swimmer-btn obs ${s.ctx.oid?'':'empty'}" id="ctxObserver" type="button">
          <span class="field-lbl">👀 Observateur</span><b>${s.ctx.oid ? esc(s.ctx.odisp) : 'Choisir…'}</b>
          <span class="muted small">Il observe et coche les critères</span></button>
      </div>
      ${ctx.piliers.length ? `<label class="field pil-sel"><span class="field-lbl">Pilier observé</span>
          <select id="ctxPil">${ctx.piliers.map(p=>`<option value="${esc(p.id)}" ${s.ctx.pil===p.id?'selected':''}>${esc(p.n)}</option>`).join('')}<option value="" ${!s.ctx.pil?'selected':''}>Pas d’observation</option></select></label>` : ''}`;
    requestAnimationFrame(()=>{ const cv=$('#ctxPar canvas'); if(cv) Schema.render(cv, cur, {compact:true}); });
    $('#ctxPar').onclick = ()=>pickParcours(pars);
    if($('#ctxPil')) $('#ctxPil').onchange = e=>{ s.ctx.pil = e.target.value || null; s.ob=[]; s.obSel=null; s.saved=false; persist(); render(); };
    $('#ctxSwimmer').onclick = ()=>pickStudent('sid');
    $('#ctxObserver').onclick = ()=>pickStudent('oid');
  }
  function pickParcours(pars){
    if(s.taps.length) return;
    const ov = document.createElement('div'); ov.className='overlay';
    ov.innerHTML = `<div class="overlay-box wide"><div class="overlay-head"><h3>Quel parcours ?</h3><button class="iconbtn" data-x aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="par-grid">${pars.map(p=>`<button type="button" class="par-card ${p.id===cur.id?'on':''}" data-pid="${esc(p.id)}"><canvas class="schema"></canvas>
        <b>${esc(p.name)}</b><span class="muted small">${p.n*25} m · ${esc(Store.ENTREES[Store.validEntree(p.entree)].label)} · ${esc(Store.summary(p).replace(/^[^·]*· ?/,''))}</span>
        ${(()=>{ const who=ctx.students.filter(x=>x.pid===p.id).map(x=>x.disp); return who.length ? `<span class="par-who">👥 ${esc(who.join(', '))}</span>` : ''; })()}</button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.querySelectorAll('.par-card').forEach((b,i)=>Schema.render(b.querySelector('canvas'), pars[i], {compact:true})));
    ov.addEventListener('click', e=>{
      if(e.target===ov || e.target.closest('[data-x]')){ ov.remove(); return; }
      const b=e.target.closest('[data-pid]'); if(!b) return;
      const p=pars.find(x=>x.id===b.dataset.pid); ov.remove();
      if(p && p.id!==cur.id){ setCurrent(p, true); s = newSess(cur, s); persist(); render(); }
    });
  }
  function pickStudent(kind){
    const isSw = kind==='sid';
    if(isSw && s.taps.length) return;
    const other = isSw ? s.ctx.oid : s.ctx.sid;
    const prev = s.ctx.prev;   // binôme du passage précédent : proposer d'inverser les rôles
    const swap = isSw && prev && prev.oid && prev.sid && stu(prev.oid) && !stu(prev.oid).att;
    const ov = document.createElement('div'); ov.className='overlay';
    ov.innerHTML = `<div class="overlay-box"><div class="overlay-head"><h3>${isSw?'🏊 Qui nage ?':'👀 Qui observe ?'}</h3><button class="iconbtn" data-x aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      ${swap ? `<div class="swap-row"><button type="button" class="btn orange lg" data-swap>↔ On inverse : ${esc(stu(prev.oid).disp)} nage, ${esc(stu(prev.sid).disp)} observe</button></div>` : ''}
      <div class="pick-grid">${ctx.students.map(st=>{
        const off = st.att==='abs' || (isSw && st.att==='inap') || st.id===other;
        return `<button type="button" class="pick ${st.att?'att-'+st.att:''} ${s.ctx[kind]===st.id?'on':''}" data-sid="${esc(st.id)}" ${off?'disabled':''}>
          ${esc(st.disp)}${st.att?`<small>${st.att==='abs'?'Absent':'Inapte'}</small>`:(st.id===other?`<small>${isSw?'observe':'nage'}</small>`:(isSw && st.pid?`<small class="pick-par">🗺️ ${esc(parName(st.pid))}</small>`:''))}</button>`; }).join('')}</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e=>{
      if(e.target===ov || e.target.closest('[data-x]')){ ov.remove(); return; }
      if(e.target.closest('[data-swap]')){
        const a=stu(prev.oid), b=stu(prev.sid);
        Object.assign(s.ctx, {sid:a.id, disp:a.disp, oid:b.id, odisp:b.disp}); s.saved=false; persist(); ov.remove(); followAsg(); render(); return;
      }
      const b = e.target.closest('[data-sid]'); if(!b) return;
      const st = stu(b.dataset.sid);
      if(isSw){ s.ctx.sid = st.id; s.ctx.disp = st.disp; } else { s.ctx.oid = st.id; s.ctx.odisp = st.disp; }
      s.saved=false; persist(); ov.remove(); if(isSw) followAsg(); render();
      if(isSw && !s.ctx.oid) setTimeout(()=>pickStudent('oid'), 150);
    });
  }

  /* ---- observation : 3 critères du pilier, oui / non, une fois par aller-retour ---- */
  function curLen(c){ return c.next ? (c.next.kind==='start' ? 0 : c.next.li) : s.parcours.n-1; }
  const nP = ()=>Classe.nPairs(s.parcours.n);
  function pairLabel(k){ const n=s.parcours.n; return 2*k+1 < n ? `Aller-retour ${k+1}` : `Aller ${k+1}`; }
  function renderObs(c){
    const card = $('#obsCard');
    const P = pil();
    card.hidden = !P;
    if(!P) return;
    const auto = Math.floor(curLen(c)/2);
    if(s.obAuto!==auto){ s.obAuto=auto; s.obSel=null; }
    const li = s.obSel!=null ? s.obSel : auto;
    const filled = (i)=>[0,1,2].filter(k=>(s.ob[i]||[])[k]===1||(s.ob[i]||[])[k]===0).length;
    card.innerHTML = `<div class="obs-top"><div><div class="eyebrow">👀 Observation · une fois par aller-retour${s.ctx.odisp?` · par ${esc(s.ctx.odisp)}`:''}</div><b>${esc(P.n)}</b></div></div>
      <div class="obs-tabs">${Array.from({length:nP()},(_,i)=>`<button type="button" class="${i===li?'on':''} ${filled(i)===3?'full':''}" data-li="${i}">${esc(pairLabel(i))}${filled(i)?` <small>${filled(i)}/3</small>`:''}</button>`).join('')}</div>
      ${P.cr.map((x,k)=>{ const v=(s.ob[li]||[])[k];
        return `<div class="ob-row"><div class="ob-txt"><b>${esc(x.t)}</b><span>${esc(x.o)}</span></div>
          <div class="ob-btns"><button type="button" class="yes ${v===1?'on':''}" data-k="${k}" data-v="1">Oui</button><button type="button" class="no ${v===0?'on':''}" data-k="${k}" data-v="0">Non</button></div></div>`; }).join('')}`;
    card.onclick = e=>{
      const t = e.target.closest('[data-li]');
      if(t){ s.obSel = +t.dataset.li; persist(); renderObs(Chrono.compute(s)); return; }
      const b = e.target.closest('[data-v]'); if(!b) return;
      const k=+b.dataset.k, v=+b.dataset.v;
      s.ob[li] = s.ob[li] || [null,null,null];
      s.ob[li][k] = s.ob[li][k]===v ? null : v;
      s.saved=false; vibrate(15); persist(); renderObs(Chrono.compute(s)); renderFinish(Chrono.compute(s));
    };
  }

  function renderFinish(c){
    $('#finishCard').hidden = !c.finished;
    if(!c.finished) return;
    $('#finishTime').textContent = Chrono.fmt(c.total) + (s.faults ? `  ·  ${s.faults} faute${s.faults>1?'s':''}` : '');
    const sp = $('#finishSpeed');
    if(ctx){
      const w = swim(c), sw = stu(s.ctx.sid), vref = sw && sw.vref;
      let h = '';
      if(w.v){
        if(ctx.test) h = `⏱️ Vitesse de nage de sauveteur : <b>${Classe.fmtSpeed(w.v)}</b>${vref && Math.abs(vref-w.v)>0.005 ? ` <span class="muted">(meilleure : ${Classe.fmtSpeed(Math.max(vref,w.v))})</span>`:''}`;
        else if(vref){ const e = w.v/vref-1; const ok = Math.abs(e)<=0.10;
          h = `🏊 Nage seule : <b>${Classe.fmtSpeed(w.v)}</b> · vitesse de sauveteur ${Classe.fmtSpeed(vref)} · <span class="spd ${ok?'ok':'ko'}">${e>=0?'+':''}${Math.round(e*100)} %${ok?' · vitesse stable 👍':''}</span>`; }
        else h = `🏊 Nage seule : <b>${Classe.fmtSpeed(w.v)}</b> <span class="muted">(pas encore de test de vitesse)</span>`;
      }
      sp.innerHTML = h; sp.hidden = !h;
    } else sp.hidden = true;
    const b = $('#btnSaveResult');
    b.disabled = !!s.saved;
    b.innerHTML = s.saved ? '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>Passage enregistré' : '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>Enregistrer le passage';
    $('#btnNextStudent').textContent = ctx ? 'Nageur suivant →' : 'Élève suivant →';
    $('#btnResultPng').hidden = !!ctx;
  }

  function render(){
    if(!s) return;
    const c = Chrono.compute(s);
    renderPassage();
    clock.textContent = Chrono.fmt(c.elapsed);
    clock.classList.toggle('idle', !c.started);
    clock.classList.toggle('done', c.finished);
    tapBtn.className = 'tapbtn' + (c.next ? ' k-'+c.next.kind : '');
    tapBtn.disabled = c.finished;
    $('#tapLabel').textContent = c.next ? c.next.label : 'Terminé';
    $('#tapSub').textContent = c.next ? c.next.sub : `Temps final ${Chrono.fmt(c.total)}`;
    $('#faultCount').textContent = s.faults;
    $('#faultMinus').disabled = s.faults<=0;
    $('#tapUndo').disabled = !s.taps.length;
    $('#chronoReset').disabled = !s.taps.length && !s.faults;
    $('#optTimeObs').checked = s.timeObstacles;
    $('#optTimeObs').disabled = !!s.taps.length;
    renderFinish(c);
    renderObs(c);
    $('#kLen').textContent = c.lenTotal ? Chrono.fmt(c.lenTotal) : '—';
    $('#kObs').textContent = s.timeObstacles ? (c.obsTotal ? Chrono.fmt(c.obsTotal) : '—') : 'non chrono.';
    $('#kSwim').textContent = (s.timeObstacles && c.lenTotal) ? Chrono.fmt(c.swimTotal) : '—';
    let doneUpTo = -1; c.lengths.forEach((l,i)=>{ if(l.dur!=null) doneUpTo=i; });
    const hl = c.next ? { li: c.next.kind==='start' ? 0 : c.next.li, obsId: c.next.obsId ?? null } : null;
    Schema.render($('#chronoSchema'), s.parcours, {theme:'light', highlight:hl, doneUpTo});
    renderTimeline(c);
    const running = c.started && !c.finished;
    if(running && !timer) timer = setInterval(tick, 100);
    if(!running && timer){ clearInterval(timer); timer=null; }
  }
  function tick(){ if(s) clock.textContent = Chrono.fmt(Chrono.elapsed(s)); }

  function renderTimeline(c){
    const ol = $('#timeline');
    const t = s.taps;
    let html = '';
    c.steps.forEach((st,k)=>{
      const cls = k < t.length ? 'done' : (k===t.length ? 'now' : '');
      let dur = '';
      if(st.kind==='obsEnd' && k<t.length){ const x=c.obstacles.find(x=>x.li===st.li && x.o.id===st.obsId); if(x && x.dur!=null) dur=`durée ${Chrono.fmt(x.dur)}`; }
      if((st.kind==='turn'||st.kind==='finish') && k<t.length){ const l=c.lengths[st.li]; if(l.dur!=null) dur=`${Store.lenLabel(st.li)} : ${Chrono.fmt(l.dur)}`; }
      const isLen = st.kind==='start'||st.kind==='turn'||st.kind==='finish';
      html += `<li class="${cls}${isLen?' len':''}" ${cls==='now'?'id="tlNow"':''}><i></i>
        <div>${esc(st.label)} <span class="d">· ${esc(st.sub)}</span>${dur?`<div class="d">${dur}</div>`:''}</div>
        <span class="t">${k<t.length ? Chrono.fmt(t[k]) : ''}</span></li>`;
    });
    ol.innerHTML = html;
    const now = $('#tlNow'); if(now){ const r=now.offsetTop - ol.offsetTop - 60; ol.scrollTop = Math.max(0, r); }
  }

  function doTap(){
    if(!s) return;
    if(ctx && !s.ctx.sid && !s.taps.length){ toast('Choisissez d’abord le nageur', true); pickStudent('sid'); return; }
    const now = Date.now();
    if(now - lastTap < 350) return; // anti double-tap
    lastTap = now;
    if(Chrono.tap(s, now)){
      vibrate(30);
      tapBtn.classList.add('pressed'); setTimeout(()=>tapBtn.classList.remove('pressed'), 90);
      persist(); render();
      if(Chrono.compute(s).finished){ vibrate([60,60,120]); }
    }
  }
  tapBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); doTap(); });
  tapBtn.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); } });

  $('#tapUndo').addEventListener('click', ()=>{ if(Chrono.undo(s)){ persist(); render(); toast('Dernier enregistrement annulé'); } });
  $('#faultPlus').addEventListener('click', ()=>{ s.faults++; s.saved=false; vibrate([20,40,20]); persist(); render(); });
  $('#faultMinus').addEventListener('click', ()=>{ s.faults=Math.max(0,s.faults-1); s.saved=false; persist(); render(); });
  $('#chronoReset').addEventListener('click', async ()=>{
    if(s.taps.length && !s.saved && !await ask({title:'Réinitialiser le chrono ?', msg:'Les temps et les observations de ce passage seront effacés.', ok:'Réinitialiser', danger:true})) return;
    s = newSess(cur, s); persist(); render();
  });
  $('#optTimeObs').addEventListener('change', e=>{
    if(s.taps.length) return;
    s.timeObstacles = e.target.checked; Store.setSetting('timeObstacles', s.timeObstacles); persist(); render();
  });

  // élève (mode libre, sans classe)
  const bind = (id, k)=>$(id).addEventListener('input', e=>{ s.student[k]=e.target.value; s.saved=false; persist(); });
  bind('#stNom','nom'); bind('#stPrenom','prenom'); bind('#stClasse','classe');
  function fillStudent(){
    $('#stNom').value = s.student.nom||''; $('#stPrenom').value = s.student.prenom||''; $('#stClasse').value = s.student.classe||'';
    const classes = [...new Set(Store.results().map(r=>r.classe).filter(Boolean))].sort();
    $('#classesList').innerHTML = classes.map(c=>`<option value="${esc(c)}">`).join('');
  }

  function swim(c){
    if(ctx && ctx.test) return { sd:s.parcours.n*25, swt:c.total, v: c.total ? s.parcours.n*25/(c.total/1000) : null };
    return Classe.swimOf(s.parcours, c.lengths.map(l=>l.dur), c.obstacles.map(x=>({li:x.li, type:x.o.type, dist:x.o.dist, depl:x.o.depl, remorque:x.o.remorque, dur:x.dur})), s.timeObstacles);
  }
  function classResult(){
    const base = Chrono.toResult(s), c = Chrono.compute(s), w = swim(c);
    return { id: Classe.deviceId()+'-'+Date.now().toString(36), ts: base.ts, d: Classe.deviceId(), cid: s.ctx.cid, n: s.ctx.n,
      sid: s.ctx.sid, oid: s.ctx.oid || null, test: !!(ctx && ctx.test),
      pid: s.parcours.id, pname: s.parcours.name, entree: Store.validEntree(s.parcours.entree), nL: s.parcours.n,
      total: base.total, faults: base.faults, lens: base.lengths, obs: base.obstacles.map(o=>o.dur), pil: s.ctx.pil || null,
      sd: w.sd, swt: w.swt,
      ob: Array.from({length:nP()}, (_,i)=>(s.ob[i]||[null,null,null]).slice(0,3)) };
  }
  async function saveResult(){
    if(s.saved) return true;
    if(ctx){
      if(!s.ctx.sid){ toast('Choisissez le nageur', true); pickStudent('sid'); return false; }
      if(!s.ctx.oid && !await ask({title:'Sans observateur ?', msg:'Aucun observateur n’est indiqué pour ce passage. Enregistrer quand même ?', ok:'Enregistrer', cancel:'Choisir'})){ pickStudent('oid'); return false; }
      const P = pil();
      if(P){
        const missing = Array.from({length:nP()},(_,i)=>i).filter(i=>[0,1,2].some(k=>(s.ob[i]||[])[k]==null));
        if(missing.length && !await ask({title:'Observation incomplète', msg:`Critères non renseignés pour : ${missing.map(pairLabel).join(', ')}.\nEnregistrer quand même ?`, ok:'Enregistrer', cancel:'Compléter'})) return false;
      }
      Classe.addResult(classResult());
      s.saved = true; persist(); render();
      toast(`Passage de ${s.ctx.disp} enregistré${s.ctx.odisp?` · observé par ${s.ctx.odisp}`:''}`);
      return true;
    }
    if(!(s.student.nom||'').trim() && !(s.student.prenom||'').trim()){
      const name = await ask({title:'Nom de l’élève', msg:'Saisissez le NOM et le prénom (ou laissez vide pour enregistrer sans nom).', input:true, ok:'Enregistrer'});
      if(name===null) return false;
      const parts = name.trim().split(/\s+/);
      s.student.nom = parts.shift()||''; s.student.prenom = parts.join(' ');
      fillStudent();
    }
    Store.addResult(Chrono.toResult(s));
    s.saved = true; persist(); render();
    toast('Passage enregistré dans Passages libres');
    return true;
  }
  $('#btnSaveResult').addEventListener('click', saveResult);
  $('#btnResultPng').addEventListener('click', ()=>Exporter.resultPng(Chrono.toResult(s)));
  $('#btnNextStudent').addEventListener('click', async ()=>{
    if(!s.saved){
      const ok = await ask({title:'Passage non enregistré', msg:'Enregistrer ce passage avant de passer au suivant ?', ok:'Enregistrer', cancel:'Ne pas enregistrer'});
      if(ok && !await saveResult()) return;
    }
    if(ctx){
      s = newSess(cur, {timeObstacles:s.timeObstacles, ctx:{pil:s.ctx.pil, prev:{sid:s.ctx.sid, oid:s.ctx.oid}}});
      persist(); render(); pickStudent('sid');
    }else{
      s = Chrono.newSession(cur, {timeObstacles:s.timeObstacles, student:{classe:s.student.classe}});
      persist(); fillStudent(); render();
      $('#stNom').focus();
    }
  });

  // clavier / télécommande de présentation
  document.addEventListener('keydown', e=>{
    if(view!=='chrono' || e.target.matches('input,select,textarea') || $('#dlg').open || document.querySelector('.overlay')) return;
    if(['Space','Enter','NumpadEnter','PageDown','ArrowRight','ArrowDown'].includes(e.code)){ e.preventDefault(); doTap(); }
    else if(['PageUp','ArrowLeft','Backspace'].includes(e.code)){ e.preventDefault(); $('#tapUndo').click(); }
    else if(e.key==='f' || e.key==='F'){ $('#faultPlus').click(); }
  });

  async function lockScreen(){
    try{ if('wakeLock' in navigator && !wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', ()=>{ wakeLock=null; }); } }catch(e){}
  }
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && view==='chrono') lockScreen(); });

  enterHooks.chrono = ()=>{ ensureSession(); fillStudent(); requestAnimationFrame(render); lockScreen();
    if(ctx && !s.ctx.sid && !s.taps.length) setTimeout(()=>pickStudent('sid'), 250); };
  leaveHooks.chrono = ()=>{ if(timer){ clearInterval(timer); timer=null; } try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock=null; document.querySelectorAll('.overlay').forEach(o=>o.remove()); return true; };
  window.addEventListener('resize', ()=>{ if(view==='chrono') render(); });

  return { drop(){ s=null; } };
})();

/* =========================================================
   RÉSULTATS
   ========================================================= */
(function(){
  function filtered(){
    const q = ($('#resFilter').value||'').trim().toLowerCase();
    const all = Store.results();
    return q ? all.filter(r=>`${r.nom} ${r.prenom} ${r.classe} ${r.parcours.name}`.toLowerCase().includes(q)) : all;
  }
  function render(){
    const list = filtered();
    const host = $('#resList');
    if(!list.length){
      host.innerHTML = `<div class="empty">${Store.results().length ? 'Aucun résultat pour ce filtre.' : 'Aucun passage enregistré.<br>Chronométrez un élève puis « Enregistrer le passage ».'}</div>`;
      return;
    }
    const groups = {};
    list.forEach(r=>{ (groups[r.classe||'Sans classe'] = groups[r.classe||'Sans classe'] || []).push(r); });
    host.innerHTML = Object.keys(groups).sort().map(g=>`<div class="res-group">${esc(g)} · ${groups[g].length}</div>` + groups[g].map(r=>`
      <div class="res" data-id="${r.id}">
        <div class="res-who"><b>${esc(r.nom)} ${esc(r.prenom)}</b>
          <div>${esc(r.parcours.name)} · ${new Date(r.ts).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}${r.swim!=null?` · nage ${Chrono.fmt(r.swim)}`:''}</div></div>
        <div class="res-time">${Chrono.fmt(r.total)}</div>
        <div class="res-f ${r.faults?'':'zero'}">${r.faults} faute${r.faults>1?'s':''}</div>
        <div class="res-act">
          <button class="btn ghost" data-a="png" title="Fiche PNG">PNG</button>
          <button class="btn ghost danger" data-a="del" title="Supprimer">Suppr.</button>
        </div>
      </div>`).join('')).join('');
  }
  $('#resList').addEventListener('click', async e=>{
    const b = e.target.closest('[data-a]'); if(!b) return;
    const id = b.closest('.res').dataset.id;
    const r = Store.results().find(x=>x.id===id); if(!r) return;
    if(b.dataset.a==='png') Exporter.resultPng(r);
    if(b.dataset.a==='del' && await ask({title:'Supprimer ce passage ?', msg:`${r.nom} ${r.prenom} — ${Chrono.fmt(r.total)}`, ok:'Supprimer', danger:true})){ Store.deleteResult(id); render(); }
  });
  $('#resFilter').addEventListener('input', render);
  $('#resCsv').addEventListener('click', ()=>{
    const list = filtered(); if(!list.length){ toast('Aucun résultat à exporter', true); return; }
    Exporter.resultsCsv(list);
  });
  $('#resClear').addEventListener('click', async ()=>{
    if(!Store.results().length) return;
    if(await ask({title:'Effacer tous les résultats ?', msg:'Exportez d’abord le CSV si vous voulez les conserver. Cette action est définitive.', ok:'Tout effacer', danger:true})){ Store.clearResults(); render(); }
  });
  enterHooks.results = render;
})();

/* ---------- Démarrage (appelé par modes.js une fois les écrans enregistrés) ---------- */
function start(){
  updateChrome();
  const st = (location.hash.match(/^#\/(\w+)/)||[])[1];
  history.replaceState(null,'','#/home');
  show('home');
  if(st && st!=='home' && st!=='editor' && TITLES[st]) go(st);
}
Object.assign(App, { $, $$, esc, toast, ask, go, show, TITLES, enterHooks, leaveHooks, actions, Editor, ChronoUI,
  setCurrent, switchCurrent, cur:()=>cur, view:()=>view, renderLibrary, start, pairColor });

})();
