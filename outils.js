/* =====================================================================
   Outils de séance — moteur N'EPS (Fabrique N'EPS)
   Minuteur, chronomètre à tours, intervalles, rotation d'ateliers,
   tirage au sort, équipes, tableau de score, compteur de tours.
   Les outils continuent de tourner quand on revient aux saisies.
   ===================================================================== */
'use strict';

/* ---------- Son et écran ---------- */
let AC = null;
function beep(f=880, d=0.15, v=1){
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); } catch(e){}
}
const beepShort = () => beep(880, 0.12);
const beepGo = () => { beep(1175, 0.5); };
const beepEnd = () => { beep(660, 0.25); setTimeout(() => beep(660, 0.25), 300); setTimeout(() => beep(990, 0.7), 600); if (navigator.vibrate) navigator.vibrate([200, 100, 400]); };
let wakeLock = null;
async function keepAwake(on){ try { if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch(e){} }
const mmss = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
const mmssc = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return `${m ? m + ':' : ''}${(m ? String(Math.floor(r)).padStart(2, '0') : Math.floor(r))},${String(Math.floor((r % 1) * 100)).padStart(2, '0')}`; };
const nowS = () => performance.now() / 1000;
const setTxt = (id, t) => { const e = document.getElementById(id); if (e && e.textContent !== t) e.textContent = t; };

/* ---------- État des outils (en mémoire) ---------- */
const TCFG = k => TOOLS_ON[k] || {};
const TS = {
  timer:{ dur:60, endAt:0, left:60, run:false, last:null },
  chrono:{ run:false, t0:0, acc:0, laps:[] },
  interval:{ work:+TCFG('interval').work || 30, rest:+TCFG('interval').rest ?? 15, rounds:+TCFG('interval').rounds || 8, phase:'idle', round:0, endAt:0, left:0, run:false, last:null },
  rotation:{ rot:0, phase:'idle', endAt:0, left:0, run:false, last:null },
  tirage:{ drawn:[], cur:null, noRep:true, g:null, anim:false },
  equipes:{ n:+TCFG('equipes').n || 4, mode:'hasard', f:'', teams:null },
  score:{ a:0, b:0, run:false, t0:0, acc:0 },
  tours:{ run:false, t0:0, laps:{}, g:null },
};
if (TS.interval.rest !== TS.interval.rest) TS.interval.rest = 15;
const rotAteliers = () => String(TCFG('rotation').ateliers || 'Atelier 1\nAtelier 2\nAtelier 3').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const elTools = () => Object.keys(TOOL_DEFS).filter(k => TOOLS_ON[k] && TOOLS_ON[k].el);
const myTools = () => Object.keys(TOOL_DEFS).filter(k => TOOLS_ON[k] && (isProf() || TOOLS_ON[k].el));
function viewTools(){
  const L = myTools();
  return `<div class="tools-grid">${L.map(k => { const T = TOOL_DEFS[k], st = toolStatus(k);
    return `<button class="tool-btn" data-action="tool" data-t="${k}"><span class="ico">${T.ico}</span><b>${T.n}</b>${st ? `<span class="tool-st">${st}</span>` : ''}</button>`; }).join('')}</div>`;
}
function toolStatus(k){ const s = TS[k];
  if (k === 'timer' && s.run) return '⏳ ' + mmss(s.left); if (k === 'chrono' && s.run) return '⏱ en cours';
  if (k === 'interval' && s.run) return (s.phase === 'work' ? '💪 ' : '😮‍💨 ') + mmss(s.left); if (k === 'rotation' && s.run) return '🔄 ' + mmss(s.left);
  if (k === 'score' && (s.a || s.b)) return `${s.a} – ${s.b}`; if (k === 'tours' && s.run) return '🏃 en cours'; return ''; }

