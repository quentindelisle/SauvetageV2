/* =========================================================
   App — navigation et interfaces
   ========================================================= */
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
const TITLES = { home:'Sauvetage CA2', library:'Mes parcours', editor:'Éditeur', view:'Visualisation', chrono:'Chronométrie', results:'Résultats' };
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
  if(view===name) return;
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
$('#chipCurrent').addEventListener('click', ()=>go('library'));
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
enterHooks.home = ()=>{
  $('#homeCurName').textContent = cur.name;
  $('#homeCurSummary').textContent = `${cur.n} longueurs (${cur.n*25} m) · ${Store.summary(cur)}`;
  requestAnimationFrame(()=>Schema.render($('#homeSchema'), cur, {theme:'dark'}));
  const L = Store.library();
  $('#tileLibCount').textContent = `${L.user.length} enregistré${L.user.length>1?'s':''} · ${L.builtins.length} modèles`;
  const nr = Store.results().length;
  $('#tileResCount').textContent = nr ? `${nr} passage${nr>1?'s':''} enregistré${nr>1?'s':''}` : 'Aucun passage pour l’instant';
};

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
    $$('.pcard').forEach((el,i)=>{
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
  let draft=null, dirty=false, isNew=false;
  const T = Store.TYPES;

  function open(p, opts={}){
    draft = Store.clone(p); isNew = !!opts.isNew; dirty = !!opts.isNew && Store.countObstacles(draft)>0;
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
    Schema.render($('#edSchema'), draft, {theme:'dark'});
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
    const switched = await switchCurrent(saved);
    if(switched===false) toast('Parcours enregistré');
    go('home', true);
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
  let timer = null, lastTap = 0, wakeLock = null;
  const clock = $('#chronoClock'), tapBtn = $('#tapBtn');

  function ensureSession(){
    s = s || Store.chronoSession();
    if(s && s.parcours && (s.parcours.id!==cur.id || JSON.stringify(s.parcours.obstacles)!==JSON.stringify(cur.obstacles) || s.parcours.n!==cur.n)){
      if(!s.taps.length){ s = null; } // parcours changé sans passage commencé
    }
    if(!s) s = Chrono.newSession(cur, {timeObstacles: Store.settings().timeObstacles});
    persist();
  }
  function persist(){ Store.saveChronoSession(s); }

  function render(){
    if(!s) return;
    const c = Chrono.compute(s);
    // horloge
    clock.textContent = Chrono.fmt(c.elapsed);
    clock.classList.toggle('idle', !c.started);
    clock.classList.toggle('done', c.finished);
    // bouton principal
    tapBtn.className = 'tapbtn' + (c.next ? ' k-'+c.next.kind : '');
    tapBtn.disabled = c.finished;
    $('#tapLabel').textContent = c.next ? c.next.label : 'Terminé';
    $('#tapSub').textContent = c.next ? c.next.sub : `Temps final ${Chrono.fmt(c.total)}`;
    // outils
    $('#faultCount').textContent = s.faults;
    $('#faultMinus').disabled = s.faults<=0;
    $('#tapUndo').disabled = !s.taps.length;
    $('#chronoReset').disabled = !s.taps.length && !s.faults;
    $('#optTimeObs').checked = s.timeObstacles;
    $('#optTimeObs').disabled = !!s.taps.length;
    // fin
    $('#finishCard').hidden = !c.finished;
    if(c.finished){
      $('#finishTime').textContent = Chrono.fmt(c.total) + (s.faults ? `  ·  ${s.faults} faute${s.faults>1?'s':''}` : '');
      const b = $('#btnSaveResult');
      b.disabled = !!s.saved;
      b.innerHTML = s.saved ? '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>Passage enregistré' : '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>Enregistrer le passage';
    }
    // indicateurs
    $('#kLen').textContent = c.lenTotal ? Chrono.fmt(c.lenTotal) : '—';
    $('#kObs').textContent = s.timeObstacles ? (c.obsTotal ? Chrono.fmt(c.obsTotal) : '—') : 'non chrono.';
    $('#kSwim').textContent = (s.timeObstacles && c.lenTotal) ? Chrono.fmt(c.swimTotal) : '—';
    // schéma
    let doneUpTo = -1; c.lengths.forEach((l,i)=>{ if(l.dur!=null) doneUpTo=i; });
    const hl = c.next ? { li: c.next.kind==='start' ? 0 : c.next.li, obsId: c.next.obsId ?? null } : null;
    Schema.render($('#chronoSchema'), s.parcours, {theme:'dark', highlight:hl, doneUpTo});
    renderTimeline(c);
    // horloge vivante
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
    if(s.taps.length && !s.saved && !await ask({title:'Réinitialiser le chrono ?', msg:'Les temps de ce passage seront effacés.', ok:'Réinitialiser', danger:true})) return;
    s = Chrono.newSession(cur, {timeObstacles:s.timeObstacles, student:s.student}); persist(); render();
  });
  $('#optTimeObs').addEventListener('change', e=>{
    if(s.taps.length) return;
    s.timeObstacles = e.target.checked; Store.setSetting('timeObstacles', s.timeObstacles); persist(); render();
  });

  // élève
  const bind = (id, k)=>$(id).addEventListener('input', e=>{ s.student[k]=e.target.value; s.saved=false; persist(); });
  bind('#stNom','nom'); bind('#stPrenom','prenom'); bind('#stClasse','classe');
  function fillStudent(){
    $('#stNom').value = s.student.nom||''; $('#stPrenom').value = s.student.prenom||''; $('#stClasse').value = s.student.classe||'';
    const classes = [...new Set(Store.results().map(r=>r.classe).filter(Boolean))].sort();
    $('#classesList').innerHTML = classes.map(c=>`<option value="${esc(c)}">`).join('');
  }

  async function saveResult(){
    if(s.saved) return true;
    if(!(s.student.nom||'').trim() && !(s.student.prenom||'').trim()){
      const name = await ask({title:'Nom de l’élève', msg:'Saisissez le NOM et le prénom (ou laissez vide pour enregistrer sans nom).', input:true, ok:'Enregistrer'});
      if(name===null) return false;
      const parts = name.trim().split(/\s+/);
      s.student.nom = parts.shift()||''; s.student.prenom = parts.join(' ');
      fillStudent();
    }
    Store.addResult(Chrono.toResult(s));
    s.saved = true; persist(); render();
    toast('Passage enregistré dans Résultats');
    return true;
  }
  $('#btnSaveResult').addEventListener('click', saveResult);
  $('#btnResultPng').addEventListener('click', ()=>Exporter.resultPng(Chrono.toResult(s)));
  $('#btnNextStudent').addEventListener('click', async ()=>{
    if(!s.saved){
      const ok = await ask({title:'Passage non enregistré', msg:'Enregistrer ce passage avant de passer à l’élève suivant ?', ok:'Enregistrer', cancel:'Ne pas enregistrer'});
      if(ok && !await saveResult()) return;
    }
    s = Chrono.newSession(cur, {timeObstacles:s.timeObstacles, student:{classe:s.student.classe}});
    persist(); fillStudent(); render();
    $('#stNom').focus();
  });

  // clavier / télécommande de présentation
  document.addEventListener('keydown', e=>{
    if(view!=='chrono' || e.target.matches('input,select,textarea') || $('#dlg').open) return;
    if(['Space','Enter','NumpadEnter','PageDown','ArrowRight','ArrowDown'].includes(e.code)){ e.preventDefault(); doTap(); }
    else if(['PageUp','ArrowLeft','Backspace'].includes(e.code)){ e.preventDefault(); $('#tapUndo').click(); }
    else if(e.key==='f' || e.key==='F'){ $('#faultPlus').click(); }
  });

  async function lockScreen(){
    try{ if('wakeLock' in navigator && !wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', ()=>{ wakeLock=null; }); } }catch(e){}
  }
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && view==='chrono') lockScreen(); });

  enterHooks.chrono = ()=>{ ensureSession(); fillStudent(); requestAnimationFrame(render); lockScreen(); };
  leaveHooks.chrono = ()=>{ if(timer){ clearInterval(timer); timer=null; } try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock=null; return true; };
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

/* ---------- Démarrage ---------- */
updateChrome();
const start = (location.hash.match(/^#\/(\w+)/)||[])[1];
history.replaceState(null,'','#/home');
show('home');
if(start && start!=='home' && start!=='editor' && TITLES[start]) go(start);

})();
