/* =====================================================================
   SPÉCIFIQUE — Sauvetage CA2 (V2 sur le socle N'EPS 1.0.0)
   Chargé APRÈS socle.js et outils.js. Ajoute au socle, sans le modifier :
   - la programmation de chaque leçon (Test S1 ou parcours, piliers, consignes,
     parcours du jour, attribution P1/P2…) transmise dans le QR de la leçon ;
   - la bibliothèque et l'éditeur de parcours, l'animation vue de dessus / de côté ;
   - le chrono de parcours par étapes (taps, annuler, obstacles ratés, télécommande),
     nageur / observateur, observation des 3 critères du pilier une fois par passage ;
   - la banque de piliers modifiable ;
   - les deux fils rouges de la V6.1 (nageur, observateur).
   Modules repris de la V6.1 : sauvetage/store.js, schema.js, sim.js, chrono.js.
   ===================================================================== */
'use strict';
(function(){

/* =====================================================================
   1. Piliers (banque par défaut dans activite.js, modifications dans ROOT.pils)
   ===================================================================== */
const PDEF = window.SAUV_PILIERS || [];
const pilStore = () => (ROOT.pils = ROOT.pils || {});
function pilier(id){ const d = PDEF.find(p => p.id === id); if (!d) return null; const o = pilStore()[id]; return o ? { ...d, ...o, id } : d; }
const piliers = () => PDEF.map(p => pilier(p.id));
const pField = id => fieldById('P_' + id);
function applyPiliers(){ piliers().forEach(p => { const f = pField(p.id); if (!f) return; f.label = 'Pilier · ' + p.n; f.criteres = p.cr.map(x => x.t); }); }

/* =====================================================================
   2. Programmation d'une leçon (stockée dans lesson(n), comme le reste du socle)
   ===================================================================== */
const TEST_DISTS = [25, 50, 100];
const PCOL = ['#0062C4', '#E8403B', '#3A9A1E', '#7B4BD8', '#F59A1B', '#0E9AA7', '#C2185B', '#5B6478'];
function LP(n){
  const x = lesson(n);
  if (!x.kind) x.kind = n === 1 ? 'test' : 'parcours';
  if (!Array.isArray(x.pil)) x.pil = []; if (!Array.isArray(x.par)) x.par = []; if (!x.asg) x.asg = {};
  if (!x.tdist) x.tdist = 50; if (!x.tent) x.tent = 'dive'; if (x.obj == null) x.obj = '';
  return x;
}
const isTest = n => LP(n).kind === 'test';
function testParcours(dist, entree){
  const n = Math.max(1, Math.round(dist / 25));
  return Store.normalize({ id:'test-' + dist + '-' + entree, name:`Test S1 · ${n * 25} m`, entree, data:{ nbLongueurs:n, entree, obstacles:Array.from({ length:n }, () => []) } });
}
const parsOf = n => isTest(n) ? [testParcours(LP(n).tdist, LP(n).tent)] : LP(n).par;
function asgOf(n, sid){ const x = LP(n), pid = x.asg[sid]; return pid && x.par.some(p => p.id === pid) ? pid : null; }
const entreeLbl = p => Store.ENTREES[Store.validEntree(p.entree)].label;

/* ---------- QR de la leçon : on ajoute la programmation (sx) au paquet du socle ---------- */
const packP = p => [p.id, p.name, p.n, Store.validEntree(p.entree), p.obstacles.map(a => a.map(o => [o.type, o.dist, o.type === 'apnee' ? o.depl : (o.type === 'mannequin' ? o.remorque : 0)]))];
function unpackP(a){
  let k = 1;
  return Store.normalize({ id:a[0], name:a[1], entree:a[3], data:{ nbLongueurs:a[2], entree:a[3],
    obstacles:a[4].map(arr => arr.map(o => { const r = { id:k++, type:o[0], dist:o[1] }; if (o[0] === 'apnee') r.depl = o[2]; if (o[0] === 'mannequin') r.remorque = o[2]; return r; })) } });
}
const _buildSeance = buildSeance;
buildSeance = function(n){
  const p = _buildSeance(n); n = n || curLesson(); const x = LP(n);
  p.sx = { k:x.kind, d:x.tdist, e:x.tent, o:x.obj || '', pil:x.pil,
    par: x.kind === 'test' ? [] : x.par.map(packP),
    asg: Object.fromEntries(Object.entries(x.asg).map(([s, pid]) => [s, x.par.findIndex(q => q.id === pid)]).filter(e => e[1] >= 0)),
    pd: Object.fromEntries(x.pil.map(id => { const q = pilier(id); return q ? [id, [q.n, q.c, q.cr.map(c => [c.t, c.o])]] : null; }).filter(Boolean)) };
  return p;
};
const _applySeance = applySeance;
applySeance = function(p){
  const r = _applySeance(p), sx = p.sx;
  if (sx) {
    const x = lesson(p.cur);
    Object.assign(x, { kind:sx.k || 'parcours', tdist:sx.d || 50, tent:sx.e || 'dive', obj:sx.o || '', pil:sx.pil || [], par:(sx.par || []).map(unpackP), asg:{} });
    Object.entries(sx.asg || {}).forEach(([s, i]) => { if (x.par[i]) x.asg[s] = x.par[i].id; });
    Object.entries(sx.pd || {}).forEach(([id, a]) => { pilStore()[id] = { n:a[0], c:a[1], cr:a[2].map(c => ({ t:c[0], o:c[1] })) }; });
    applyPiliers(); save(); rerender();
  }
  return r;
};

/* =====================================================================
   3. Fils rouges (règles de la V6.1)
   ===================================================================== */
const FR_SPEED = e => e <= 0.05 ? 4 : e <= 0.10 ? 3 : e <= 0.20 ? 2 : 1;
const FR_OBS = x => x >= 0.95 ? 4 : x >= 0.80 ? 3 : x >= 0.50 ? 2 : 1;
function frNageur(n, sid){
  if (isTest(n)) return null;
  const fT = fieldById('tps'), fV = fieldById('vit'), fR = fieldById('rat');
  const done = Array.from({ length:tries(n) }, (_, j) => j).filter(j => rawVal(n, sid, fT, j) != null || rawVal(n, sid, fV, j) != null);
  if (!done.length) return null;
  const f = avg(done.map(j => rawVal(n, sid, fR, j) || 0)), pen = f === 0 ? 0 : f <= 1 ? 1 : 2;
  const fTxt = f === 0 ? 'aucun obstacle raté' : `${fmtN(f, 1)} obstacle(s) raté(s) par passage`;
  const vs = vals(done.map(j => rawVal(n, sid, fV, j))), t = targetOf(sid, fV);
  if (t == null || !vs.length) return { lv:null, why:`${done.length} passage(s) · ${fTxt} · sans vitesse de sauveteur (Test S1)` };
  const e = avg(vs.map(v => Math.abs(v / t - 1)));
  return { lv:Math.max(1, FR_SPEED(e) - pen), why:`${done.length} passage(s) · écart à la vitesse de sauveteur ${Math.round(e * 100)} % · ${fTxt}` };
}
function frObservateur(n, sid){
  const all = S.results[n] || {}; let any = false, obs = 0, tot = 0, fill = 0;
  Object.values(all).forEach(r => (r.x || []).forEach((x, k) => {
    if (!x) return; any = true; if (x.oi !== sid) return; obs++;
    if (x.pi) { const a = r.v['P_' + x.pi]?.[k]; tot += 3; fill += Array.isArray(a) ? a.filter(v => v === 0 || v === 1).length : 0; }
  }));
  if (!any) return null;
  if (!obs) return { lv:1, why:'aucun passage observé' };
  if (!tot) return { lv:null, why:`${obs} passage(s) observé(s) · sans pilier` };
  const x = fill / tot;
  return { lv:FR_OBS(x), why:`${obs} passage(s) observé(s) · critères renseignés ${Math.round(x * 100)} %` };
}
window.SAUV = { frNageur, frObservateur };

/* =====================================================================
   4. Ajustements du socle (sans le modifier)
   ===================================================================== */
const CRIT_IDS = () => FIELDS.filter(f => f.type === 'criteres').map(f => f.id);
/* % de critères du pilier observé, recalculé à chaque saisie de critères */
function syncPil(n, sid, k){
  const r = res(n, sid); if (!r) return;
  const x = r.x && r.x[k], ids = x && x.pi ? ['P_' + x.pi] : CRIT_IDS();
  let p = null; for (const id of ids) { const c = critPct(r.v[id]?.[k]); if (c != null) { p = c; break; } }
  _setVal(n, sid, fieldById('pil'), k, p == null ? null : Math.round(p));
}
const _setVal = setVal;
setVal = function(n, sid, f, k, v){ _setVal(n, sid, f, k, v); if (f && f.type === 'criteres' && k != null) syncPil(n, sid, k); };
/* une fiche est complète quand tous les passages ont un temps */
entryDone = function(n, sid){ const r = res(n, sid); if (!r) return false; const f = fieldById('tps');
  return Array.from({ length:tries(n) }, (_, j) => rawVal(n, sid, f, j)).every(v => v != null); };
/* bilan par leçon : un seul pilier est observé par passage → pas de « manque d'investissement » pour les autres */
const _lessonInsight = lessonInsight;
lessonInsight = function(n, sid){ const o = _lessonInsight(n, sid);
  if (o && o.inv) {
    const bad = FIELDS.filter(f => f.type === 'criteres' || ['pil', 'tps', 'vit', 'rat'].includes(f.id)).map(f => f.label + ' :');
    const had = o.inv.length; o.inv = o.inv.filter(s => !bad.some(b => s.startsWith(b)));
    if (o.inv.length < had && !o.inv.includes('aucune saisie')) { const f = fieldById('tps'), k = tries(n), d = Array.from({ length:k }, (_, j) => rawVal(n, sid, f, j)).filter(v => v != null).length; if (d < k) o.inv.unshift(`Passages : ${d}/${k}`); }
  }
  /* temps du parcours : non comparable d'une leçon à l'autre (parcours différents) */
  const tl = fieldById('tps').label; ['prog', 'enc'].forEach(k => { if (o && o[k]) o[k] = o[k].filter(s => !s.startsWith(tl)); });
  return o; };
const _profNotes = profNotes;
profNotes = function(){ const h = _profNotes(); return S.settings.nbLessons && !Array.from({ length:S.settings.nbLessons }, (_, i) => lesson(i + 1).ev).some(Boolean) ? h.replace("(leçons d'évaluation)", '(toutes les leçons sauf Test S1)') : h; };
/* notes : les leçons Test S1 ne comptent pas */
const _gradeLessons = gradeLessons;
gradeLessons = function(){ const a = _gradeLessons(), b = a.filter(n => !isTest(n)); return b.length ? b : a; };

/* =====================================================================
   5. Vignettes de parcours (canvas peints après chaque affichage)
   ===================================================================== */
let THUMBS = {}, thumbN = 0;
function thumb(p, cls = '', opts = { compact:true }){ const k = 't' + (++thumbN); THUMBS[k] = { p, opts }; return `<canvas class="sv-thumb ${cls}" data-svp="${k}"></canvas>`; }
function paintThumbs(){ requestAnimationFrame(() => { $$('canvas[data-svp]').forEach(cv => { const t = THUMBS[cv.dataset.svp]; if (t) try { Schema.render(cv, t.p, t.opts); } catch(e){} }); }); }

/* =====================================================================
   6. Saisie d'un élève : carte « Passages » + bouton chrono
   ===================================================================== */
const ds = ms => ms == null ? null : Math.round(ms / 100);
const fmtS = v => v == null ? '—' : Chrono.fmt(v * 1000);
const fmtV = v => v == null ? '—' : fmtN(v, 2) + ' m/s';
function gapTxt(v, t){ if (v == null || t == null) return ''; const e = v / t - 1; return `${e >= 0 ? '+' : '−'}${Math.abs(Math.round(e * 100))} %`; }
function nextTry(n, sid){ const f = fieldById('tps'); for (let j = 0; j < tries(n); j++) if (rawVal(n, sid, f, j) == null) return j; return null; }
function passCard(n, sid, k){
  const r = res(n, sid), x = r && r.x && r.x[k], fV = fieldById('vit');
  const tps = rawVal(n, sid, fieldById('tps'), k), v = rawVal(n, sid, fV, k), rat = rawVal(n, sid, fieldById('rat'), k), t = targetOf(sid, fV);
  const par = x && x.p ? (parsOf(n).find(p => p.id === x.p) || null) : null;
  const P = x && x.pi ? pilier(x.pi) : null, cr = P ? (r.v['P_' + P.id]?.[k] || []) : [];
  const done = tps != null || v != null;
  return `<div class="sv-pc ${done ? 'done' : ''}"><div class="sv-pc-h"><b>Passage ${k + 1}</b>
      <button class="btn small ${done ? 'ghost' : 'green'}" data-action="svChrono" data-sid="${sid}" data-k="${k}">${done ? '↻ Refaire' : '⏱️ Chronométrer'}</button></div>
    ${par ? `<div class="muted small" style="margin:-2px 0 6px">🗺️ ${esc(par.name)}</div>` : ''}${done ? `<div class="sv-pc-v"><span class="pill">⏱️ ${fmtS(tps)}</span><span class="pill strong" ${t != null && v != null ? gapCell(fV, v, t) : ''}>🏊 ${fmtV(v)}${t != null && v != null ? ' · ' + gapTxt(v, t) : ''}</span>
      <span class="pill">${rat ? '❌ ' + rat + ' raté' + (rat > 1 ? 's' : '') : '✓ aucun obstacle raté'}</span>${x && x.oi ? `<span class="pill">👀 ${esc(nameOf(x.oi))}</span>` : ''}
      ${par && x && Array.isArray(x.dd) ? (() => { const L = []; par.obstacles.forEach(arr => arr.slice().sort((a, b) => a.dist - b.dist).forEach(o => L.push(o)));
        return L.map((o, i) => isDistObs(o) && x.dd[i] != null ? `<span class="pill ${x.dd[i] < plannedOf(o) ? 'sv-short' : ''}">${distTxt(o, x.dd[i])}</span>` : '').join(''); })() : ''}</div>
      ${P ? `<div class="sv-pc-c"><b>${esc(P.n)} :</b> ${P.cr.map((c, i) => `<span class="sv-cr ${cr[i] === 1 ? 'ok' : cr[i] === 0 ? 'ko' : ''}">${cr[i] === 1 ? '✓' : cr[i] === 0 ? '✗' : '·'} ${esc(c.t)}</span>`).join('')}</div>` : ''}`
      : '<div class="muted">Pas encore fait.</div>'}</div>`;
}
function passagesCard(n, sid){
  const x = LP(n), k = tries(n), nx = nextTry(n, sid), a = attOf(n, sid);
  if (isOff(a)) return `<div class="card sv-pass"><b>${ATT[a].ico} ${ATT[a].n}</b> : pas de passage pour cette leçon.</div>`;
  return `<div class="card sv-pass"><div class="btn-row spread"><h3 style="margin:0">🏊 Passages${x.kind === 'test' ? ` · ⏱️ Test S1 (${x.tdist} m, sans obstacle)` : ''}</h3>
      <button class="btn small ghost" data-action="svManual">${UI.svManual ? 'Masquer la saisie manuelle' : '✎ Saisie manuelle'}</button></div>
    ${x.obj ? `<p class="sv-obj">📌 ${esc(x.obj)}</p>` : ''}
    <div class="sv-plist">${Array.from({ length:k }, (_, j) => passCard(n, sid, j)).join('')}</div>
    ${nx != null ? `<button class="btn green sv-big" data-action="svChrono" data-sid="${sid}" data-k="${nx}">⏱️ Chronométrer le passage ${nx + 1}</button>` : '<p class="center"><b>✓ Tous les passages sont faits.</b></p>'}</div>`;
}
const _viewEntry = viewEntry, _lessonVal = lessonVal;
viewEntry = function(){
  const n = curLesson(), sid = UI.sid, x = LP(n);
  /* cases du socle : seulement en « saisie manuelle » (correction) ; piliers de la leçon uniquement */
  const keep = f => !UI.svManual ? false : f.type === 'criteres' ? x.pil.includes(f.id.slice(2)) : f.id !== 'pil';
  const all = FIELDS.slice(); let h;
  /* l'historique reçu est indexé sur la liste complète des saisies */
  lessonVal = (l, s2, f) => { if (res(l, s2)) return calcAll(l, s2).L[f.id]; const hh = S.hist?.[s2]?.[l]; if (hh) { const i = all.indexOf(f); return hh[i] ?? null; } return null; };
  FIELDS.length = 0; FIELDS.push(...all.filter(keep));
  try { h = _viewEntry(); } finally { FIELDS.length = 0; FIELDS.push(...all); lessonVal = _lessonVal; }
  const card = passagesCard(n, sid);
  let i = h.indexOf('<div class="card field-card">'); if (i < 0) i = h.indexOf('<div class="btn-row spread entry-foot">');
  return i < 0 ? h + card : h.slice(0, i) + card + h.slice(i);
};

/* =====================================================================
   7. Chrono de parcours
   ===================================================================== */
const CH_KEY = ROOT_KEY + '.chrono';
let CH = null, chTimer = null, wakeLock = null, lastTap = 0;
try { CH = JSON.parse(localStorage.getItem(CH_KEY)); } catch(e){ CH = null; }
const persistCH = () => { try { CH ? localStorage.setItem(CH_KEY, JSON.stringify(CH)) : localStorage.removeItem(CH_KEY); } catch(e){} };
const OBS_DIST = { cerceau:2, objet:2, tapis:3 };
function swimOf(p, lens, obsList, timed){
  let d = 0, t = 0;
  for (let i = 0; i < p.n; i++) {
    const Ln = lens[i]; if (Ln == null) continue;
    let od = 0, ot = 0;
    if (timed) (obsList || []).filter(o => o.li === i).forEach(o => { if (o.dur != null) { ot += o.dur; od += o.type === 'apnee' ? (o.depl || 0) : o.type === 'mannequin' ? Math.min(o.remorque || 0, 25 - o.dist) : (OBS_DIST[o.type] || 0); } });
    if (Ln - ot > 0 && 25 - od > 0) { d += 25 - od; t += Ln - ot; }
  }
  return { sd:Math.round(d * 10) / 10, swt:t, v:t > 0 ? d / (t / 1000) : null };
}
/* Apnée / remorquage : l'observateur indique la distance réellement faite (5, 10, 15, 20, 25 m… jusqu'à la distance prévue) */
const DIST_STEPS = [5, 10, 15, 20, 25];
const isDistObs = o => !!o && (o.type === 'apnee' || o.type === 'mannequin');
const plannedOf = o => o.type === 'apnee' ? (o.depl || 0) : Math.max(0, Math.min(o.remorque || 0, 25 - o.dist));
const distOpts = o => { const pl = plannedOf(o); return [...DIST_STEPS.filter(d => d < pl), pl].filter(d => d > 0); };
const stepObs = st => st && st.kind === 'obsEnd' ? (CH.s.parcours.obstacles[st.li] || []).find(o => o.id === st.obsId) || null : null;
function achievedList(c){   // aligné sur c.obstacles : distance faite (null si l'obstacle n'a pas de distance)
  return c.obstacles.map(x => { if (!isDistObs(x.o)) return null;
    const k = c.steps.findIndex(st => st.kind === 'obsEnd' && st.li === x.li && st.obsId === x.o.id), d = CH.dd && CH.dd[k];
    return d != null ? d : plannedOf(x.o); });
}
const obsName = o => Store.TYPES[o.type].short;
const distTxt = (o, d) => `${o.type === 'apnee' ? '🫧' : '🛟'} ${obsName(o)} ${d === plannedOf(o) ? d + ' m ✓' : d + ' / ' + plannedOf(o) + ' m'}`;
function swimCalc(c){
  const p = CH.s.parcours;
  if (CH.test) return { sd:p.n * 25, swt:c.total, v:c.total ? p.n * 25 / (c.total / 1000) : null };
  const ach = achievedList(c);
  return swimOf(p, c.lengths.map(l => l.dur), c.obstacles.map((x, i) => ({ li:x.li, type:x.o.type, dist:x.o.dist,
    depl: x.o.type === 'apnee' && ach[i] != null ? ach[i] : x.o.depl, remorque: x.o.type === 'mannequin' && ach[i] != null ? ach[i] : x.o.remorque, dur:x.dur })), CH.s.timeObstacles);
}
function newCH(n, sid, k, p, keep = {}){
  const x = LP(n), pi = keep.pi !== undefined ? keep.pi : (x.pil[0] || null);
  CH = { n, sid, k, cid:S.id, oid:keep.oid || null, pi: pi && x.pil.includes(pi) ? pi : null, test:x.kind === 'test',
    s:Chrono.newSession(p, { timeObstacles:true })   /* les obstacles sont toujours chronométrés : ça fait partie de la tâche */, ob:[null, null, null], dd:{}, saved:false };
  persistCH();
}
function defaultParcours(n, sid){
  const L = parsOf(n), a = asgOf(n, sid);
  return (a && L.find(p => p.id === a)) || L[0] || null;
}
async function openChrono(sid, k, keep){
  const n = curLesson();
  if (CH && CH.s.taps.length && !CH.saved && !(CH.n === n && CH.sid === sid && CH.k === k && CH.cid === S.id)) {
    if (!(await confirmBox('Passage en cours', `Le passage de ${esc(nameOf(CH.sid))} n'est pas enregistré. L'abandonner ?`, 'Abandonner', true))) return;
    CH = null;
  }
  if (!(CH && CH.n === n && CH.sid === sid && CH.k === k && CH.cid === S.id && !CH.saved)) {
    let p = defaultParcours(n, sid);
    if (!p) { p = await pickParcoursBox(n, null); if (!p) return; }
    newCH(n, sid, k, p, keep || {});
  }
  go('chrono');
}
function stopChrono(){ if (chTimer) { clearInterval(chTimer); chTimer = null; } try { wakeLock && wakeLock.release(); } catch(e){} wakeLock = null; }
async function lockScreen(){ try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch(e){} }

function obsCard(){
  const P = CH.pi ? pilier(CH.pi) : null; if (!P) return '';
  return `<div class="card sv-obs"><div class="sv-eyebrow">👀 Observation du passage${CH.oid ? ' · par ' + esc(nameOf(CH.oid)) : ''}</div><h3>${esc(P.n)}</h3>
    ${P.cr.map((c, i) => { const v = CH.ob[i]; return `<div class="sv-ob-row"><div class="sv-ob-t"><b>${esc(c.t)}</b>${c.o ? `<span>${esc(c.o)}</span>` : ''}</div>
      <div class="sv-ob-b"><button class="yes ${v === 1 ? 'on' : ''}" data-action="svOb" data-i="${i}" data-v="1">Oui</button><button class="no ${v === 0 ? 'on' : ''}" data-action="svOb" data-i="${i}" data-v="0">Non</button></div></div>`; }).join('')}</div>`;
}
function finishCard(c){
  const w = swimCalc(c), t = targetOf(CH.sid, fieldById('vit'));
  let sp = '';
  if (w.v) {
    if (CH.test) sp = `⏱️ Vitesse de nage de sauveteur : <b>${fmtV(w.v)}</b>${t != null ? ` <span class="muted">(cible actuelle : ${fmtV(t)})</span>` : ''}`;
    else if (t != null) { const e = w.v / t - 1, ok = Math.abs(e) <= 0.10; sp = `🏊 Nage seule : <b>${fmtV(w.v)}</b> · vitesse de sauveteur ${fmtV(t)} · <span class="${ok ? 'sv-ok' : 'sv-ko'}">${gapTxt(w.v, t)}${ok ? ' · vitesse stable 👍' : ''}</span>`; }
    else sp = `🏊 Nage seule : <b>${fmtV(w.v)}</b> <span class="muted">(pas encore de vitesse de sauveteur)</span>`;
  }
  const n = CH.n, more = CH.saved ? nextTry(n, CH.sid) : null;
  return `<div class="card sv-finish"><div class="sv-fin-t">Arrivée · ${Chrono.fmt(c.total)}${CH.s.faults ? ` · ${CH.s.faults} obstacle${CH.s.faults > 1 ? 's' : ''} raté${CH.s.faults > 1 ? 's' : ''}` : ''}</div>
    ${sp ? `<div class="sv-fin-s">${sp}</div>` : ''}
    ${(() => { const a = achievedList(c), L = c.obstacles.map((x, i) => a[i] != null ? `<span class="pill ${a[i] < plannedOf(x.o) ? 'sv-short' : ''}">${distTxt(x.o, a[i])}</span>` : '').join(''); return L ? `<div class="sv-pc-v" style="margin-bottom:10px">${L}</div>` : ''; })()}
    ${CH.saved ? `<p><b>✓ Passage enregistré.</b></p><div class="btn-row">
        ${CH.oid && !isOff(attOf(n, CH.oid)) && attOf(n, CH.oid) !== 3 ? `<button class="btn orange" data-action="svSwap">↔ On inverse : ${esc(nameOf(CH.oid))} nage, ${esc(nameOf(CH.sid))} observe</button>` : ''}
        ${more != null ? `<button class="btn primary" data-action="svMore">▶ Passage ${more + 1} de ${esc(nameOf(CH.sid))}</button>` : ''}
        <button class="btn" data-action="svDone">▦ Retour aux élèves</button></div>`
      : `<div class="btn-row"><button class="btn green sv-big" data-action="svSave">✓ Enregistrer le passage</button></div>`}</div>`;
}
function timelineHTML(c){
  const t = CH.s.taps;
  return c.steps.map((st, k) => {
    const cls = k < t.length ? 'done' : k === t.length ? 'now' : '';
    let dur = '';
    if (st.kind === 'obsEnd' && k < t.length) { const x = c.obstacles.find(x => x.li === st.li && x.o.id === st.obsId); if (x && x.dur != null) dur = 'durée ' + Chrono.fmt(x.dur); if (x && isDistObs(x.o)) { const d = CH.dd && CH.dd[k] != null ? CH.dd[k] : plannedOf(x.o); dur += (dur ? ' · ' : '') + (d === plannedOf(x.o) ? d + ' m ✓' : d + ' / ' + plannedOf(x.o) + ' m'); } }
    if ((st.kind === 'turn' || st.kind === 'finish') && k < t.length) { const l = c.lengths[st.li]; if (l.dur != null) dur = `${Store.lenLabel(st.li)} : ${Chrono.fmt(l.dur)}`; }
    const isLen = ['start', 'turn', 'finish'].includes(st.kind);
    return `<li class="${cls} ${isLen ? 'len' : ''}" ${cls === 'now' ? 'id="sv-now"' : ''}><i></i><div>${esc(st.label)} <span class="d">· ${esc(st.sub)}</span>${dur ? `<div class="d">${dur}</div>` : ''}</div><span class="t">${k < t.length ? Chrono.fmt(t[k]) : ''}</span></li>`;
  }).join('');
}
function viewChrono(){
  if (!CH || CH.cid !== S.id) { UI.view = 'saisie'; return render(); }
  if (!CH.s.timeObstacles && !CH.s.taps.length) { CH.s.timeObstacles = true; persistCH(); }
  const n = CH.n, x = LP(n), c = Chrono.compute(CH.s), p = CH.s.parcours, locked = CH.s.taps.length > 0;
  const t = targetOf(CH.sid, fieldById('vit')), pars = parsOf(n);
  setTop('⏱️ ' + nameOf(CH.sid), lessonLabel(n) + ' · passage ' + (CH.k + 1), `<button class="btn small" data-action="svClose">✕ Fermer</button>`);
  $('#main').innerHTML = `<div class="sv-chrono"><div class="sv-col">
    <div class="card sv-ctx">
      ${CH.test ? `<div class="sv-test">⏱️ <b>Test de vitesse de nage de sauveteur</b> · ${p.n * 25} m sans obstacle</div>` : ''}
      <button class="sv-par" data-action="svPickPar" ${locked || CH.test ? 'disabled' : ''}>${thumb(p)}<span><small>Parcours</small><b>${esc(p.name)}</b>
        <small>${p.n * 25} m · ${esc(entreeLbl(p))}${!locked && !CH.test && pars.length !== 1 ? ' · toucher pour changer' : ''}</small></span></button>
      <div class="sv-duo"><div class="sv-who"><small>🏊 Nageur</small><b>${esc(nameOf(CH.sid))}</b><small>${t != null ? 'Vitesse de sauveteur : ' + fmtV(t) : CH.test ? 'Test : sa vitesse sera mesurée' : 'Pas encore de vitesse de sauveteur'}</small></div>
        <button class="sv-who obs ${CH.oid ? '' : 'empty'}" data-action="svPickObs"><small>👀 Observateur</small><b>${CH.oid ? esc(nameOf(CH.oid)) : 'Choisir…'}</b><small>Il observe et coche les critères</small></button></div>
      ${x.pil.length ? `<label class="sv-pilsel"><small>Pilier observé</small><select id="sv-pil">${x.pil.map(id => pilier(id)).filter(Boolean).map(P => `<option value="${P.id}" ${CH.pi === P.id ? 'selected' : ''}>${esc(P.n)}</option>`).join('')}<option value="" ${!CH.pi ? 'selected' : ''}>Pas d'observation</option></select></label>` : ''}
    </div>
    ${!c.finished ? `<div class="card sv-live"><canvas class="sv-schema" id="sv-schema"></canvas></div>` : ''}
    <div class="sv-clock ${!c.started ? 'idle' : c.finished ? 'done' : ''}" id="sv-clock">${Chrono.fmt(c.elapsed)}</div>
    ${(() => { const o = stepObs(c.next);
      if (isDistObs(o)) { const pl = plannedOf(o);
        return `<div class="sv-dist"><div class="sv-dist-h"><b>${esc(c.next.label)}</b> · ${esc(c.next.sub)}<br>Touchez la distance réalisée :</div>
          <div class="sv-dist-g">${distOpts(o).map(d => `<button class="sv-tap k-obsEnd sv-dbtn ${d === pl ? 'full' : ''}" data-dd="${d}"><span class="sv-tl">${d} m</span><span class="sv-ts">${d === pl ? 'complet ✓' : 'arrêt'}</span></button>`).join('')}</div></div>`; }
      return `<button class="sv-tap ${c.next ? 'k-' + c.next.kind : ''}" id="sv-tap" ${c.finished ? 'disabled' : ''}><span class="sv-tl">${c.next ? esc(c.next.label) : 'Terminé'}</span><span class="sv-ts">${c.next ? esc(c.next.sub) : 'Temps final ' + Chrono.fmt(c.total)}</span></button>`; })()}
    <div class="btn-row sv-tools"><span class="stepper"><button class="cbtn" data-action="svFault" data-d="-1" ${CH.s.faults ? '' : 'disabled'}>−</button><button class="btn orange" data-action="svFault" data-d="1">❌ Obstacle raté <b>${CH.s.faults}</b></button></span>
      <button class="btn ghost" data-action="svUndo" ${locked ? '' : 'disabled'}>↶ Annuler le dernier</button><button class="btn ghost" data-action="svReset" ${locked || CH.s.faults ? '' : 'disabled'}>↺ Recommencer</button></div>
    ${c.finished ? obsCard() + finishCard(c) : ''}
  </div><div class="sv-col">
    <div class="card"><div class="sv-kpis"><div><small>Longueurs</small><b>${c.lenTotal ? Chrono.fmt(c.lenTotal) : '—'}</b></div><div><small>Obstacles</small><b>${!CH.test ? (c.obsTotal ? Chrono.fmt(c.obsTotal) : '—') : '—'}</b></div><div><small>Nage seule</small><b>${c.lenTotal ? Chrono.fmt(c.swimTotal) : '—'}</b></div></div>
      <ol class="sv-tlist">${timelineHTML(c)}</ol></div>
  </div></div>`;
  // liaisons
  const tap = $('#sv-tap'); if (tap) tap.addEventListener('pointerdown', e => { e.preventDefault(); doTap(); });
  $$('.sv-dbtn').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); doTap(+b.dataset.dd); }));
  const ps = $('#sv-pil'); if (ps) ps.onchange = () => { CH.pi = ps.value || null; CH.ob = [null, null, null]; CH.saved = false; persistCH(); rerender(); };
  let done = -1; c.lengths.forEach((l, i) => { if (l.dur != null) done = i; });
  const hl = c.next ? { li:c.next.kind === 'start' ? 0 : c.next.li, obsId:c.next.obsId ?? null } : null;
  requestAnimationFrame(() => { const cv = $('#sv-schema'); if (cv) Schema.render(cv, p, { theme:'light', highlight:hl, doneUpTo:done }); const nw = $('#sv-now'); if (nw) { const ol = nw.parentElement; ol.scrollTop = Math.max(0, nw.offsetTop - ol.offsetTop - 60); } });
  const running = c.started && !c.finished;
  if (running && !chTimer) chTimer = setInterval(() => { const el = $('#sv-clock'); if (el && CH) el.textContent = Chrono.fmt(Chrono.elapsed(CH.s)); }, 100);
  if (!running && chTimer) { clearInterval(chTimer); chTimer = null; }
  lockScreen();
}
function doTap(dd){
  if (!CH || UI.view !== 'chrono') return;
  const t = Date.now(); if (t - lastTap < 350) return; lastTap = t;
  const o = stepObs(Chrono.compute(CH.s).next); if (isDistObs(o) && dd == null) dd = plannedOf(o);   // clavier / télécommande : distance complète
  if (Chrono.tap(CH.s, t)) { if (isDistObs(o)) { CH.dd = CH.dd || {}; CH.dd[CH.s.taps.length - 1] = dd; } if (navigator.vibrate) navigator.vibrate(Chrono.compute(CH.s).finished ? [60, 60, 120] : 30); CH.saved = false; persistCH(); rerender(); }
}
async function saveCH(){
  if (!CH || CH.saved) return;
  const c = Chrono.compute(CH.s); if (!c.finished) return;
  if (!CH.oid && !(await confirmBox('Sans observateur ?', 'Aucun observateur n\'est indiqué pour ce passage. Enregistrer quand même ?', 'Enregistrer'))) return pickObserver();
  if (CH.pi && CH.ob.some(v => v == null) && !(await confirmBox('Observation incomplète', 'Certains critères ne sont pas renseignés. Enregistrer quand même ?', 'Enregistrer'))) return;
  const n = CH.n, sid = CH.sid, k = CH.k, w = swimCalc(c), K = tries(n);
  const put = (r, id, v) => { const a = r.v[id] = Array.isArray(r.v[id]) ? r.v[id] : []; while (a.length < K) a.push(null); a[k] = v; };
  setRes(n, sid, r => {
    put(r, 'tps', r10(c.total / 1000, 1)); put(r, 'vit', w.v ? r10(w.v, 2) : null); put(r, 'rat', CH.s.faults || 0);
    CRIT_IDS().forEach(id => { if (id === 'P_' + CH.pi) put(r, id, CH.ob.slice()); else if (Array.isArray(r.v[id])) put(r, id, null); });
    const pc = CH.pi ? critPct(CH.ob) : null; put(r, 'pil', pc == null ? null : Math.round(pc));
    r.x = Array.isArray(r.x) ? r.x : []; while (r.x.length < K) r.x.push(null);
    r.x[k] = { p:CH.s.parcours.id, oi:CH.oid || null, pi:CH.pi || null, t:CH.test ? 1 : 0, to:CH.s.timeObstacles ? 1 : 0,
      l:c.lengths.map(l => ds(l.dur)), o:c.obstacles.map(o => ds(o.dur)), dd:achievedList(c), sd:w.sd, st:ds(w.swt) };
  });
  CH.saved = true; persistCH(); toast(`✓ Passage de ${nameOf(sid)} enregistré${CH.oid ? ' · observé par ' + nameOf(CH.oid) : ''}`); rerender();
}
function pickObserver(){
  const n = CH.n, g = student(CH.sid)?.grp || 0;
  const list = sortedStudents().filter(s => s.id !== CH.sid && attOf(n, s.id) !== 1).sort((a, b) => ((a.grp || 0) === g ? 0 : 1) - ((b.grp || 0) === g ? 0 : 1));
  const m = modal(`<h2>👀 Qui observe ${esc(nameOf(CH.sid))} ?</h2><div class="tiles sv-pick">${list.map(s => `<button class="tile ${CH.oid === s.id ? 'done' : ''}" data-o="${s.id}">${band(s.id)}<span class="name">${esc(nameOf(s.id))}</span>${attOf(n, s.id) ? `<span class="tag ${ATT[attOf(n, s.id)].cls}">${ATT[attOf(n, s.id)].n}</span>` : ''}</button>`).join('')}</div>
    <div class="btn-row spread" style="margin-top:12px"><button class="btn ghost" data-o="">Personne</button><button class="btn ghost" data-x>Annuler</button></div>`, { wide:true });
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { CH.oid = b.dataset.o || null; CH.saved = false; persistCH(); closeModal(); rerender(); });
}
function pickParcoursBox(n, cur){
  return new Promise(res => {
    const day = parsOf(n), lib = Store.library(), pool = day.length ? day : [...lib.user, ...lib.builtins];
    const m = modal(`<h2>🗺️ Quel parcours ?</h2>${day.length ? '' : '<p class="muted">Aucun parcours programmé pour cette leçon : choisissez dans la bibliothèque.</p>'}
      <div class="sv-grid">${pool.map((p, i) => `<button class="sv-pcard ${cur && cur.id === p.id ? 'on' : ''}" data-i="${i}" style="--pc:${PCOL[i % PCOL.length]}">${thumb(p)}<b>${day.length ? `<span class="sv-pn">P${i + 1}</span> ` : ''}${esc(p.name)}</b><small>${p.n * 25} m · ${esc(Store.summary(p))}</small></button>`).join('')}</div>
      <div class="btn-row spread" style="margin-top:12px"><span></span><button class="btn ghost" data-x>Annuler</button></div>`, { wide:true });
    paintThumbs();
    m.querySelector('[data-x]').onclick = () => { closeModal(); res(null); };
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeModal(); res(pool[+b.dataset.i]); });
  });
}
document.addEventListener('keydown', e => {
  if (UI.view !== 'chrono' || !CH || e.target.matches('input,select,textarea') || $('#modal-root').innerHTML) return;
  if (['Space', 'Enter', 'NumpadEnter', 'PageDown', 'ArrowRight', 'ArrowDown'].includes(e.code)) { e.preventDefault(); doTap(); }
  else if (['PageUp', 'ArrowLeft', 'Backspace'].includes(e.code)) { e.preventDefault(); ACT.svUndo(); }
  else if (e.key === 'f' || e.key === 'F') ACT.svFault({ d:'1' });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && UI.view === 'chrono') lockScreen(); });

/* =====================================================================
   8. Animation du parcours (vue de dessus + vue de côté)
   ===================================================================== */
let simOn = false;
function stopSim(){ if (simOn) { try { Sim.pause(); Sim.setActive(false); } catch(e){} simOn = false; } }
const backBtn = () => isProf() && UI.profUnlocked ? (UI.svBack ? `<button class="btn small" data-action="tab" data-tab="${UI.svBack}">← Retour</button>` : menuBtn) : homeBtn;
function viewAnim(){
  const n = curLesson(), list = UI.svAnimList || parsOf(n);
  setTop('🏊 ' + (UI.svAnimList ? 'Voir le parcours' : 'Parcours du jour'), UI.svAnimList ? '' : lessonLabel(n), backBtn());
  if (!list.length) { $('#main').innerHTML = `<div class="card center"><b>Pas de parcours pour cette leçon.</b><br><span class="muted">${isProf() ? 'Ajoutez-en dans Paramètres du cycle.' : 'Recevez d\'abord la leçon.'}</span></div>`; return; }
  const i = Math.min(UI.svAnimI || 0, list.length - 1), p = list[i], x = LP(n);
  const who = UI.svAnimList ? [] : sortedStudents().filter(s => asgOf(n, s.id) === p.id).map(s => nameOf(s.id));
  $('#main').innerHTML = `${list.length > 1 ? `<div class="filters">${list.map((q, j) => `<button class="chip ${j === i ? 'on' : ''}" data-action="svAnimI" data-i="${j}"><span class="dot" style="background:${PCOL[j % PCOL.length]}"></span>P${j + 1} · ${esc(q.name)}</button>`).join('')}</div>` : ''}
    <div class="card"><div class="btn-row spread"><div><h3 style="margin:0">${esc(p.name)}</h3><div class="muted">${p.n} longueur${p.n > 1 ? 's' : ''} (${p.n * 25} m) · ${esc(Store.summary(p))}</div>
      ${!UI.svAnimList && x.par.length > 1 ? `<div class="muted">👥 ${who.length ? esc(who.join(', ')) : 'au choix'}</div>` : ''}</div>
      <div class="btn-row"><button class="btn green" id="sv-play">▶ Lancer</button><button class="btn ghost" id="sv-sreset">↺ Recommencer</button>
      ${[1, 2, 4].map(v => `<button class="chip ${(UI.svSpeed || 1) === v ? 'on' : ''}" data-action="svSpeed" data-v="${v}">×${v}</button>`).join('')}</div></div>
      <div class="sv-sim-st"><span id="sv-sst">Prêt</span><div class="sv-bar"><i id="sv-sprog"></i></div></div></div>
    <div class="sv-sim"><figure class="card"><figcaption>Vue de dessus <small id="sv-pair"></small></figcaption><div class="sv-host"><canvas id="sv-top"></canvas></div></figure>
      <figure class="card"><figcaption>Vue de côté</figcaption><div class="sv-host"><canvas id="sv-side"></canvas></div></figure></div>
    <div class="card">${thumb(p, 'sv-plan', { theme:'light' })}</div>`;
  const LBL = { ready:'Prêt', running:'En cours', paused:'En pause', done:'Terminé' };
  const frame = st => { const a = $('#sv-sst'); if (!a) return;
    a.textContent = st.state === 'done' ? 'Parcours terminé' : `${LBL[st.state]} — ${st.dir} ${st.pair} (longueur ${st.len}/${st.n}) · ${st.meters.toFixed(0)} m`;
    $('#sv-sprog').style.width = (st.progress * 100).toFixed(1) + '%'; const k = Math.floor((st.len - 1) / 2) * 2 + 1; $('#sv-pair').textContent = `Aller ${st.pair}${k + 1 <= st.n ? ' / Retour ' + st.pair : ''}`; };
  Sim.on('state', st => { const b = $('#sv-play'); if (b) { const on = st.state === 'running'; b.className = 'btn ' + (on ? 'orange' : 'green'); b.textContent = on ? '⏸ Pause' : st.state === 'paused' ? '▶ Reprendre' : st.state === 'done' ? '▶ Revoir' : '▶ Lancer'; } frame(st); });
  let last = 0; Sim.on('frame', st => { const t = performance.now(); if (t - last > 120) { last = t; frame(st); } });
  requestAnimationFrame(() => { Sim.attach($('#sv-top'), $('#sv-side')); simOn = true; Sim.setSpeed(UI.svSpeed || 1); Sim.setActive(true); Sim.load(p); });
  $('#sv-play').onclick = () => Sim.toggle(); $('#sv-sreset').onclick = () => Sim.reset();
}

/* =====================================================================
   9. Piliers du jour (élève) et dessins des piliers (repris de la V6.1)
   ===================================================================== */
function swimmerG(x, y, rot = 0, o = {}){
  const arms = o.arms === 'side' ? `<path d="M10 2 L-6 6" stroke="#F2C29B" stroke-width="4.5" stroke-linecap="round"/>`
    : o.arms === 'stroke' ? `<path d="M10 0 Q18 -12 28 -4" fill="none" stroke="#F2C29B" stroke-width="4.5" stroke-linecap="round"/><path d="M10 2 L2 9" stroke="#D9A57E" stroke-width="4.5" stroke-linecap="round"/>`
    : `<path d="M10 -1 L34 -2" stroke="#F2C29B" stroke-width="4.5" stroke-linecap="round"/>`;
  const legs = o.legs === 'tuck' ? `<path d="M-14 0 L-6 -10 L-18 -14" fill="none" stroke="#F2C29B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M-14 1 L-34 ${o.kick ? -3 : 1}" stroke="#F2C29B" stroke-width="5" stroke-linecap="round"/><path d="M-14 2 L-33 ${o.kick ? 6 : 3}" stroke="#D9A57E" stroke-width="5" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${legs}
    <rect x="-17" y="-5.5" width="30" height="11" rx="5.5" fill="#F2C29B"/><rect x="-17" y="-5.5" width="12" height="11" rx="4" fill="#0D47A1"/>
    ${arms}<circle cx="18" cy="-1" r="6.5" fill="#F2C29B"/><path d="M12.5 -2 A6.5 6.5 0 0 1 24 -4.5 L22 1 Z" fill="#E53935"/></g>`;
}
const WATER = (y = 30) => `<rect x="0" y="${y}" width="120" height="${80 - y}" fill="#BFE6FF"/><path d="M0 ${y} q7.5 -3 15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0" fill="none" stroke="#5AB4F0" stroke-width="2"/>`;
function pilArt(id, size = 72){
  let g = '';
  if (id === 'alignement') g = WATER(30) + swimmerG(64, 33, 0, { kick:true }) + `<path d="M18 33 L104 33" stroke="#3A9A1E" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M98 28 l8 5 -8 5" fill="none" stroke="#3A9A1E" stroke-width="2.5"/>`;
  else if (id === 'regard') g = WATER(26) + swimmerG(52, 29, 0, { arms:'stroke' }) + `<path d="M74 33 L88 66" stroke="#F59A1B" stroke-width="2.5" stroke-dasharray="4 3"/><path d="M84 62 l4 6 2 -7" fill="none" stroke="#F59A1B" stroke-width="2.5"/><rect x="0" y="72" width="120" height="8" fill="#7FC3EE"/><circle cx="74" cy="29" r="2" fill="#002E6E"/>`;
  else if (id === 'coulee') g = WATER(20) + swimmerG(52, 48, 0) + `<path d="M14 58 h20 M10 50 h18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/><path d="M96 26 V74" stroke="#E8403B" stroke-width="2.5" stroke-dasharray="4 3"/><text x="98" y="36" font-size="11" font-weight="900" fill="#E8403B">5 m</text>`;
  else if (id === 'entree') g = WATER(46) + `<rect x="0" y="34" width="20" height="46" fill="#CFC6B8"/><path d="M14 32 Q50 0 76 44" fill="none" stroke="#F59A1B" stroke-width="2" stroke-dasharray="4 3"/>` + swimmerG(70, 40, 48) + `<path d="M78 46 l-6 -7 M84 46 l2 -9 M90 46 l7 -6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
  else if (id === 'virage') g = WATER(18) + `<rect x="104" y="18" width="16" height="62" fill="#CFC6B8"/>` + swimmerG(86, 44, 180, { legs:'tuck', arms:'side' }) + `<path d="M60 30 Q96 14 98 40 Q96 64 58 60" fill="none" stroke="#F59A1B" stroke-width="3"/><path d="M62 55 l-6 5 7 3" fill="none" stroke="#F59A1B" stroke-width="3"/>`;
  else if (id === 'immersion') g = WATER(18) + `<path d="M70 76 a14 14 0 0 1 28 0" fill="none" stroke="#222" stroke-width="3.5"/><rect x="0" y="76" width="120" height="4" fill="#7FC3EE"/>` + swimmerG(46, 40, 65, {});
  else if (id === 'remorquage') g = WATER(36) + `<g transform="translate(72 38) rotate(-8)"><rect x="-4" y="-6" width="30" height="12" rx="6" fill="#FFB300" stroke="#C77F00"/><circle cx="32" cy="-3" r="7" fill="#FFD54F" stroke="#C77F00"/></g>` + swimmerG(48, 42, 180, { arms:'side', kick:true });
  else g = WATER(30) + swimmerG(60, 33, 0, { arms:'stroke', kick:true });
  return `<svg class="sv-art" viewBox="0 0 120 80" style="width:${size * 1.5}px;height:${size}px" aria-hidden="true"><rect width="120" height="80" rx="10" fill="#EAF6FF"/>${g}</svg>`;
}
function pilCardHTML(P, big){
  return `<div class="card sv-pil"><div class="sv-pil-h">${pilArt(P.id, big ? 90 : 60)}<h3>${esc(P.n)}</h3></div>
    ${P.c ? `<h4>🏊 Ce que je dois faire</h4><ul class="sv-cont">${P.c.split('\n').filter(Boolean).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    <h4>👀 Ce que l'observateur regarde (oui / non, une fois par passage)</h4>
    <ol class="sv-crits">${P.cr.map(x => `<li><b>${esc(x.t)}</b>${x.o ? `<span>${esc(x.o)}</span>` : ''}</li>`).join('')}</ol></div>`;
}
function viewPdj(){
  const n = curLesson(), x = LP(n);
  setTop('📖 Piliers du jour', lessonLabel(n), backBtn());
  $('#main').innerHTML = `${x.obj ? `<div class="card"><div class="sv-eyebrow">Consignes de la leçon</div><p class="sv-obj">📌 ${esc(x.obj)}</p></div>` : ''}
    ${x.kind === 'test' ? `<div class="card sv-test">⏱️ <b>Test de vitesse de nage de sauveteur</b> : ${x.tdist} m sans obstacle (départ : ${esc(Store.ENTREES[Store.validEntree(x.tent)].label.toLowerCase())}). Ta vitesse devient ta cible pour les parcours.</div>` : ''}
    ${x.pil.length ? x.pil.map(pilier).filter(Boolean).map(P => pilCardHTML(P, true)).join('') : '<div class="card center muted">Pas de pilier pour cette leçon.</div>'}`;
}

/* =====================================================================
   10. Éditeur de parcours (repris de la V6.1, présenté avec le thème du socle)
   ===================================================================== */
let ED = null;
const T = Store.TYPES;
function openEditor(p, opts = {}){ ED = { draft:Store.clone(p), dirty:!!opts.isNew, toLesson:opts.toLesson || null, back:opts.back || 'parcours' }; go('editor'); }
function edNextId(){ return ED.draft.obstacles.flat().reduce((m, o) => Math.max(m, o.id), 0) + 1; }
function edRange(label, key, o, min, max){ return `<label class="sv-rg"><small>${label}</small><span><input type="range" min="${min}" max="${max}" step="1" value="${o[key]}" data-rg="${key}"><input type="number" min="${min}" max="${max}" step="1" value="${o[key]}" inputmode="numeric" data-rg="${key}"></span></label>`; }
function edWarn(){ const w = Store.warnings(ED.draft); return w.length ? w.map(x => `<li>${esc(x)}</li>`).join('') : (Store.countObstacles(ED.draft) ? '<li class="sv-ok">Parcours cohérent.</li>' : '<li>Ajoutez des obstacles dans les longueurs.</li>'); }
function edPreview(){ const cv = $('#ed-schema'); if (cv) Schema.render(cv, ED.draft, { theme:'light' }); const w = $('#ed-warn'); if (w) w.innerHTML = edWarn(); }
function viewEditor(){
  if (!ED) { UI.view = 'prof'; UI.profTab = 'parcours'; return render(); }
  const d = ED.draft;
  setTop('✎ ' + (d.name || 'Nouveau parcours'), 'Éditeur de parcours', `<button class="btn small" data-action="edCancel">✕ Annuler</button>`);
  $('#main').innerHTML = `<div class="sv-ed"><div class="sv-col">
      <div class="card"><label class="sv-lbl">Nom du parcours<input type="text" id="ed-name" maxlength="80" value="${esc(d.name)}" placeholder="ex. Niveau 2 — 2nde 4" style="width:100%"></label>
        <div class="form-row"><span>Longueurs de 25 m</span><span class="stepper"><button class="cbtn" data-action="edLen" data-d="-1" ${d.n <= 1 ? 'disabled' : ''}>−</button><b>${d.n}</b><button class="cbtn" data-action="edLen" data-d="1" ${d.n >= Store.MAX_LEN ? 'disabled' : ''}>+</button><span class="muted">${d.n * 25} m</span></span></div>
        <div class="form-row"><span>Entrée dans l'eau</span><span class="btn-row">${Store.ENTREE_ORDER.map(e => `<button class="btn small ${Store.validEntree(d.entree) === e ? 'primary' : ''}" data-action="edEntree" data-e="${e}">${esc(Store.ENTREES[e].short)}</button>`).join('')}</span></div></div>
      <div class="card"><canvas class="sv-schema" id="ed-schema"></canvas><ul class="sv-warn" id="ed-warn">${edWarn()}</ul></div>
      <div class="btn-row"><button class="btn green sv-big" data-action="edSave">✓ Enregistrer${ED.toLesson ? ' et ajouter à la leçon ' + ED.toLesson : ''}</button></div></div>
    <div class="sv-col">${d.obstacles.map((arr, i) => `<div class="card sv-len" data-li="${i}" style="--c:${PCOL[Math.floor(i / 2) % PCOL.length]}">
        <div class="sv-len-h"><span class="sv-lentag">${Store.lenLabel(i)}</span><span class="muted">${arr.length ? arr.length + ' obstacle' + (arr.length > 1 ? 's' : '') : 'Nage libre'} · ${i % 2 === 0 ? 'départ mur A →' : '← départ mur B'}</span></div>
        ${arr.map(o => { const ex = T[o.type].extra; return `<div class="sv-obsrow" data-id="${o.id}"><label class="sv-rg"><small>Obstacle</small><select data-k="type">${Store.TYPE_ORDER.map(t => `<option value="${t}" ${o.type === t ? 'selected' : ''}>${T[t].label}</option>`).join('')}</select></label>
          ${edRange('Placement (m)', 'dist', o, 0, 25)}${ex ? edRange(ex.label + ' (m)', ex.key, o, ex.key === 'depl' ? 1 : 0, 25) : '<span></span>'}
          <button class="btn small ghost" data-action="edDel" data-li="${i}" data-id="${o.id}" title="Supprimer">🗑</button></div>`; }).join('')}
        <button class="btn small ${arr.length >= Store.MAX_OBS_PER_LEN ? 'ghost' : ''}" data-action="edAdd" data-li="${i}" ${arr.length >= Store.MAX_OBS_PER_LEN ? 'disabled' : ''}>${arr.length >= Store.MAX_OBS_PER_LEN ? 'Maximum ' + Store.MAX_OBS_PER_LEN + ' obstacles' : '＋ Ajouter un obstacle'}</button></div>`).join('')}</div></div>`;
  requestAnimationFrame(edPreview);
  $('#ed-name').oninput = e => { d.name = e.target.value; ED.dirty = true; };
  $$('.sv-obsrow').forEach(row => {
    const li = +row.closest('.sv-len').dataset.li, o = d.obstacles[li].find(x => x.id === +row.dataset.id); if (!o) return;
    row.querySelector('[data-k="type"]').onchange = e => { o.type = e.target.value; delete o.depl; delete o.remorque; const ex = T[o.type].extra; if (ex) o[ex.key] = ex.def; ED.dirty = true; rerender(); };
    row.querySelectorAll('[data-rg]').forEach(inp => {
      inp.oninput = () => { let v = parseInt(inp.value, 10); if (!isFinite(v)) return; v = Math.max(+inp.min, Math.min(+inp.max, v)); o[inp.dataset.rg] = v;
        row.querySelectorAll(`[data-rg="${inp.dataset.rg}"]`).forEach(y => { if (y !== inp) y.value = v; }); ED.dirty = true; edPreview(); };
      inp.onchange = () => { const b = d.obstacles[li].map(x => x.id).join(); d.obstacles[li].sort((a, c) => a.dist - c.dist); if (b !== d.obstacles[li].map(x => x.id).join()) rerender(); };
    });
  });
}

/* =====================================================================
   11. Espace enseignant : bibliothèque, piliers, programmation de la leçon
   ===================================================================== */
PTABS.parcours = { n:'Bibliothèque de parcours', ico:'🗺️' };
PTABS.piliers = { n:'Piliers', ico:'🏛️' };
PTABS.svAnim = { n:'Parcours du jour', ico:'🏊' };
PTABS.svPdj = { n:'Piliers du jour', ico:'📖' };
PSECT[0][1].splice(PSECT[0][1].indexOf('lecons') + 1, 0, 'parcours', 'piliers');
PSECT[1][1].splice(1, 0, 'svAnim', 'svPdj');
PTABS.lecons.n = 'Paramètres du cycle · leçons';
/* QR d'accès à l'appli (tablettes qui ne l'ont pas encore) : interface enseignant uniquement */
PTABS.appQR = { n:'QR de l\'appli', ico:'📲' };
PSECT[1][1].splice(PSECT[1][1].indexOf('qr') + 1, 0, 'appQR');
function showAppQR(){
  if (!/^https?:/.test(location.protocol) || !window.qrcode) return modal(`<h2>📲 QR de l'appli</h2><p>Le QR d'accès n'est disponible que lorsque l'appli est ouverte depuis son adresse en ligne (La Forge, GitHub Pages…).</p><div class="btn-row spread"><span></span><button class="btn primary" data-x>Fermer</button></div>`).querySelector('[data-x]').onclick = closeModal;
  const qr = qrcode(0, 'M'); qr.addData(appURL()); qr.make();
  const m = modal(`<h2>📲 Installer l'appli sur une tablette</h2>
    <div class="center"><img src="${qr.createDataURL(10, 16)}" alt="QR d'accès à l'application" style="width:min(70vw,60vh,520px);height:auto;image-rendering:pixelated;border:3px solid var(--line);border-radius:16px;background:#fff"></div>
    <ol style="font-size:18px;line-height:1.5"><li>Sur la tablette, ouvrir l'appareil photo et viser ce QR.</li><li>Ouvrir le lien, puis <b>Partager → « Sur l'écran d'accueil »</b> (iPad) ou <b>⋮ → « Installer l'application »</b> (Android).</li><li>Lancer l'appli depuis l'écran d'accueil, choisir <b>Tablette élève</b>, puis <b>📷 Recevoir la leçon</b>.</li></ol>
    <div class="app-url center">${esc(appURL())}</div>
    <div class="btn-row spread" style="margin-top:12px"><button class="btn" data-l>📲 QR de la leçon →</button><button class="btn primary" data-x>Fermer</button></div>`, { wide:true });
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelector('[data-l]').onclick = () => { closeModal(); go('prof', { profTab:'qr' }); };
}
const _profQR = profQR;
profQR = function(){ return `<div class="card center"><b>Une tablette n'a pas encore l'appli ?</b> <button class="btn orange" data-action="tab" data-tab="appQR">📲 QR de l'appli</button></div>` + _profQR(); };

function profParcours(){
  const L = Store.library(), n = curLesson(), inL = id => LP(n).par.some(p => p.id === id);
  const card = (p, user) => `<div class="card sv-lib">${thumb(p)}<div><b>${esc(p.name)}</b><div class="muted small">${p.n} longueur${p.n > 1 ? 's' : ''} · ${esc(Store.summary(p))}</div></div>
    <div class="btn-row"><button class="btn small" data-action="svAnimLib" data-pid="${esc(p.id)}">▶ Voir</button>
      ${user ? `<button class="btn small" data-action="svEdit" data-pid="${esc(p.id)}">✎ Modifier</button>` : ''}<button class="btn small ghost" data-action="svDup" data-pid="${esc(p.id)}">⧉ Dupliquer</button>
      ${isTest(n) ? '' : `<button class="btn small ${inL(p.id) ? 'green' : 'primary'}" data-action="svToLesson" data-pid="${esc(p.id)}">${inL(p.id) ? '✓ Leçon ' + n : '＋ Leçon ' + n}</button>`}
      ${user ? `<button class="btn small ghost" data-action="svDelLib" data-pid="${esc(p.id)}">🗑</button>` : ''}</div></div>`;
  return `<div class="card"><div class="btn-row"><button class="btn primary" data-action="svNew">＋ Nouveau parcours</button>
      <label class="btn">📂 Importer (.json)<input type="file" id="sv-imp" accept=".json,application/json" multiple hidden></label>
      <button class="btn" data-action="svExport" ${L.user.length ? '' : 'disabled'}>💾 Exporter mes parcours</button></div>
    <p class="muted">Les parcours de la V6 présents sur cet appareil ont été repris automatiquement. Fichiers .json de la V4c / V5 / V6 acceptés.</p></div>
    <h3>Mes parcours</h3><div class="sv-libgrid">${L.user.map(p => card(p, true)).join('') || '<div class="card muted">Aucun parcours personnel pour l\'instant.</div>'}</div>
    <h3 style="margin-top:16px">Modèles</h3><div class="sv-libgrid">${L.builtins.map(p => card(p, false)).join('')}</div>`;
}
function profPiliers(){
  return `<div class="card"><p class="muted" style="margin:0">Un pilier = un nom, des contenus (ce que l'élève doit faire) et 3 critères avec leur observable (ce que l'observateur voit : oui / non). Les piliers programmés dans une leçon sont envoyés aux tablettes avec le QR de la leçon.</p></div>
    ${piliers().map(P => `<div class="sv-pilwrap">${pilCardHTML(P, false)}<div class="btn-row"><button class="btn small" data-action="svPilEdit" data-id="${P.id}">✎ Modifier</button>${pilStore()[P.id] ? `<button class="btn small ghost" data-action="svPilReset" data-id="${P.id}">↺ Texte par défaut</button>` : ''}</div></div>`).join('')}`;
}
function progHTML(){
  const n = curLesson(), x = LP(n), test = x.kind === 'test', st = sortedStudents();
  let h = `<div class="card sv-prog"><h3>Leçon ${n} · déroulement</h3>
    <div class="form-row"><span>Type de leçon</span><span class="btn-row"><button class="btn small ${!test ? 'primary' : ''}" data-action="svKind" data-k="parcours">🏊 Parcours</button><button class="btn small ${test ? 'primary' : ''}" data-action="svKind" data-k="test">⏱️ Test S1</button></span></div>
    ${test ? `<div class="form-row"><span>Distance du test</span><span class="btn-row">${TEST_DISTS.map(d => `<button class="btn small ${x.tdist === d ? 'primary' : ''}" data-action="svTdist" data-d="${d}">${d} m</button>`).join('')}</span></div>
      <div class="form-row"><span>Départ</span><span class="btn-row">${Store.ENTREE_ORDER.map(e => `<button class="btn small ${x.tent === e ? 'primary' : ''}" data-action="svTent" data-e="${e}">${esc(Store.ENTREES[e].short)}</button>`).join('')}</span></div>
      <p class="muted">Chaque élève nage ${x.tdist} m sans obstacle : sa vitesse devient sa <b>vitesse de nage de sauveteur</b>, c'est-à-dire sa cible sur les parcours des leçons suivantes.</p>
      <div class="btn-row"><button class="btn orange" data-action="svTestTargets">🎯 Vitesses de ce test → cibles</button></div>` : ''}
    <div class="form-row"><span>Objectif / consignes <small class="muted">(transmis aux tablettes)</small></span><button class="btn small" data-action="svObj">${esc(x.obj || '—')} ✎</button></div>
    <div><b>Piliers observés</b> <small class="muted">(l'observateur en choisit un à chaque passage)</small>
      <div class="sv-chips">${piliers().map(P => `<button class="chip ${x.pil.includes(P.id) ? 'on' : ''}" data-action="svPil" data-id="${P.id}">${esc(P.n)}</button>`).join('')}</div></div></div>`;
  if (!test) {
    h += `<div class="card"><div class="btn-row spread"><h3 style="margin:0">Parcours du jour</h3><span class="btn-row"><button class="btn small" data-action="svAddPar">＋ De la bibliothèque</button><button class="btn small primary" data-action="svNewPar">＋ Créer un parcours</button></span></div>
      ${x.par.length ? `<div class="sv-grid">${x.par.map((p, i) => `<div class="sv-pcard" style="--pc:${PCOL[i % PCOL.length]}">${thumb(p)}<b><span class="sv-pn">P${i + 1}</span> ${esc(p.name)}</b><small>${p.n * 25} m · ${esc(Store.summary(p))}</small>
        <small><b>${st.filter(s => x.asg[s.id] === p.id).length}</b> élève(s) attribué(s)</small><span class="btn-row"><button class="btn small" data-action="svAnimDay" data-i="${i}">▶ Voir</button><button class="btn small ghost" data-action="svRmPar" data-pid="${esc(p.id)}">✕ Retirer</button></span></div>`).join('')}</div>`
        : '<p class="muted">Aucun parcours : ajoutez-en un (sans parcours, les tablettes proposeront les modèles).</p>'}</div>`;
    if (x.par.length > 1 && st.length) h += `<div class="card"><h3>🧭 Qui fait quel parcours ?</h3><p class="muted">« Au choix » : le parcours se choisit au chrono. Sinon il se sélectionne tout seul pour l'élève.</p>
      <div class="btn-row"><b>Tout le monde :</b><button class="chip" data-action="svAsgAll" data-pid="">Au choix</button>${x.par.map((p, i) => `<button class="chip" data-action="svAsgAll" data-pid="${esc(p.id)}"><span class="dot" style="background:${PCOL[i % PCOL.length]}"></span>P${i + 1}</button>`).join('')}</div>
      <div class="sv-asg">${st.map(s => `<div class="sv-asg-r">${band(s.id).replace('class="band"', 'class="band inl"')}<span class="st-n">${esc(nameOf(s.id))}</span><span class="btn-row">
        <button class="chip ${!x.asg[s.id] ? 'on' : ''}" data-action="svAsg" data-sid="${s.id}" data-pid="">Au choix</button>${x.par.map((p, i) => `<button class="chip ${x.asg[s.id] === p.id ? 'on' : ''}" data-action="svAsg" data-sid="${s.id}" data-pid="${esc(p.id)}"><span class="dot" style="background:${PCOL[i % PCOL.length]}"></span>P${i + 1}</button>`).join('')}</span></div>`).join('')}</div></div>`;
  }
  return h;
}
const _profLecons = profLecons;
profLecons = function(){ return _profLecons().replace("Nombre d'essais par élève", 'Nombre de passages par élève').replace('<div class="card"><h3>Leçon en cours</h3>', '<div class="card"><h3>Leçon en cours <small class="muted">(⏱️ = Test S1)</small></h3>') + progHTML(); };
const _viewProf = viewProf;
viewProf = function(){ if (UI.profTab === 'parcours') return profParcours(); if (UI.profTab === 'piliers') return profPiliers(); return _viewProf(); };
const _afterProf = afterProf;
afterProf = function(){ _afterProf();
  const imp = $('#sv-imp'); if (imp) imp.onchange = async e => { const files = [...e.target.files]; e.target.value = ''; let ok = 0;
    for (const f of files) { try { const j = JSON.parse(await f.text()); (Array.isArray(j) ? j : [j]).forEach(it => { const p = Store.normalize(it); p.builtin = false; if (Store.findParcours(p.id)?.builtin) p.id = Store.uid(); Store.saveToLibrary(p); ok++; }); } catch(err){ toast('⚠️ Import impossible : ' + f.name); } }
    if (ok) { toast(`✓ ${ok} parcours importé(s)`); rerender(); } };
  // repère ⏱️ sur les leçons Test S1 dans les puces de leçon
  if (UI.profTab === 'lecons') $$('[data-action="setLesson"]').forEach(b => { if (isTest(+b.dataset.n) && !b.textContent.includes('⏱️')) b.insertAdjacentText('beforeend', ' ⏱️'); });
};

/* ---------- Accueil tablette élève : Parcours du jour / Piliers du jour ---------- */
const _viewHomeEleve = viewHomeEleve;
viewHomeEleve = function(){
  const h = _viewHomeEleve(); if (!S.students.length) return h;
  const add = `<div class="btn-row sv-home"><button class="btn primary" data-action="go" data-view="anim">🏊 Parcours du jour</button><button class="btn primary" data-action="go" data-view="pdj">📖 Piliers du jour</button></div>`;
  const i = h.indexOf('<button class="btn ghost small" data-action="unlock">');
  return i < 0 ? h + add : h.slice(0, i) + add + h.slice(i);
};

/* =====================================================================
   12. Affichage : vues ajoutées au socle
   ===================================================================== */
const VIEWS = { chrono:viewChrono, anim:viewAnim, pdj:viewPdj, editor:viewEditor };
const _render = render;
render = function(){
  THUMBS = {};
  const v = UI.view;
  if (v !== 'chrono') stopChrono();
  if (v !== 'anim') stopSim();
  if (VIEWS[v] && ROOT.role && !(v === 'editor' && !(isProf() && UI.profUnlocked))) { stopScan(); VIEWS[v](); paintThumbs(); return; }
  if (VIEWS[v]) UI.view = 'home';
  _render(); paintThumbs();
};

/* =====================================================================
   13. Actions (boutons data-action)
   ===================================================================== */
const _tab = ACT.tab;
const libP = id => Store.findParcours(id);
Object.assign(ACT, {
  tab: d => { UI.svBack = null; if (d.tab === 'appQR') return isProf() && UI.profUnlocked ? showAppQR() : null; if (d.tab === 'svAnim') { UI.svAnimList = null; UI.svAnimI = 0; return go('anim'); } if (d.tab === 'svPdj') return go('pdj'); return _tab(d); },
  go: d => { if (d.view === 'anim') { UI.svAnimList = null; UI.svAnimI = 0; } go(d.view); },
  svManual: () => { UI.svManual = !UI.svManual; rerender(); },
  svChrono: d => openChrono(d.sid, +d.k),
  svClose: async () => { if (CH && CH.s.taps.length && !CH.saved && !(await confirmBox('Quitter le chrono ?', 'Le passage en cours n\'est pas enregistré : il sera perdu.', 'Quitter', true))) return;
    const sid = CH ? CH.sid : null; CH = null; persistCH(); sid ? go('entry', { sid }) : go('saisie'); },
  svDone: () => { CH = null; persistCH(); go('saisie'); },
  svMore: () => { const o = CH, k = nextTry(o.n, o.sid); CH = null; openChrono(o.sid, k, { oid:o.oid, pi:o.pi, to:o.s.timeObstacles }); },
  svSwap: () => { const o = CH, k = nextTry(o.n, o.oid); CH = null;
    if (k == null) { toast(`Les passages de ${nameOf(o.oid)} sont déjà faits`); return go('entry', { sid:o.oid }); }
    UI.sid = o.oid; openChrono(o.oid, k, { oid:o.sid, pi:o.pi, to:o.s.timeObstacles }); },
  svPickObs: () => pickObserver(),
  svPickPar: async () => { if (!CH || CH.s.taps.length || CH.test) return; const p = await pickParcoursBox(CH.n, CH.s.parcours); if (!p || p.id === CH.s.parcours.id) return;
    const keep = { oid:CH.oid, pi:CH.pi, to:CH.s.timeObstacles }; newCH(CH.n, CH.sid, CH.k, p, keep); rerender(); },
  svOb: d => { const i = +d.i, v = +d.v; CH.ob[i] = CH.ob[i] === v ? null : v; CH.saved = false; if (navigator.vibrate) navigator.vibrate(15); persistCH(); rerender(); },
  svFault: d => { if (!CH) return; CH.s.faults = Math.max(0, CH.s.faults + (+d.d)); CH.saved = false; persistCH(); rerender(); },
  svUndo: () => { if (CH && Chrono.undo(CH.s)) { if (CH.dd) delete CH.dd[CH.s.taps.length]; CH.saved = false; persistCH(); rerender(); toast('Dernier top annulé'); } },
  svReset: async () => { if (!CH) return; if (CH.s.taps.length && !CH.saved && !(await confirmBox('Recommencer le passage ?', 'Les temps et les observations de ce passage seront effacés.', 'Recommencer', true))) return;
    newCH(CH.n, CH.sid, CH.k, CH.s.parcours, { oid:CH.oid, pi:CH.pi, to:CH.s.timeObstacles }); rerender(); },
  svSave: () => saveCH(),
  /* animation */
  svAnimI: d => { UI.svAnimI = +d.i; rerender(); },
  svSpeed: d => { UI.svSpeed = +d.v; Sim.setSpeed(UI.svSpeed); $$('[data-action="svSpeed"]').forEach(b => b.classList.toggle('on', +b.dataset.v === UI.svSpeed)); },
  svAnimLib: d => { const p = libP(d.pid); if (!p) return; UI.svAnimList = [p]; UI.svAnimI = 0; UI.svBack = 'parcours'; go('anim'); },
  svAnimDay: d => { UI.svAnimList = null; UI.svAnimI = +d.i; UI.svBack = 'lecons'; go('anim'); },
  /* bibliothèque */
  svNew: () => openEditor(Store.emptyParcours(4), { isNew:true, back:'parcours' }),
  svEdit: d => { const p = libP(d.pid); if (p) openEditor(p, { back:'parcours' }); },
  svDup: d => { const p = libP(d.pid); if (!p) return; const c = Store.clone(p); c.id = Store.uid(); c.builtin = false; c.name = p.name + ' (copie)'; openEditor(c, { isNew:true, back:'parcours' }); },
  svDelLib: async d => { const p = libP(d.pid); if (p && await confirmBox('Supprimer ce parcours ?', `« ${esc(p.name)} » sera retiré de la bibliothèque (les leçons qui l'utilisent gardent leur copie).`, 'Supprimer', true)) { Store.deleteFromLibrary(p.id); rerender(); } },
  svExport: () => downloadJSON(Store.library().user.map(Store.toExchange), `Sauvetage-parcours-${new Date().toISOString().slice(0, 10)}.json`),
  svToLesson: d => { const n = curLesson(), x = LP(n), p = libP(d.pid); if (!p) return;
    if (x.par.some(q => q.id === p.id)) { x.par = x.par.filter(q => q.id !== p.id); Object.keys(x.asg).forEach(k => { if (x.asg[k] === p.id) delete x.asg[k]; }); }
    else { const c = Store.clone(p); c.builtin = false; x.par.push(c); toast(`✓ Ajouté à la leçon ${n}`); }
    save(); rerender(); },
  /* piliers */
  svPilEdit: d => { const P = pilier(d.id); if (!P) return;
    const m = modal(`<h2>✎ Pilier</h2><label class="sv-lbl">Nom<input id="pe-n" value="${esc(P.n)}" style="width:100%"></label>
      <label class="sv-lbl">Contenus (une ligne par contenu)<textarea id="pe-c" rows="4" style="width:100%">${esc(P.c || '')}</textarea></label>
      ${P.cr.map((c, i) => `<div class="sv-pe"><b>Critère ${i + 1}</b><input id="pe-t${i}" value="${esc(c.t)}" placeholder="Critère" style="width:100%"><input id="pe-o${i}" value="${esc(c.o || '')}" placeholder="Observable (ce que l'observateur voit)" style="width:100%"></div>`).join('')}
      <div class="btn-row spread" style="margin-top:12px"><button class="btn ghost" data-x>Annuler</button><button class="btn primary" data-ok>Enregistrer</button></div>`, { wide:true });
    m.querySelector('[data-x]').onclick = closeModal;
    m.querySelector('[data-ok]').onclick = () => { const v = id => m.querySelector('#' + id).value.trim();
      pilStore()[P.id] = { n:v('pe-n') || P.n, c:v('pe-c'), cr:[0, 1, 2].map(i => ({ t:v('pe-t' + i) || ('Critère ' + (i + 1)), o:v('pe-o' + i) })) };
      applyPiliers(); save(); closeModal(); rerender(); }; },
  svPilReset: d => { delete pilStore()[d.id]; applyPiliers(); save(); rerender(); },
  /* programmation de la leçon */
  svKind: d => { LP(curLesson()).kind = d.k; save(); rerender(); },
  svTdist: d => { LP(curLesson()).tdist = +d.d; save(); rerender(); },
  svTent: d => { LP(curLesson()).tent = d.e; save(); rerender(); },
  svObj: async () => { const x = LP(curLesson()), t = await textBox('Objectif / consignes de la leçon ' + curLesson(), x.obj); if (t == null) return; x.obj = t.slice(0, 200); save(); rerender(); },
  svPil: d => { const x = LP(curLesson()); x.pil = x.pil.includes(d.id) ? x.pil.filter(i => i !== d.id) : [...x.pil, d.id]; save(); rerender(); },
  svAddPar: async () => { const n = curLesson(), lib = Store.library(), pool = [...lib.user, ...lib.builtins];
    const m = modal(`<h2>＋ Parcours de la bibliothèque · leçon ${n}</h2><div class="sv-grid">${pool.map((p, i) => `<button class="sv-pcard ${LP(n).par.some(q => q.id === p.id) ? 'on' : ''}" data-i="${i}" style="--pc:#0062C4">${thumb(p)}<b>${esc(p.name)}</b><small>${p.n * 25} m · ${esc(Store.summary(p))}</small></button>`).join('')}</div>
      <div class="btn-row spread" style="margin-top:12px"><span></span><button class="btn ghost" data-x>Fermer</button></div>`, { wide:true });
    paintThumbs(); m.querySelector('[data-x]').onclick = () => { closeModal(); rerender(); };
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const p = pool[+b.dataset.i], x = LP(n); if (!x.par.some(q => q.id === p.id)) { const c = Store.clone(p); c.builtin = false; x.par.push(c); save(); } b.classList.add('on'); toast('✓ ' + p.name); }); },
  svNewPar: () => openEditor(Store.emptyParcours(4), { isNew:true, toLesson:curLesson(), back:'lecons' }),
  svRmPar: d => { const x = LP(curLesson()); x.par = x.par.filter(p => p.id !== d.pid); Object.keys(x.asg).forEach(k => { if (x.asg[k] === d.pid) delete x.asg[k]; }); save(); rerender(); },
  svAsg: d => { const x = LP(curLesson()); if (d.pid) x.asg[d.sid] = d.pid; else delete x.asg[d.sid]; save(); rerender(); },
  svAsgAll: d => { const x = LP(curLesson()); S.students.forEach(s => { if (d.pid) x.asg[s.id] = d.pid; else delete x.asg[s.id]; }); save(); rerender(); },
  svTestTargets: async () => { const n = curLesson(), f = fieldById('vit');
    const best = sid => { const a = vals(Array.from({ length:tries(n) }, (_, j) => rawVal(n, sid, f, j))); return a.length ? Math.max(...a) : null; };
    const got = S.students.filter(s => best(s.id) != null);
    if (!got.length) return toast('Aucune vitesse mesurée pour cette leçon (récupérez d\'abord les saisies)');
    if (!(await confirmBox('Mettre à jour les cibles ?', `${got.length} élève(s) : la meilleure vitesse du test de la leçon ${n} devient la cible (vitesse de nage de sauveteur).`, 'Mettre à jour'))) return;
    got.forEach(s => { (S.targets[s.id] = S.targets[s.id] || {}).vit = r10(best(s.id), 2); }); save(); rerender(); toast(`✓ ${got.length} cible(s) mise(s) à jour`); },
  /* éditeur */
  edLen: async d => { const x = ED.draft;
    if (+d.d > 0) { if (x.n >= Store.MAX_LEN) return; x.n++; x.obstacles.push([]); }
    else { if (x.n <= 1) return; const lost = x.obstacles[x.n - 1].length; if (lost && !(await confirmBox('Retirer la dernière longueur ?', `${Store.lenLabel(x.n - 1)} contient ${lost} obstacle(s) qui seront supprimés.`, 'Retirer', true))) return; x.n--; x.obstacles.pop(); }
    ED.dirty = true; rerender(); },
  edEntree: d => { ED.draft.entree = d.e; ED.dirty = true; rerender(); },
  edAdd: d => { const arr = ED.draft.obstacles[+d.li]; if (arr.length >= Store.MAX_OBS_PER_LEN) return; const last = arr.length ? Math.max(...arr.map(o => o.dist + (o.depl || 0))) : 5;
    arr.push({ id:edNextId(), type:'cerceau', dist:Math.min(22, arr.length ? last + 4 : 10) }); ED.dirty = true; rerender(); },
  edDel: d => { const li = +d.li; ED.draft.obstacles[li] = ED.draft.obstacles[li].filter(o => o.id !== +d.id); ED.dirty = true; rerender(); },
  edCancel: async () => { if (ED && ED.dirty && !(await confirmBox('Quitter sans enregistrer ?', 'Les modifications de ce parcours seront perdues.', 'Quitter', true))) return; const b = ED ? ED.back : 'parcours'; ED = null; go('prof', { profTab:b }); },
  edSave: async () => { const x = ED.draft; let name = (x.name || '').trim();
    if (!name) { name = await textBox('Nom du parcours', ''); if (!name) return; }
    if (Store.nameExists(name, x.id) && !(await confirmBox('Nom déjà utilisé', `Un autre parcours s'appelle déjà « ${esc(name)} ». Enregistrer quand même ?`, 'Enregistrer'))) return;
    x.name = name; x.obstacles.forEach(a => a.sort((p, q) => p.dist - q.dist));
    const saved = Store.normalize(Store.saveToLibrary(x));
    if (ED.toLesson) { const L = LP(ED.toLesson), c = Store.clone(saved); c.builtin = false; const i = L.par.findIndex(p => p.id === c.id); if (i >= 0) L.par[i] = c; else L.par.push(c); save(); }
    // les leçons qui utilisent ce parcours gardent leur copie : on propose de la mettre à jour pour la leçon en cours
    else { const L = LP(curLesson()), i = L.par.findIndex(p => p.id === saved.id); if (i >= 0) { const c = Store.clone(saved); c.builtin = false; L.par[i] = c; save(); } }
    toast('✓ Parcours enregistré'); const b = ED.back; ED = null; go('prof', { profTab:b }); },
});

/* =====================================================================
   14. Démarrage (après celui du socle)
   ===================================================================== */
window.addEventListener('DOMContentLoaded', () => { applyPiliers(); rerender(); });

})();