/* ---------- Horloge commune ---------- */
setInterval(() => {
  const t = nowS();
  /* minuteur */
  const T = TS.timer; if (T.run) { T.left = T.endAt - t; const c = Math.ceil(T.left);
    if (c !== T.last) { if (c <= 3 && c > 0) beepShort(); T.last = c; }
    if (T.left <= 0) { T.run = false; T.left = 0; beepEnd(); keepAwake(false); if (UI.view === 'tool' && UI.tool === 'timer') rerender(); } }
  /* intervalles */
  const I = TS.interval; if (I.run) { I.left = I.endAt - t; const c = Math.ceil(I.left);
    if (c !== I.last) { if (c <= 3 && c > 0) beepShort(); I.last = c; }
    if (I.left <= 0) intervalNext(t); }
  /* rotation */
  const R = TS.rotation; if (R.run) { R.left = R.endAt - t; const c = Math.ceil(R.left);
    if (c !== R.last) { if (c <= 3 && c > 0) beepShort(); R.last = c; }
    if (R.left <= 0) rotationNext(t); }
  if (UI.view === 'tool') { const d = TOOL_DEFS[UI.tool]; if (d && d.tick) d.tick(t); }
}, 100);

/* ---------- Minuteur ---------- */
function timerView(){
  const T = TS.timer, pres = String(TCFG('timer').presets || '30, 60, 120, 300').split(/[,;\s]+/).map(Number).filter(x => x > 0);
  const show = T.run ? T.left : T.left || T.dur, pct = T.dur ? Math.max(0, Math.min(1, show / T.dur)) : 0;
  return `<div class="tool-full ${T.run ? 'running' : ''} ${!T.run && T.left <= 0 ? 'ended' : ''}">
    <div class="ring" style="--p:${pct}"><div class="big-time" id="tm-t">${mmss(show)}</div></div>
    <div class="btn-row center-row">${T.run ? `<button class="btn red big" data-tt="pause">⏸ Pause</button>` : `<button class="btn green big" data-tt="go">▶ ${T.left > 0 && T.left < T.dur ? 'Reprendre' : 'Départ'}</button>`}<button class="btn big" data-tt="reset">↺</button></div>
    <div class="btn-row center-row">${pres.map(p => `<button class="chip ${T.dur === p ? 'on' : ''}" data-tt="set" data-v="${p}">${p < 60 ? p + ' s' : mmss(p)}</button>`).join('')}</div>
    <div class="btn-row center-row">${[[-60,'− 1 min'],[-10,'− 10 s'],[10,'+ 10 s'],[60,'+ 1 min']].map(([v, l]) => `<button class="btn small" data-tt="add" data-v="${v}">${l}</button>`).join('')}</div></div>`;
}
function timerBind(){ $$('[data-tt]').forEach(b => b.onclick = () => { const T = TS.timer, a = b.dataset.tt;
  if (a === 'go') { if (T.left <= 0 || T.left >= T.dur) T.left = T.dur; T.endAt = nowS() + T.left; T.run = true; T.last = null; beep(1, 0.01); keepAwake(true); }
  if (a === 'pause') { T.run = false; T.left = T.endAt - nowS(); keepAwake(false); }
  if (a === 'reset') { T.run = false; T.left = T.dur; keepAwake(false); }
  if (a === 'set') { T.dur = +b.dataset.v; T.run = false; T.left = T.dur; }
  if (a === 'add') { T.dur = Math.max(5, T.dur + +b.dataset.v); if (T.run) T.endAt += +b.dataset.v; else T.left = T.dur; }
  rerender(); }); }
function timerTick(){ const T = TS.timer; if (!T.run) return; setTxt('tm-t', mmss(T.left)); const r = $('.ring'); if (r) r.style.setProperty('--p', Math.max(0, T.left / T.dur)); }

/* ---------- Chronomètre à tours ---------- */
const chrNow = () => TS.chrono.acc + (TS.chrono.run ? nowS() - TS.chrono.t0 : 0);
function chronoView(){
  const C = TS.chrono, L = C.laps;
  return `<div class="tool-full ${C.run ? 'running' : ''}"><div class="big-time mono" id="ch-t">${mmssc(chrNow())}</div>
    <div class="btn-row center-row">${C.run ? `<button class="btn red big" data-ch="stop">⏹ Stop</button><button class="btn orange big" data-ch="lap">🏁 Tour</button>` :
      `<button class="btn green big" data-ch="go">▶ ${C.acc ? 'Reprendre' : 'Départ'}</button><button class="btn big" data-ch="reset">↺ Zéro</button>`}</div>
    ${L.length ? `<table class="tbl laps"><thead><tr><th>Tour</th><th>Temps du tour</th><th>Temps total</th></tr></thead><tbody>${L.map((t, i) => { const p = i ? L[i - 1] : 0, lp = t - p, best = Math.min(...L.map((x, j) => x - (j ? L[j - 1] : 0)));
      return `<tr class="${lp === best && L.length > 1 ? 'best' : ''}"><td>${i + 1}</td><td><b>${mmssc(lp)}</b></td><td>${mmssc(t)}</td></tr>`; }).reverse().join('')}</tbody></table>` : ''}</div>`;
}
function chronoBind(){ $$('[data-ch]').forEach(b => b.onclick = () => { const C = TS.chrono, a = b.dataset.ch;
  if (a === 'go') { C.t0 = nowS(); C.run = true; keepAwake(true); beep(1175, 0.15); }
  if (a === 'stop') { C.acc = chrNow(); C.run = false; keepAwake(false); }
  if (a === 'lap') { C.laps.push(chrNow()); beepShort(); }
  if (a === 'reset') { C.acc = 0; C.laps = []; }
  rerender(); }); }
function chronoTick(){ if (TS.chrono.run) setTxt('ch-t', mmssc(chrNow())); }

/* ---------- Intervalles (travail / récupération) ---------- */
function intervalNext(t){
  const I = TS.interval;
  if (I.phase === 'prep' || (I.phase === 'rest')) { I.round++; I.phase = 'work'; I.endAt = t + I.work; beepGo(); }
  else if (I.phase === 'work') { if (I.round >= I.rounds) { I.phase = 'done'; I.run = false; beepEnd(); keepAwake(false); }
    else if (I.rest > 0) { I.phase = 'rest'; I.endAt = t + I.rest; beep(523, 0.5); } else { I.round++; I.endAt = t + I.work; beepGo(); } }
  I.last = null; I.left = I.endAt - t; if (UI.view === 'tool' && UI.tool === 'interval') rerender();
}
function intervalView(){
  const I = TS.interval, ph = { idle:['Prêt ?',''], prep:['Préparez-vous','prep'], work:['TRAVAIL','work'], rest:['RÉCUPÉRATION','rest'], done:['Terminé !','done'] }[I.phase];
  const total = I.rounds * I.work + (I.rounds - 1) * I.rest;
  return `<div class="tool-full iv ${ph[1]}"><div class="iv-phase">${ph[0]}</div>
    <div class="big-time" id="iv-t">${I.run ? mmss(I.left) : I.phase === 'done' ? '✓' : mmss(I.work)}</div>
    <div class="iv-round">${I.phase === 'idle' || I.phase === 'done' ? `${I.rounds} séries · durée totale ${mmss(total)}` : `Série ${Math.max(1, I.round)} / ${I.rounds}`}</div>
    <div class="btn-row center-row">${I.run ? `<button class="btn red big" data-iv="pause">⏸ Pause</button>` : `<button class="btn green big" data-iv="go">▶ ${I.phase === 'idle' || I.phase === 'done' ? 'Départ' : 'Reprendre'}</button>`}<button class="btn big" data-iv="reset">↺</button></div>
    ${I.run ? '' : `<div class="iv-set">${[['work','💪 Travail', 5, 's'],['rest','😮‍💨 Récupération', 5, 's'],['rounds','🔁 Séries', 1, '']].map(([k, l, st, u]) => `<div class="iv-p"><span>${l}</span><button class="cbtn" data-iv="dec" data-k="${k}" data-s="${st}">−</button><b>${I[k]}${u}</b><button class="cbtn" data-iv="inc" data-k="${k}" data-s="${st}">+</button></div>`).join('')}</div>
      <div class="btn-row center-row">${[['Tabata', 20, 10, 8], ['30/30', 30, 30, 10], ['45/15', 45, 15, 8], ['Gainage 3×1 min', 60, 30, 3]].map(([n, w, r, k]) => `<button class="chip" data-iv="preset" data-w="${w}" data-r="${r}" data-k="${k}">${n}</button>`).join('')}</div>`}</div>`;
}
function intervalBind(){ $$('[data-iv]').forEach(b => b.onclick = () => { const I = TS.interval, a = b.dataset.iv;
  if (a === 'go') { if (I.phase === 'idle' || I.phase === 'done') { I.phase = 'prep'; I.round = 0; I.endAt = nowS() + 5; } else I.endAt = nowS() + I.left; I.run = true; I.last = null; beep(1, 0.01); keepAwake(true); }
  if (a === 'pause') { I.run = false; I.left = I.endAt - nowS(); keepAwake(false); }
  if (a === 'reset') { I.run = false; I.phase = 'idle'; I.round = 0; keepAwake(false); }
  if (a === 'inc' || a === 'dec') { const k = b.dataset.k; I[k] = Math.max(k === 'rest' ? 0 : 1, I[k] + (a === 'inc' ? 1 : -1) * +b.dataset.s); }
  if (a === 'preset') { I.work = +b.dataset.w; I.rest = +b.dataset.r; I.rounds = +b.dataset.k; }
  rerender(); }); }
function intervalTick(){ if (TS.interval.run) setTxt('iv-t', mmss(TS.interval.left)); }

/* ---------- Rotation d'ateliers ---------- */
function rotationNext(t){
  const R = TS.rotation, c = TCFG('rotation'), N = rotAteliers().length;
  if (R.phase === 'work' && +c.trans > 0) { R.phase = 'trans'; R.endAt = t + +c.trans; beepEnd(); }
  else { if (R.phase === 'work') beepEnd(); else beepGo(); R.rot = (R.rot + 1) % N; R.phase = 'work'; R.endAt = t + (+c.duree || 5) * 60; if (R.rot === 0) toast('🔄 Tous les groupes sont passés à chaque atelier', 4000); }
  R.last = null; R.left = R.endAt - t; if (UI.view === 'tool' && UI.tool === 'rotation') rerender();
}
function rotationView(){
  const R = TS.rotation, A = rotAteliers(), c = TCFG('rotation'), G = nbGroups(), dur = (+c.duree || 5) * 60;
  return `<div class="tool-full rot ${R.phase}"><div class="iv-phase">${R.phase === 'trans' ? '🔄 Changez d\'atelier !' : R.phase === 'work' ? `Rotation ${R.rot + 1} / ${A.length}` : `${A.length} ateliers · ${mmss(dur)} chacun`}</div>
    <div class="big-time" id="rt-t">${R.run ? mmss(R.left) : mmss(R.phase === 'idle' ? dur : R.left)}</div>
    <div class="rot-grid">${Array.from({ length:Math.max(G, 1) }, (_, g) => { const at = A[(g + R.rot + (R.phase === 'trans' ? 1 : 0)) % A.length];
      return `<div class="rot-row"><span class="rot-g" style="background:${groupColor(g).c};color:${darkTxt(groupColor(g).c) ? '#0A1633' : '#fff'}">${G > 1 ? 'Groupe ' + groupColor(g).n : 'Classe'}</span><span class="rot-arrow">${R.phase === 'trans' ? '➜' : '▸'}</span><b>${esc(at)}</b></div>`; }).join('')}</div>
    ${G < A.length ? `<p class="muted small center">${A.length - G} atelier(s) sans groupe à chaque rotation (${G} groupe(s)).</p>` : ''}
    <div class="btn-row center-row">${R.run ? `<button class="btn red big" data-rt="pause">⏸ Pause</button>` : `<button class="btn green big" data-rt="go">▶ ${R.phase === 'idle' ? 'Départ' : 'Reprendre'}</button>`}
      <button class="btn big" data-rt="next">⏭ Atelier suivant</button><button class="btn big" data-rt="reset">↺</button></div></div>`;
}
function rotationBind(){ $$('[data-rt]').forEach(b => b.onclick = () => { const R = TS.rotation, a = b.dataset.rt, c = TCFG('rotation');
  if (a === 'go') { if (R.phase === 'idle') { R.phase = 'work'; R.rot = 0; R.endAt = nowS() + (+c.duree || 5) * 60; beepGo(); } else R.endAt = nowS() + R.left; R.run = true; R.last = null; keepAwake(true); }
  if (a === 'pause') { R.run = false; R.left = R.endAt - nowS(); keepAwake(false); }
  if (a === 'next') { const t = nowS(); R.phase = 'trans'; rotationNext(t); if (!R.run) R.left = R.endAt - t; }
  if (a === 'reset') { R.run = false; R.phase = 'idle'; R.rot = 0; keepAwake(false); }
  rerender(); }); }
function rotationTick(){ if (TS.rotation.run) setTxt('rt-t', mmss(TS.rotation.left)); }

/* ---------- Tirage au sort ---------- */
const presentIn = g => sortedStudents().filter(s => !isOff(attOf(curLesson(), s.id)) && (g == null || (s.grp || 0) === g));
function tirageView(){
  const D = TS.tirage, pool = presentIn(D.g).filter(s => !D.noRep || !D.drawn.includes(s.id));
  return `<div class="tool-full">${groupChips(D.g, 'tirG')}
    <div class="draw-name" id="dr-n">${D.cur ? esc(nameOf(D.cur)) : '?'}</div>
    <div class="btn-row center-row"><button class="btn orange big" data-dr="go" ${pool.length ? '' : 'disabled'}>🎲 Tirer au sort</button>
      <label class="fld inline"><input type="checkbox" data-dr="norep" ${D.noRep ? 'checked' : ''}> Sans remise (chacun passe une fois)</label></div>
    <p class="center muted">${pool.length} élève(s) dans le chapeau${D.drawn.length ? ` · <button class="btn small ghost" data-dr="reset">↺ Remettre tout le monde</button>` : ''}</p>
    ${D.drawn.length ? `<div class="drawn">${D.drawn.map((id, i) => `<span class="tag">${i + 1}. ${esc(nameOf(id))}</span>`).join(' ')}</div>` : ''}</div>`;
}
function tirageBind(){ $$('[data-dr]').forEach(b => { const a = b.dataset.dr, D = TS.tirage;
  if (a === 'norep') return b.onchange = () => { D.noRep = b.checked; rerender(); };
  b.onclick = () => { if (a === 'reset') { D.drawn = []; D.cur = null; return rerender(); }
    const pool = presentIn(D.g).filter(s => !D.noRep || !D.drawn.includes(s.id)); if (!pool.length) return;
    let k = 0; const el = $('#dr-n'); b.disabled = true;
    const spin = () => { el.textContent = nameOf(pool[Math.floor(Math.random() * pool.length)].id); beep(440 + k * 30, 0.04, 0.5); if (++k < 18) setTimeout(spin, 40 + k * 8);
      else { const pick = pool[Math.floor(Math.random() * pool.length)]; D.cur = pick.id; D.drawn.push(pick.id); beepGo(); rerender(); } };
    spin(); }; }); }

/* ---------- Équipes ---------- */
const TEAMC = [0, 1, 3, 4, 5, 2, 6, 9, 10, 11, 8, 7];
function bestVal(sid, f){ const a = Array.from({ length:S.settings.nbLessons }, (_, i) => lessonVal(i + 1, sid, f)).filter(v => v != null); if (!a.length) return null; return f.better === 'low' ? Math.min(...a) : Math.max(...a); }
function makeTeams(){
  const E = TS.equipes, n = E.n, list = presentIn(null), f = E.mode === 'niveau' ? fieldById(E.f) || FIELDS[0] : null;
  let order = [...list].sort(() => Math.random() - 0.5);
  if (f) { const v = s => bestVal(s.id, f); order.sort((a, b) => { const x = v(a), y = v(b); if (x == null) return 1; if (y == null) return -1; return f.better === 'low' ? x - y : y - x; }); }
  const teams = Array.from({ length:n }, () => []);
  order.forEach((s, i) => { const r = Math.floor(i / n), k = i % n; teams[f ? (r % 2 ? n - 1 - k : k) : k].push(s.id); });   // serpentin si équilibré
  E.teams = teams;
}
function equipesView(){
  const E = TS.equipes;
  return `<div class="tool-full"><div class="card"><div class="btn-row"><b>Nombre d'équipes</b><button class="cbtn" data-eq="dec">−</button><b class="eq-n">${E.n}</b><button class="cbtn" data-eq="inc">+</button></div>
    <div class="btn-row" style="margin-top:8px"><b>Composition</b><button class="chip ${E.mode === 'hasard' ? 'on' : ''}" data-eq="mode" data-m="hasard">🎲 Au hasard</button>
      ${FIELDS.length ? `<button class="chip ${E.mode === 'niveau' ? 'on' : ''}" data-eq="mode" data-m="niveau">⚖️ Équilibrées selon…</button>` : ''}
      ${E.mode === 'niveau' ? `<select data-eq="f">${FIELDS.map(f => `<option value="${f.id}" ${E.f === f.id ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>` : ''}</div>
    <div class="btn-row" style="margin-top:8px"><button class="btn orange" data-eq="make">👥 Former les équipes</button>${E.teams && isProf() ? `<button class="btn" data-eq="apply">↪ Utiliser comme groupes (tablettes)</button>` : ''}</div>
    <p class="muted small">Seuls les élèves présents sont répartis. « Équilibrées » : les élèves sont classés selon leur meilleur résultat puis distribués en serpentin.</p></div>
    ${E.teams ? `<div class="teams">${E.teams.map((t, i) => { const c = COLORS[TEAMC[i % 12]]; return `<div class="team" style="border-color:${c.c}"><div class="team-h" style="background:${c.c};color:${darkTxt(c.c) ? '#0A1633' : '#fff'}">Équipe ${c.n} · ${t.length}</div>${t.map(id => `<div>${esc(nameOf(id))}</div>`).join('')}</div>`; }).join('')}</div>` : ''}</div>`;
}
function equipesBind(){ $$('[data-eq]').forEach(b => { const a = b.dataset.eq, E = TS.equipes;
  if (a === 'f') return b.onchange = () => { E.f = b.value; };
  b.onclick = async () => {
    if (a === 'inc' || a === 'dec') E.n = Math.max(2, Math.min(12, E.n + (a === 'inc' ? 1 : -1)));
    if (a === 'mode') { E.mode = b.dataset.m; if (!E.f && FIELDS[0]) E.f = (TFIELDS[0] || FIELDS[0]).id; }
    if (a === 'make') { makeTeams(); beepShort(); }
    if (a === 'apply') { if (!(await confirmBox('Utiliser ces équipes comme groupes ?', `${E.n} groupes de couleur (= tablettes). Les élèves absents gardent leur groupe actuel.`, 'Appliquer'))) return;
      S.settings.nbGroups = Math.min(CFG.maxGroups, E.n); E.teams.forEach((t, i) => t.forEach(id => { const s = student(id); if (s) s.grp = i % S.settings.nbGroups; })); save(); toast('✓ Groupes mis à jour : renvoyez le QR de la ' + LECON); }
    rerender(); }; }); }

/* ---------- Tableau de score ---------- */
const scNow = () => TS.score.acc + (TS.score.run ? nowS() - TS.score.t0 : 0);
function scoreView(){
  const C = TS.score, c = TCFG('score');
  return `<div class="tool-full score"><div class="sc-board">
    <div class="sc-team a"><div class="sc-n">${esc(c.a || 'Équipe A')}</div><button class="sc-pts" data-sc="a+">${C.a}</button><button class="btn small" data-sc="a-">− 1</button></div>
    <div class="sc-mid"><div class="mono sc-time" id="sc-t">${mmss(scNow())}</div><button class="btn ${C.run ? 'red' : 'green'}" data-sc="clock">${C.run ? '⏸' : '▶'} Chrono</button><button class="btn small ghost" data-sc="reset">↺ Tout remettre à 0</button></div>
    <div class="sc-team b"><div class="sc-n">${esc(c.b || 'Équipe B')}</div><button class="sc-pts" data-sc="b+">${C.b}</button><button class="btn small" data-sc="b-">− 1</button></div></div>
    <p class="center muted">Touchez le score d'une équipe pour lui donner un point.</p></div>`;
}
function scoreBind(){ $$('[data-sc]').forEach(b => b.onclick = async () => { const C = TS.score, a = b.dataset.sc;
  if (a === 'a+') { C.a++; beepShort(); } if (a === 'b+') { C.b++; beepShort(); } if (a === 'a-') C.a = Math.max(0, C.a - 1); if (a === 'b-') C.b = Math.max(0, C.b - 1);
  if (a === 'clock') { if (C.run) { C.acc = scNow(); C.run = false; } else { C.t0 = nowS(); C.run = true; } }
  if (a === 'reset') { if (!(await confirmBox('Remettre à zéro ?', 'Score et chrono.', 'Remettre à 0'))) return; Object.assign(C, { a:0, b:0, run:false, acc:0 }); }
  rerender(); }); }
function scoreTick(){ if (TS.score.run) setTxt('sc-t', mmss(scNow())); }

/* ---------- Compteur de tours ---------- */
const trNow = () => TS.tours.run ? nowS() - TS.tours.t0 : 0;
function toursView(){
  const R = TS.tours, f = fieldById(TCFG('tours').field), list = presentIn(R.g);
  return `<div class="tool-full"><div class="btn-row spread"><div class="mono big-time small-t" id="tr-t">${mmss(trNow())}</div>
    <div class="btn-row">${R.run ? `<button class="btn red" data-tr="stop">⏹ Arrêter</button>` : `<button class="btn green" data-tr="go">▶ Départ</button>`}<button class="btn ghost" data-tr="reset">↺</button>
    ${f ? `<button class="btn primary" data-tr="save">💾 Reporter dans « ${esc(f.label)} »</button>` : ''}</div></div>
    ${groupChips(R.g, 'trG')}
    <p class="muted">Touchez un élève à chaque tour terminé. ↩ annule le dernier tour.</p>
    <div class="tiles tours">${list.map(s => { const L = R.laps[s.id] || [], last = L.length ? L[L.length - 1] - (L.length > 1 ? L[L.length - 2] : 0) : null;
      return `<div class="tile tour-t" data-tr="lap" data-sid="${s.id}">${band(s.id)}<span class="name">${esc(nameOf(s.id))}</span><span class="tour-n">${L.length}</span>
        <span class="meta">${last != null ? 'dernier tour ' + mmss(last) : '—'}</span>${L.length ? `<button class="undo" data-tr="undo" data-sid="${s.id}">↩</button>` : ''}</div>`; }).join('')}</div></div>`;
}
function toursBind(){ $$('[data-tr]').forEach(b => b.onclick = async e => { const R = TS.tours, a = b.dataset.tr; e.stopPropagation();
  if (a === 'go') { R.run = true; R.t0 = nowS() - (R.paused || 0); delete R.paused; beepGo(); keepAwake(true); }
  if (a === 'stop') { R.paused = trNow(); R.run = false; keepAwake(false); }
  if (a === 'reset') { if (Object.keys(R.laps).length && !(await confirmBox('Tout remettre à zéro ?', 'Les tours comptés sont effacés.', 'Remettre à 0', true))) return; R.laps = {}; R.run = false; delete R.paused; }
  if (a === 'lap') { if (!R.run) { R.run = true; R.t0 = nowS(); keepAwake(true); } (R.laps[b.dataset.sid] = R.laps[b.dataset.sid] || []).push(trNow()); beepShort(); if (navigator.vibrate) navigator.vibrate(30); }
  if (a === 'undo') (R.laps[b.dataset.sid] || []).pop();
  if (a === 'save') { const f = fieldById(TCFG('tours').field), n = curLesson(), ids = Object.keys(R.laps).filter(id => R.laps[id].length);
    if (!(await confirmBox('Reporter les tours ?', `${ids.length} élève(s) : le nombre de tours est écrit dans « ${esc(f.label)} »${f.per === 'try' ? ' (premier essai libre)' : ''}.`, 'Reporter'))) return;
    ids.forEach(id => { let k = null; if (f.per === 'try') { k = Array.from({ length:tries(n) }, (_, j) => j).find(j => rawVal(n, id, f, j) == null); if (k == null) k = tries(n) - 1; }
      setVal(n, id, f, k, R.laps[id].length); }); toast(`✓ ${ids.length} résultat(s) reporté(s)`); }
  rerender(); }); }
function toursTick(){ if (TS.tours.run) setTxt('tr-t', mmss(trNow())); }

const TOOL_DEFS = {
  timer:{ n:'Minuteur', ico:'⏳', view:timerView, bind:timerBind, tick:timerTick },
  chrono:{ n:'Chronomètre', ico:'⏱️', view:chronoView, bind:chronoBind, tick:chronoTick },
  interval:{ n:'Intervalles', ico:'🔁', view:intervalView, bind:intervalBind, tick:intervalTick },
  rotation:{ n:'Rotation d\'ateliers', ico:'🔄', view:rotationView, bind:rotationBind, tick:rotationTick },
  tirage:{ n:'Tirage au sort', ico:'🎲', view:tirageView, bind:tirageBind },
  equipes:{ n:'Équipes', ico:'👥', view:equipesView, bind:equipesBind },
  score:{ n:'Tableau de score', ico:'🏆', view:scoreView, bind:scoreBind, tick:scoreTick },
  tours:{ n:'Compteur de tours', ico:'🏃', view:toursView, bind:toursBind, tick:toursTick },
};
