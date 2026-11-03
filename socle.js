/* =====================================================================
   Moteur N'EPS numérique — appli générée par la Fabrique N'EPS
   Socle commun (Biathlon, Musculation) : PWA hors-ligne, données sur
   l'appareil (localStorage), échanges tablette enseignant ↔ tablettes
   élèves par QR codes (Base45 + compression, série de QR qui défile).
   L'activité (saisies, cibles, rôles, barème) est décrite dans config.js.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   Configuration de l'activité (config.js → window.APP_CONFIG)
   --------------------------------------------------------------------- */
function normConfig(c){
  const frFn = ((c || {}).filsRouges || []).map(fr => fr && fr.regle && fr.regle.calcul);   // fonctions perdues par la copie JSON
  c = JSON.parse(JSON.stringify(c || {}));
  c.id = c.id || 'demo'; c.name = c.name || 'Mon appli'; c.short = c.short || c.name; c.sub = c.sub || '';
  c.author = c.author || ''; c.color = c.color || '#0062C4'; c.accent = c.accent || '#F59A1B'; c.version = c.version || '1.0.0';
  c.lessons = Math.max(1, +c.lessons || 10); c.attempts = Math.max(1, +c.attempts || 1); c.maxGroups = Math.min(12, Math.max(1, +c.maxGroups || 12));
  c.fields = (c.fields || []).map((f, i) => ({
    id: f.id || ('f' + (i + 1)), code: f.code ? String(f.code).toUpperCase() : '', label: f.label || ('Saisie ' + (i + 1)),
    type: f.type || 'counter', per: f.per || 'try', agg: f.agg || (f.type === 'criteres' ? 'mean' : 'best'), better: f.better || (f.type === 'chrono' ? 'low' : 'high'),
    target: !!f.target, unit: f.unit || (f.type === 'chrono' ? 's' : ''), min: +(f.min ?? 0), max: +(f.max ?? 10), step: +(f.step || 1),
    opts: (f.opts || []).map((o, k) => ({ l: o.l || ('Choix ' + (k + 1)), v: o.v != null && o.v !== '' ? +o.v : k + 1, c: o.c || '#0062C4' })),
    labels: f.labels || [], criteres: (f.criteres || []).filter(Boolean), formula: f.formula || '', dec: f.dec != null ? +f.dec : 1, help: f.help || '', show: f.show !== false }));
  // les calculs désignent les saisies par {identifiant} : remplacés ici par des codes internes
  c.fields.forEach((f, i) => { if (!f.code || f.code.length > 3) f.code = 'V' + (i + 1); });
  c.fields.forEach(f => { if (f.formula) f.formula = f.formula.replace(/\{([^}]+)\}/g, (m, id) => { const x = c.fields.find(y => y.id === id); return x ? x.code : 'INCONNU'; }); });
  c.mode = c.mode === 'seance' ? 'seance' : 'cycle'; if (c.mode === 'seance') c.lessons = 1;
  c.tools = c.tools || {}; Object.keys(c.tools).forEach(k => { if (c.tools[k] && c.tools[k].on === false) delete c.tools[k]; });
  c.roles = (c.roles || []).filter(r => r && r.n); c.rotate = c.rotate !== false;
  c.sexe = c.sexe !== false;                       // colonne F / G (mixité des groupes)
  c.filsRouges = (c.filsRouges || []).map((fr, i) => ({ id: fr.id || ('FR' + (i + 1)), nom: fr.nom || 'Fil rouge', ico: fr.ico || '🧶', couleur: fr.couleur || (i ? '#1E5FD8' : '#D0161B'),
    explication: fr.explication || '', eleve: fr.eleve !== false, regle: { ...(fr.regle || { type:'prof' }), ...(frFn[i] ? { calcul: frFn[i] } : {}) } }));
  c.grade = c.grade || {}; c.grade.on = !!c.grade.on; c.grade.total = +c.grade.total || 20;
  c.grade.items = (c.grade.items || []).map(it => ({ field: it.field, from: it.from || 'best', pts: +it.pts || 0, label: it.label || '',
    table: (it.table || []).map(r => [+r[0], +r[1]]).filter(r => isFinite(r[0]) && isFinite(r[1])).sort((a, b) => a[0] - b[0]) }));
  return c;
}
const CFG = normConfig(window.APP_CONFIG);
const PREVIEW = /[?&]preview=1/.test(location.search);
const APP_VERSION = CFG.version;
let ICON = 'icons/icon-512.png';
try { if (PREVIEW && localStorage.getItem('fabrique_preview_icon')) ICON = localStorage.getItem('fabrique_preview_icon'); } catch(e){}
const ROOT_KEY = (PREVIEW ? 'neps_prev_' : 'neps_app_') + CFG.id;
const QR_PFX = 'NE';
const QR_CHUNK = 440;           // caractères base45 par QR
const FIELDS = CFG.fields;
const SEANCE = CFG.mode === 'seance';
const TOOLS_ON = CFG.tools;
const INPUTS = FIELDS.filter(f => f.type !== 'calc');
const fieldById = id => FIELDS.find(f => f.id === id) || null;

/* ---------------------------------------------------------------------
   Outils
   --------------------------------------------------------------------- */
function rnd(n){ const a='abcdefghijkmnpqrstuvwxyz23456789'; let s=''; for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => Date.now();
const avg = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : null;
const vals = a => (a || []).filter(x => x != null && isFinite(x));
const r10 = (v, d=1) => v == null ? null : Math.round(v * 10 ** d) / 10 ** d;
function fmtN(v, d=1){ if (v == null || !isFinite(v)) return '—'; return String(r10(v, d)).replace('.', ','); }
function fmtChrono(v){ if (v == null || !isFinite(v)) return '—'; const neg = v < 0; v = Math.abs(v);
  const m = Math.floor(v / 60), s = v - m * 60; const ss = s.toFixed(2).replace('.', ',');
  return (neg ? '−' : '') + (m ? `${m}:${s < 10 ? '0' : ''}${ss}` : ss + ' s'); }
function fmtF(f, v){
  if (v == null || !isFinite(v)) return '—';
  if (f.type === 'chrono') return fmtChrono(v);
  if (f.type === 'criteres') return Math.round(v) + ' %';
  if (f.type === 'choice') { const o = f.opts.find(o => o.v === v); if (o) return o.l; }
  if (f.type === 'scale' && f.labels[v - f.min]) return `${fmtN(v, 0)} · ${f.labels[v - f.min]}`;
  return fmtN(v, f.dec) + (f.unit ? ' ' + f.unit : '');
}
function toast(msg, ms=2200){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'), ms); }
function capName(s){ return String(s||'').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m,a,b)=>a+b.toUpperCase()).trim(); }
function modal(html, {wide}={}){
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal ${wide?'wide':''}">${html}</div></div>`;
  return root.querySelector('.modal');
}
function closeModal(){ stopScan(); $('#modal-root').innerHTML=''; }
function confirmBox(title, text, okLabel='Valider', danger=false){
  return new Promise(res => { const m = modal(`<h2>${title}</h2><p>${text}</p><div class="btn-row spread"><button class="btn ghost" data-c="0">Annuler</button><button class="btn ${danger?'red':'primary'}" data-c="1">${okLabel}</button></div>`);
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { closeModal(); res(b.dataset.c === '1'); }); });
}
function choiceBox(title, text, choices){
  return new Promise(res => { const m = modal(`<h2>${title}</h2><p>${text}</p><div class="btn-row">${choices.map((c,i)=>`<button class="btn ${c.cls||''}" data-c="${i}">${c.label}</button>`).join('')}<button class="btn ghost" data-c="x">Annuler</button></div>`);
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { closeModal(); res(b.dataset.c === 'x' ? null : choices[+b.dataset.c].value); }); });
}
function numberBox(title, value, {step=1, min=-1e9, max=1e9, unit=''}={}){
  return new Promise(res => {
    const m = modal(`<h2>${title}</h2><div class="row"><input id="nb-in" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${value ?? ''}" class="big-input"> <b>${esc(unit)}</b></div>
      <div class="btn-row spread" style="margin-top:14px"><button class="btn ghost" data-c="x">Annuler</button><button class="btn ghost" data-c="clr">Effacer</button><button class="btn primary" data-c="ok">Valider</button></div>`);
    const inp = m.querySelector('#nb-in'); setTimeout(() => inp.focus(), 50);
    const done = v => { closeModal(); res(v); };
    m.querySelector('[data-c="x"]').onclick = () => done(undefined);
    m.querySelector('[data-c="clr"]').onclick = () => done(null);
    m.querySelector('[data-c="ok"]').onclick = () => { const v = parseFloat(String(inp.value).replace(',', '.')); done(isFinite(v) ? Math.max(min, Math.min(max, v)) : null); };
    inp.onkeydown = e => { if (e.key === 'Enter') m.querySelector('[data-c="ok"]').click(); };
  });
}
function textBox(title, value){
  return new Promise(res => {
    const m = modal(`<h2>${title}</h2><input id="tb-in" type="text" value="${esc(value||'')}" class="big-input" style="width:100%">
      <div class="btn-row spread" style="margin-top:14px"><button class="btn ghost" data-c="x">Annuler</button><button class="btn primary" data-c="ok">Valider</button></div>`);
    const inp = m.querySelector('#tb-in'); setTimeout(() => inp.focus(), 50);
    m.querySelector('[data-c="x"]').onclick = () => { closeModal(); res(null); };
    m.querySelector('[data-c="ok"]').onclick = () => { closeModal(); res(inp.value.trim()); };
    inp.onkeydown = e => { if (e.key === 'Enter') m.querySelector('[data-c="ok"]').click(); };
  });
}

/* ---------------------------------------------------------------------
   Formules (champs calculés) : A + B, (A - B) / 2, MAX(A;B), ARRONDI(A;1)…
   Les lettres sont les codes des saisies ; ; sépare les arguments ; , ou . pour les décimales.
   --------------------------------------------------------------------- */
const FCACHE = {};
const FN = { MIN:Math.min, MAX:Math.max, ABS:Math.abs, RACINE:Math.sqrt, MOY:(...a) => a.reduce((p,q)=>p+q,0)/a.length,
  ARRONDI:(x, d=0) => Math.round(x * 10**d) / 10**d, SI:(c, a, b) => c ? a : b };
function compileF(src){
  if (FCACHE[src]) return FCACHE[src];
  const T = String(src).match(/\d+(?:[.,]\d+)?|[A-Za-z_]\w*|>=|<=|[-+*/^();<>=]/g) || [];
  let i = 0; const pk = () => T[i], nx = () => T[i++];
  const CMP = { '>':(a,b)=>+(a>b), '<':(a,b)=>+(a<b), '>=':(a,b)=>+(a>=b), '<=':(a,b)=>+(a<=b), '=':(a,b)=>+(a===b) };
  function C(){ let a = E(); while (CMP[pk()]) { const f = CMP[nx()], b = E(), x = a; a = s => f(x(s), b(s)); } return a; }
  function E(){ let a = Tm(); while (pk() === '+' || pk() === '-') { const o = nx(), b = Tm(), x = a; a = o === '+' ? s => x(s) + b(s) : s => x(s) - b(s); } return a; }
  function Tm(){ let a = P(); while (pk() === '*' || pk() === '/') { const o = nx(), b = P(), x = a; a = o === '*' ? s => x(s) * b(s) : s => x(s) / b(s); } return a; }
  function P(){ const a = U(); if (pk() === '^') { nx(); const b = P(); return s => a(s) ** b(s); } return a; }
  function U(){ if (pk() === '-') { nx(); const a = U(); return s => -a(s); } if (pk() === '+') { nx(); return U(); } return A(); }
  function A(){
    const t = nx(); if (t == null) throw new Error('formule incomplète');
    if (t === '(') { const e = C(); if (nx() !== ')') throw new Error('parenthèse manquante'); return e; }
    if (/^\d/.test(t)) { const v = parseFloat(t.replace(',', '.')); return () => v; }
    if (/^[A-Za-z_]/.test(t)) { const u = t.toUpperCase();
      if (pk() === '(') { nx(); const f = FN[u]; if (!f) throw new Error('fonction inconnue : ' + t);
        const args = []; if (pk() !== ')') { args.push(C()); while (pk() === ';') { nx(); args.push(C()); } }
        if (nx() !== ')') throw new Error('parenthèse manquante'); return s => f(...args.map(g => g(s))); }
      return s => (s[u] == null ? NaN : s[u]); }
    throw new Error('symbole inattendu : ' + t);
  }
  const f = C(); if (i < T.length) throw new Error('symbole inattendu : ' + T[i]);
  return FCACHE[src] = f;
}
function evalF(src, scope){ try { const v = compileF(src)(scope); return isFinite(v) ? v : null; } catch(e){ return null; } }

/* ---------------------------------------------------------------------
   État : ROOT = { deviceId, pin, role, active, classes:{}, grp }
   S = classe active = { id, settings, students, lessons, results, targets, hist }
   --------------------------------------------------------------------- */
const COLORS = [
  {k:'rouge', n:'Rouge', c:'#E3262B'}, {k:'bleu', n:'Bleu', c:'#1E5FD8'}, {k:'jaune', n:'Jaune', c:'#FFD400'}, {k:'vert', n:'Vert', c:'#1FA24A'},
  {k:'orange', n:'Orange', c:'#FF7A00'}, {k:'violet', n:'Violet', c:'#8A2BE2'}, {k:'rose', n:'Rose', c:'#FF4FA3'}, {k:'blanc', n:'Blanc', c:'#FFFFFF'},
  {k:'noir', n:'Noir', c:'#1A1A1A'}, {k:'cyan', n:'Cyan', c:'#00B8D9'}, {k:'marron', n:'Marron', c:'#8B5A2B'}, {k:'gris', n:'Gris', c:'#8A94A6'} ];
const DEFAULT_SETTINGS = { nbLessons: CFG.lessons, current:1, className:'', nbGroups:1 };
const noteOf = (n, sid) => S.notes?.[n]?.[sid] || '';
function newClassState(name, id){
  return { id: id || rnd(4), settings:{ ...DEFAULT_SETTINGS, className: name || '' }, students:[], lessons:{}, results:{}, targets:{}, hist:{}, notes:{} };
}
function normClass(c){
  c.settings = { ...DEFAULT_SETTINGS, ...(c.settings || {}) };
  ['students','lessons','results','targets','hist','notes','comp','frl'].forEach(k => { if (!c[k]) c[k] = (k === 'students' ? [] : {}); });
  c.students.forEach(x => { if (x.grp == null) x.grp = 0; });
  if (SEANCE) { c.settings.nbLessons = 1; c.settings.current = 1; }
  return c;
}
let ROOT, S;
function loadRoot(){
  try { ROOT = JSON.parse(localStorage.getItem(ROOT_KEY)); } catch(e){ ROOT = null; }
  if (!ROOT || !ROOT.classes) ROOT = { v:1, deviceId: rnd(4), pin:'0000', role:null, active:null, classes:{}, grp:null };
  if (!ROOT.deviceId) ROOT.deviceId = rnd(4);
  if (!ROOT.pin) ROOT.pin = '0000';
  Object.values(ROOT.classes).forEach(normClass);
  if (!Object.keys(ROOT.classes).length) { const c = newClassState('Classe 1'); ROOT.classes[c.id] = c; }
  if (!ROOT.classes[ROOT.active]) ROOT.active = Object.keys(ROOT.classes)[0];
  useClass(ROOT.active);
}
function useClass(id){ ROOT.active = id; S = ROOT.classes[id]; computeNames(); }
const className = c => (c || S).settings.className || 'Classe';
function save(){
  try { localStorage.setItem(ROOT_KEY, JSON.stringify(ROOT)); }
  catch(e){ toast('⚠️ Enregistrement impossible sur cet appareil'); }
  computeNames();
}
const UI = { view:'home', profTab:'menu', profUnlocked:false, sid:null, resL:null, ciblesL:null };
const isProf = () => ROOT.role === 'prof';

/* Noms affichés : « Prénom N. » (nom complet si deux prénoms identiques) */
let NAMES = {};
function computeNames(){
  NAMES = {}; if (!S) return;
  const byP = {}; S.students.forEach(s => { const p = (s.prenom || '').toLowerCase(); byP[p] = (byP[p] || 0) + 1; });
  S.students.forEach(s => { NAMES[s.id] = s.disp || (s.prenom ? (byP[(s.prenom||'').toLowerCase()] > 1 ? `${s.prenom} ${s.nom}` : `${s.prenom} ${(s.nom||'')[0] || ''}.`) : (s.nom || '?')); });
}
const nameOf = sid => NAMES[sid] || '?';
const student = sid => S.students.find(s => s.id === sid) || null;
function sortedStudents(){ return [...S.students].sort((a,b) => nameOf(a.id).localeCompare(nameOf(b.id), 'fr')); }
function newStudentId(){ let id; do { id = rnd(4); } while (S.students.some(s => s.id === id)); return id; }
const nbGroups = () => Math.min(CFG.maxGroups, S.settings.nbGroups || 1);
const groupColor = g => COLORS[g] || COLORS[0];
const curLesson = () => S.settings.current || 1;

/* ---------------------------------------------------------------------
   Leçons, présence, saisies
   --------------------------------------------------------------------- */
function lesson(n){
  const L = S.lessons[n] = S.lessons[n] || {};
  if (!L.att) L.att = {}; if (!L.role) L.role = {}; if (L.shift == null) L.shift = 0;
  if (!L.tries) L.tries = CFG.attempts; if (L.title == null) L.title = ''; if (L.ev == null) L.ev = false;
  return L;
}
const tries = n => lesson(n).tries || CFG.attempts;
const lessonLabel = n => SEANCE ? `Séance${lesson(n).title ? ' · ' + lesson(n).title : ''}` : `Leçon ${n}${lesson(n).title ? ' · ' + lesson(n).title : ''}${lesson(n).ev ? ' · 📝 évaluation' : ''}`;
const LECON = SEANCE ? 'séance' : 'leçon';
const ATT = { 1:{ n:'Absent', cls:'abs', ico:'✖' }, 2:{ n:'Dispensé', cls:'disp', ico:'🩹' }, 3:{ n:'Inapte partiel', cls:'inap', ico:'⚠️' }, 4:{ n:'Sans tenue', cls:'tenue', ico:'👕' } };
const isOff = a => a === 1 || a === 2;
const attOf = (n, sid) => lesson(n).att[sid] || 0;
function res(n, sid){ return (S.results[n] && S.results[n][sid]) || null; }
function setRes(n, sid, fn){
  S.results[n] = S.results[n] || {};
  const r = S.results[n][sid] = S.results[n][sid] || { v:{} };
  fn(r); r.ts = now(); r.d = ROOT.deviceId; save();
}
function setVal(n, sid, f, k, v){
  setRes(n, sid, r => {
    if (f.per === 'try') { const a = r.v[f.id] = r.v[f.id] || []; while (a.length < tries(n)) a.push(null); a[k] = v; }
    else r.v[f.id] = v;
  });
}
/* Critères observés : tableau [1 validé | 0 non validé | null non observé] → % de critères validés */
const critPct = a => { if (!Array.isArray(a)) return a ?? null; const o = a.filter(x => x != null); return o.length ? o.filter(x => x).length / o.length * 100 : null; };
const critFull = a => Array.isArray(a) && a.length > 0 && a.every(x => x != null);
function rawVal(n, sid, f, k){ const v = res(n, sid)?.v?.[f.id]; if (f.per === 'try') return v ? (v[k] ?? null) : null; return v ?? null; }

/* Agrégation des tentatives d'une leçon */
function aggF(f, arr){
  const a = vals(arr); if (!a.length) return null;
  switch (f.agg) {
    case 'mean': return avg(a);
    case 'last': return a[a.length - 1];
    case 'sum': return a.reduce((p, q) => p + q, 0);
    case 'first': return a[0];
    default: return f.better === 'low' ? Math.min(...a) : Math.max(...a);
  }
}
const AGG_N = { best:'meilleure', mean:'moyenne', last:'dernière', sum:'total', first:'première' };

/* Valeurs d'un élève pour une leçon : t = par tentative, L = valeur de la leçon (champs calculés compris) */
function calcAll(n, sid){
  const k = tries(n), t = Array.from({ length:k }, () => ({})), L = {}, sT = t.map(() => ({})), sL = {};
  INPUTS.forEach(f => {
    const cv = x => f.type === 'criteres' ? critPct(x) : x;
    if (f.per === 'try') { const a = Array.from({ length:k }, (_, j) => cv(rawVal(n, sid, f, j))); a.forEach((v, j) => { t[j][f.id] = v; sT[j][f.code] = v; }); L[f.id] = aggF(f, a); }
    else L[f.id] = cv(rawVal(n, sid, f));
    sL[f.code] = L[f.id];
  });
  FIELDS.filter(f => f.type === 'calc').forEach(f => {
    if (f.per === 'try') { const a = t.map((o, j) => { const v = evalF(f.formula, { ...sL, ...sT[j] }); o[f.id] = v; sT[j][f.code] = v; return v; }); L[f.id] = aggF(f, a); }
    else L[f.id] = evalF(f.formula, sL);
    sL[f.code] = L[f.id];
  });
  return { t, L };
}
/* valeur de la leçon (saisies locales, sinon historique reçu du prof) */
function lessonVal(n, sid, f){
  if (res(n, sid)) return calcAll(n, sid).L[f.id];
  const h = S.hist?.[sid]?.[n]; if (h) { const i = FIELDS.indexOf(f); return h[i] ?? null; }
  return null;
}
function hasData(n, sid){ return !!res(n, sid) || !!S.hist?.[sid]?.[n]; }
function entryDone(n, sid){
  const r = res(n, sid); if (!r) return false;
  const ok = (f, v) => f.type === 'criteres' ? critFull(v) : v != null;
  return INPUTS.every(f => f.per === 'try' ? Array.from({ length:tries(n) }, (_, j) => rawVal(n, sid, f, j)).every(v => ok(f, v)) : ok(f, rawVal(n, sid, f)));
}
function entryStarted(n, sid){ const r = res(n, sid); return !!r && INPUTS.some(f => { const v = r.v[f.id]; return Array.isArray(v) ? v.some(x => x != null) : v != null; }); }

/* ---------------------------------------------------------------------
   Cibles et écarts (échelle de 7 couleurs, comme dans Biathlon)
   --------------------------------------------------------------------- */
const TFIELDS = FIELDS.filter(f => f.target);
const targetOf = (sid, f) => S.targets?.[sid]?.[f.id] ?? null;
function fieldRange(f){
  if (f.type === 'criteres') return 100;
  if (['dial','counter','scale','number'].includes(f.type) && f.max > f.min) return f.max - f.min;
  if (f.type === 'choice' && f.opts.length > 1) { const v = f.opts.map(o => o.v); return Math.max(...v) - Math.min(...v); }
  return null;
}
const GAP7 = [{c:'#0B4F1C',f:'#fff',n:'Très au-dessus'},{c:'#1E8E3E',f:'#fff',n:'Au-dessus'},{c:'#3FB65C',f:'#fff',n:'Cible atteinte'},
  {c:'#C8D93A',f:'#0A1633',n:'Tout près'},{c:'#FFD000',f:'#0A1633',n:'Un peu en dessous'},{c:'#F07000',f:'#fff',n:'En dessous'},{c:'#D0161B',f:'#fff',n:'Très en dessous'}];
function gapIdx(f, v, t){
  if (v == null || t == null) return -1;
  const r = fieldRange(f) || Math.abs(t) || 1; let g = (v - t) / r; if (f.better === 'low') g = -g;
  return g >= .15 ? 0 : g >= .05 ? 1 : g >= -1e-9 ? 2 : g >= -.05 ? 3 : g >= -.15 ? 4 : g >= -.3 ? 5 : 6;
}
function gapCell(f, v, t){ const i = gapIdx(f, v, t); return i < 0 ? '' : `style="background:${GAP7[i].c};color:${GAP7[i].f}"`; }
const reached = (f, v, t) => v != null && t != null && (f.better === 'low' ? v <= t : v >= t);

/* ---------------------------------------------------------------------
   Rôles (rotation dans chaque groupe, leçon après leçon)
   --------------------------------------------------------------------- */
function roleIdx(n, sid){
  if (!CFG.roles.length) return null;
  const L = lesson(n); if (L.role[sid] != null) return L.role[sid];
  if (L.roleS) return null;
  if (!CFG.rotate) return 0;
  const g = student(sid)?.grp || 0;
  const mates = sortedStudents().filter(s => (s.grp || 0) === g && !isOff(attOf(n, s.id))), pos = mates.findIndex(s => s.id === sid);
  if (pos < 0) return null;
  return (pos + (n - 1) + (L.shift || 0)) % CFG.roles.length;
}
const roleOf = (n, sid) => { const i = roleIdx(n, sid); return i == null ? null : CFG.roles[i] || null; };

/* ---------------------------------------------------------------------
   Barème : chaque élément transforme une valeur (meilleure, moyenne, dernière,
   progrès, cibles atteintes) en points, par interpolation dans la table.
   --------------------------------------------------------------------- */
function gradeLessons(){
  if (SEANCE) return [1];
  const all = Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1);
  const ev = all.filter(n => lesson(n).ev); return ev.length ? ev : all;
}
const FROM_N = SEANCE ? { best:'Résultat de la séance', cible:'Cible atteinte' } : { best:'Meilleure leçon', mean:'Moyenne des leçons', last:'Dernière leçon', prog:'Progrès (dernière − première)', cible:'% de leçons cible atteinte' };
function gradeValue(sid, it){
  if (String(it.field).startsWith('fr:')) { const fr = CFG.filsRouges.find(x => 'fr:' + x.id === it.field); return fr ? (frFinal(fr, sid) || frSuggest(fr, sid)) : null; }
  const f = fieldById(it.field); if (!f) return null;
  const ls = gradeLessons().filter(n => !isOff(attOf(n, sid))), a = vals(ls.map(n => lessonVal(n, sid, f)));
  if (!a.length) return null;
  if (it.from === 'mean') return avg(a);
  if (it.from === 'last') return a[a.length - 1];
  if (it.from === 'prog') return a.length < 2 ? 0 : (f.better === 'low' ? a[0] - a[a.length - 1] : a[a.length - 1] - a[0]);
  if (it.from === 'cible') { const t = targetOf(sid, f); if (t == null) return null; return Math.round(a.filter(x => reached(f, x, t)).length / a.length * 100); }
  return f.better === 'low' ? Math.min(...a) : Math.max(...a);
}
function interp(table, x){
  if (x == null) return null; if (!table.length) return null;
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) { const [x0, y0] = table[i-1], [x1, y1] = table[i];
    if (x <= x1) return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return table[table.length - 1][1];
}
function gradeOf(sid){
  const items = CFG.grade.items.map(it => { const v = gradeValue(sid, it); const p = v == null ? null : Math.max(0, Math.min(it.pts, interp(it.table, v)));
    return { it, v, p: p == null ? null : Math.round(p * 4) / 4 }; });
  const ok = items.filter(x => x.p != null), max = CFG.grade.items.reduce((s, it) => s + it.pts, 0);
  const total = ok.length === items.length && items.length ? items.reduce((s, x) => s + x.p, 0) : null;
  return { items, total, onTotal: total == null || !max ? null : Math.round(total / max * CFG.grade.total * 4) / 4, max };
}

/* =====================================================================
   Contrôles de saisie : molette, compteur, échelle, choix, nombre, chrono
   ===================================================================== */
const DIAL_START = -135, DIAL_SPAN = 270, CX = 100, CY = 100, DR = 80;
function pol(r, a){ const t = a*Math.PI/180; return [CX + r*Math.sin(t), CY - r*Math.cos(t)]; }
function arc(r, a0, a1){ const [x0,y0]=pol(r,a0),[x1,y1]=pol(r,a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
function dialColor(cfg, v){
  if (v == null) return '#9AA3B5';
  if (cfg.t != null) { const i = gapIdx(cfg.f, v, cfg.t); return GAP7[i].c; }
  return 'var(--navy)';
}
const dialFg = (cfg, v) => { if (v == null || cfg.t == null) return '#fff'; return GAP7[gapIdx(cfg.f, v, cfg.t)].f; };
function dialInner(cfg){
  const { v, min, max, step } = cfg, nb = Math.round((max - min) / step) + 1, ang1 = DIAL_SPAN / Math.max(1, nb - 1), col = dialColor(cfg, v);
  const [rr, ro, fs] = nb <= 11 ? [14, 18, 16] : nb <= 16 ? [11, 15, 13] : nb <= 21 ? [9, 13, 11] : [7.5, 12, 9.5];
  const showEvery = nb > 26 ? 5 : nb > 21 ? 2 : 1, idx = x => Math.round((x - min) / step);
  let s = `<path d="${arc(DR, DIAL_START, -DIAL_START)}" stroke="#DCE2EE" stroke-width="20" fill="none" stroke-linecap="round"/>`;
  if (v != null && v > min) s += `<path d="${arc(DR, DIAL_START, DIAL_START + idx(v)*ang1)}" stroke="${col}" stroke-width="20" fill="none" stroke-linecap="round"/>`;
  for (let k = 0; k < nb; k++) {
    const i = r10(min + k * step, 3), ang = DIAL_START + k*ang1, [x,y] = pol(DR, ang), on = v === i, isT = cfg.t === i;
    const lab = on || isT || k % showEvery === 0 || k === nb - 1;
    if (isT) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${ro+4}" fill="none" stroke="#F07000" stroke-width="4" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on?ro:lab?rr:rr*.45}" fill="${on?col:'#fff'}" stroke="${on?'#0A1633':'#0062C46B'}" stroke-width="2.5"/>`;
    if (lab) s += `<text x="${x.toFixed(1)}" y="${(y+(on?6:4.5)).toFixed(1)}" text-anchor="middle" font-size="${on?fs+3:fs}" fill="${on?dialFg(cfg, v):'#0062C4'}">${fmtN(i, 2)}</text>`;
  }
  s += `<circle cx="100" cy="94" r="30" fill="${v==null?'#fff':col}" stroke="${v==null?'#DCE2EE':'#0A1633'}" stroke-width="2.5"/>
        <text x="100" y="107" text-anchor="middle" font-size="${String(v ?? '').length > 3 ? 24 : 36}" fill="${v==null?'#9AA3B5':dialFg(cfg, v)}">${v==null?'–':fmtN(v, 2)}</text>
        <text x="100" y="142" text-anchor="middle" font-size="14" fill="#5B6478">${esc(cfg.lbl || '')}</text>`;
  return s;
}
function dialHTML(f, v, t, lbl, attrs){
  return `<svg class="dial" viewBox="0 0 200 200" ${attrs} data-v="${v ?? ''}" data-lbl="${esc(lbl||'')}">${dialInner({ f, v, t, min:f.min, max:f.max, step:f.step, lbl })}</svg>`;
}
function bindDials(onSet){
  $$('svg.dial').forEach(svg => {
    const f = fieldById(svg.dataset.f), n = curLesson(), t = targetOf(UI.sid, f), nb = Math.round((f.max - f.min) / f.step) + 1, ang1 = DIAL_SPAN / Math.max(1, nb - 1);
    let dragging = false, cur = svg.dataset.v === '' ? null : +svg.dataset.v;
    const valFromEvent = e => {
      const b = svg.getBoundingClientRect();
      const x = (e.clientX - b.left) * 200 / b.width - CX, y = (e.clientY - b.top) * 200 / b.height - CY;
      if (Math.hypot(x, y) < 30) return null;
      let ang = Math.atan2(x, -y) * 180 / Math.PI;
      if (ang > 157.5) ang = 135; if (ang < -157.5) ang = -135;
      const k = Math.max(0, Math.min(nb - 1, Math.round((ang - DIAL_START) / ang1)));
      return r10(f.min + k * f.step, 3);
    };
    const show = v => { svg.innerHTML = dialInner({ f, v, t, min:f.min, max:f.max, step:f.step, lbl: svg.dataset.lbl }); };
    svg.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; svg.setPointerCapture(e.pointerId);
      const v = valFromEvent(e); if (v != null) { cur = v; show(v); } });
    svg.addEventListener('pointermove', e => { if (!dragging) return; const v = valFromEvent(e); if (v != null && v !== cur) { cur = v; show(v); } });
    const end = () => { if (!dragging) return; dragging = false; if (cur != null && String(cur) !== svg.dataset.v) { svg.dataset.v = cur; onSet(svg.dataset, cur); } };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  });
}

/* Couleurs d'une échelle : du rouge (moins bien) au vert (mieux) */
const SCALE10 = ['#D0161B','#E3401B','#F07000','#F59E0B','#FFD000','#C8D93A','#86DC96','#3FB65C','#1E8E3E','#0B4F1C'];
function scaleCol(f, v){ const span = f.max - f.min || 1; let q = (v - f.min) / span; if (f.better === 'low') q = 1 - q; return SCALE10[Math.max(0, Math.min(9, Math.round(q * 9)))]; }
const darkTxt = c => ['#FFD000','#C8D93A','#86DC96','#F59E0B','#FFD400','#FFFFFF','#00B8D9'].includes(String(c).toUpperCase());

/* Contrôle d'une saisie (k = tentative, null pour une saisie par leçon) */
function ctlHTML(f, v, k, t){
  const a = `data-f="${f.id}" data-k="${k ?? ''}"`, lbl = k != null ? `T${k + 1}` : '';
  const nbVals = Math.round((f.max - f.min) / (f.step || 1)) + 1;
  switch (f.type) {
    case 'dial':
      if (nbVals <= 41) return dialHTML(f, v, t, lbl, a);
      /* trop de crans : compteur */
    case 'counter':
      return `<div class="counter" ${a}>${lbl ? `<span class="c-lbl">${lbl}</span>` : ''}<button class="cbtn" data-act="dec" ${a}>−</button>
        <button class="c-val ${v == null ? 'empty' : ''}" data-act="type" ${a} ${t != null && v != null ? gapCell(f, v, t) : ''}>${v == null ? '–' : fmtN(v, 2)}</button><button class="cbtn" data-act="inc" ${a}>+</button></div>`;
    case 'scale': {
      let s = `<div class="scale-row">${lbl ? `<span class="c-lbl">${lbl}</span>` : ''}<div class="scale">`;
      for (let x = f.min; x <= f.max; x += f.step) { x = r10(x, 3); const on = v === x, c = scaleCol(f, x), tl = f.labels[Math.round((x - f.min) / f.step)];
        s += `<button class="sc ${on ? 'on' : ''} ${t === x ? 'tgt' : ''}" data-act="set" data-v="${x}" ${a} style="${on ? `background:${c};color:${darkTxt(c) ? '#0A1633' : '#fff'}` : `border-color:${c}`}">
          <b>${fmtN(x, 2)}</b>${tl ? `<small>${esc(tl)}</small>` : ''}</button>`; }
      return s + '</div></div>';
    }
    case 'choice':
      return `<div class="scale-row">${lbl ? `<span class="c-lbl">${lbl}</span>` : ''}<div class="choices">${f.opts.map(o => { const on = v === o.v;
        return `<button class="ch ${on ? 'on' : ''}" data-act="set" data-v="${o.v}" ${a} style="${on ? `background:${o.c};border-color:${o.c};color:${darkTxt(o.c) ? '#0A1633' : '#fff'}` : `border-color:${o.c}`}">${esc(o.l)}</button>`; }).join('')}</div></div>`;
    case 'criteres':
      return `<div class="crit-list">${lbl ? `<span class="c-lbl">${lbl}</span>` : ''}${f.criteres.map((c, i) => { const x = (v || [])[i];
        return `<div class="crit-row"><span class="crit-c">${esc(c)}</span><button class="cr-b ok ${x === 1 ? 'on' : ''}" data-act="crit" data-i="${i}" data-x="1" ${a}>✓</button><button class="cr-b ko ${x === 0 ? 'on' : ''}" data-act="crit" data-i="${i}" data-x="0" ${a}>✗</button></div>`; }).join('')}
        ${critPct(v) != null ? `<div class="crit-pct" ${t != null ? gapCell(f, critPct(v), t) : ''}>${fmtF(f, critPct(v))} des critères</div>` : ''}</div>`;
    case 'number':
      return `<label class="num-row">${lbl ? `<span class="c-lbl">${lbl}</span>` : ''}<input type="number" inputmode="decimal" step="${f.step || 'any'}" ${isFinite(f.min) ? `min="${f.min}"` : ''} ${f.max > f.min ? `max="${f.max}"` : ''}
        class="num-in" data-act="num" ${a} value="${v ?? ''}" ${t != null && v != null ? gapCell(f, v, t) : ''}><b>${esc(f.unit)}</b></label>`;
    case 'chrono': {
      const key = f.id + ':' + (k ?? ''), run = CHRONO.key === key;
      return `<div class="chrono ${run ? 'run' : ''}">${lbl ? `<span class="c-lbl">${lbl}</span>` : ''}
        <button class="chr-disp" data-act="type" ${a} ${t != null && v != null && !run ? gapCell(f, v, t) : ''}><span ${run ? 'id="chr-live"' : ''}>${run ? fmtChrono(chronoNow()) : fmtChrono(v)}</span></button>
        <button class="btn ${run ? 'red' : 'green'} chr-go" data-act="chrono" ${a}>${run ? '⏹ Stop' : '▶ Départ'}</button></div>`;
    }
  }
  return '';
}
/* Chronomètre (un seul à la fois) */
const CHRONO = { key:null, t0:0, timer:null };
const chronoNow = () => (performance.now() - CHRONO.t0) / 1000;
function chronoTick(){ const el = $('#chr-live'); if (!el || !CHRONO.key) { clearInterval(CHRONO.timer); CHRONO.timer = null; return; } el.textContent = fmtChrono(chronoNow()); }
/* Base45 : alphabet du mode « alphanumérique » des QR codes (≈ 30 % de données en plus par QR) */
const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function b45enc(u8){ let s = '';
  for (let i = 0; i < u8.length; i += 2) {
    if (i + 1 < u8.length) { let x = u8[i]*256 + u8[i+1]; const c = x % 45; x = (x-c)/45; const d = x % 45; const e = (x-d)/45; s += B45[c] + B45[d] + B45[e]; }
    else { const x = u8[i], c = x % 45, d = (x-c)/45; s += B45[c] + B45[d]; }
  } return s; }
function b45dec(s){ const out = [];
  for (let i = 0; i < s.length; i += 3) {
    const c = B45.indexOf(s[i]), d = B45.indexOf(s[i+1]);
    if (i + 2 < s.length) { const x = c + d*45 + B45.indexOf(s[i+2])*2025; out.push(x >> 8, x & 255); }
    else out.push(c + d*45);
  } return new Uint8Array(out); }
async function streamBytes(u8, ts){ const st = new Blob([u8]).stream().pipeThrough(ts); return new Uint8Array(await new Response(st).arrayBuffer()); }
function chunkQR(payload, type, max=QR_CHUNK){
  const id = rnd(3).toUpperCase(), parts = [];
  const n = Math.max(1, Math.ceil(payload.length / max));
  const per = Math.ceil(payload.length / n);          // morceaux égaux = QR les moins denses possible
  for (let i = 0; i < n; i++) parts.push(`${QR_PFX}:${type}:${id}:${i+1}:${n}:` + payload.slice(i*per, (i+1)*per));
  return parts;
}
function qrDataURL(text){
  const qr = qrcode(0, 'L'); qr.addData(text, 'Alphanumeric'); qr.make();
  return qr.createDataURL(10, 40);   // marge blanche = 4 modules (zone de silence obligatoire)
}
/* Lecture d'un morceau scanné : « NE:F:ID:i:n:données » */
function parsePart(txt){
  if (!txt || !txt.startsWith(QR_PFX + ':')) return null;
  const f = txt.split(':');
  if (f.length < 6) return null;
  return { type:f[1], id:f[2], i:+f[3], n:+f[4], data:f.slice(5).join(':') };
}

/* Affichage d'une série de QR (défilement automatique) */
let qrTimer = null;
function showQRSeries(parts, container, title){
  let i = 0, auto = parts.length > 1, speed = 1000;          // 1 QR par seconde (la série tourne en boucle)
  const imgs = parts.map(qrDataURL);
  const draw = () => {
    container.innerHTML = `<div class="qr-box">
      ${title?`<h2 class="center">${title}</h2>`:''}
      <img src="${imgs[i]}" alt="QR code ${i+1}/${parts.length}">
      <div class="qr-part">${parts.length>1?`QR ${i+1} / ${parts.length}`:'QR unique'}</div>
      ${parts.length>1?`<div class="qr-nums">${parts.map((_,k)=>`<button class="${k===i?'on':''}" data-q="${k}">${k+1}</button>`).join('')}</div>
        <div class="btn-row"><button class="btn" data-q="prev">←</button>
        <button class="btn ${auto?'orange':''}" data-q="auto">${auto?'⏸ Pause':'▶ Défilement auto'}</button>
        <button class="btn" data-q="next">→</button></div>`:''}
      
    </div>`;
    container.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const q = b.dataset.q;
      if (q === 'auto') auto = !auto;
      else if (q === 'prev') { auto = false; i = (i - 1 + parts.length) % parts.length; }
      else if (q === 'next') { auto = false; i = (i + 1) % parts.length; }
      else { auto = false; i = +q; }
      draw();
    });
  };
  clearInterval(qrTimer);
  qrTimer = setInterval(() => { if (!document.body.contains(container)) return clearInterval(qrTimer); if (auto) { i = (i+1) % parts.length; draw(); } }, speed);
  draw();
}

/* Scanner : caméra (détecteur natif si disponible, sinon jsQR sur le centre de l'image en pleine résolution)
   + secours « photo du QR » (appareil photo natif, mise au point automatique) */
let scan = null;
function stopScan(){
  if (!scan) return;
  scan.stopped = true;
  clearTimeout(scan.timer);
  if (scan.stream) scan.stream.getTracks().forEach(t => t.stop());
  scan = null;
}
let nativeDetector, scanCamIdx = 0, scanCamId = null;
async function getNativeDetector(){
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  try { if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) nativeDetector = new BarcodeDetector({ formats:['qr_code'] }); } catch(e){}
  return nativeDetector;
}
/* jsQR lit mal les images floues/bruitées en pleine résolution : on réduit l'image par moyennage
   (filtre « boîte », qui efface le bruit du capteur) à plusieurs échelles, en alternant d'une image à l'autre. */
const SCAN_SCALES = [0.4, 0.3, 0.5, 0.24, 0.62, 0.35, 0.8, 0.45];
function grabGray(ctx, cv, src, sx, sy, sw, sh, maxSide){
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw*k), h = Math.round(sh*k);
  cv.width = w; cv.height = h; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w*h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j]*0.3 + d[j+1]*0.59 + d[j+2]*0.11;
  return { g, w, h };
}
function boxDown(G, f){
  const { g, w, h } = G;
  if (f >= 0.999) return G;
  const nw = Math.max(1, Math.round(w*f)), nh = Math.max(1, Math.round(h*f));
  const o = new Float32Array(nw*nh), c = new Float32Array(nw*nh);
  for (let y = 0; y < h; y++) { const yy = Math.min(nh-1, (y*f)|0), row = yy*nw;
    for (let x = 0; x < w; x++) { const i = row + Math.min(nw-1, (x*f)|0); o[i] += g[y*w+x]; c[i]++; } }
  for (let i = 0; i < o.length; i++) o[i] /= c[i] || 1;
  return { g:o, w:nw, h:nh };
}
function jsqrGray(G, both){
  const { g, w, h } = G, d = new Uint8ClampedArray(w*h*4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { d[j] = d[j+1] = d[j+2] = g[i]; d[j+3] = 255; }
  const c = jsQR(d, w, h, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
  return c && c.data ? c.data : null;
}
function jsqrOn(ctx, w, h, both){
  const img = ctx.getImageData(0, 0, w, h);
  const c = jsQR(img.data, w, h, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
  return c && c.data ? c.data : null;
}
/* Lecteur ZXing (moteur de lecture professionnel, compilé en WebAssembly, embarqué dans l'appli) */
let zxReady = false;
try {
  if (window.ZXingWASM) ZXingWASM.prepareZXingModule({ overrides:{ locateFile:(path, prefix) => path.endsWith('.wasm') ? new URL('lib/' + path, document.baseURI).href : prefix + path }, fireImmediately:true })
    .then(() => { zxReady = true; }).catch(e => console.warn('ZXing', e));
} catch(e){}
async function zxRead(imgData, hard=true){
  if (!zxReady) return null;
  try { const r = await ZXingWASM.readBarcodes(imgData, { formats:['QRCode'], tryHarder:hard, maxNumberOfSymbols:1 });
    const ok = r.find(x => x.isValid && x.text); return ok ? ok.text : null; } catch(e){ return null; }
}
async function decodeImageSource(src, sw, sh, cv, ctx, frame, all=false){
  const det = await getNativeDetector();
  if (det) { try { const r = await det.detect(src); if (r && r.length) return r.map(x => x.rawValue); } catch(e){} }
  const side = Math.min(sw, sh) * 0.92, sx = (sw - side)/2, sy = (sh - side)/2;
  if (zxReady) {
    // ZXing : cadre central, puis image entière de temps en temps
    const k = Math.min(1, (all ? 1000 : 800) / side), w = Math.round(side*k);
    cv.width = w; cv.height = w; ctx.drawImage(src, sx, sy, side, side, 0, 0, w, w);
    let t = await zxRead(ctx.getImageData(0, 0, w, w), all || frame % 3 !== 1);
    if (t) return [t];
    if (all || frame % 3 === 2) {
      const k2 = Math.min(1, 1280 / Math.max(sw, sh)), w2 = Math.round(sw*k2), h2 = Math.round(sh*k2);
      cv.width = w2; cv.height = h2; ctx.drawImage(src, 0, 0, sw, sh, 0, 0, w2, h2);
      t = await zxRead(ctx.getImageData(0, 0, w2, h2));
      if (t) return [t];
    }
    if (!all && frame % 2 === 0) return [];        // une image sur deux : aussi jsQR (ci-dessous)
  }
  const G = grabGray(ctx, cv, src, sx, sy, side, side, 1100);
  const scales = all ? SCAN_SCALES : [SCAN_SCALES[frame % SCAN_SCALES.length], SCAN_SCALES[(frame+3) % SCAN_SCALES.length]];
  for (const f of scales) {
    const t = jsqrGray(boxDown(G, f * side / G.w), all || frame % 5 === 4);
    if (t) return [t];
  }
  if (all || frame % 4 === 3) {                      // image entière (QR hors du cadre)
    const F = grabGray(ctx, cv, src, 0, 0, sw, sh, 1100);
    for (const f of (all ? [0.35, 0.5, 0.7] : [0.5])) { const t = jsqrGray(boxDown(F, f), all); if (t) return [t]; }
  }
  return [];
}
async function startScan(container, expectType, onDone){
  stopScan();
  container.innerHTML = `<div class="scan-wrap"><video playsinline webkit-playsinline muted autoplay></video><div class="scan-frame"></div></div>
    <div style="max-width:560px;margin:12px auto">
      <div class="scan-parts"></div>
      <p class="center" style="font-weight:900;font-size:20px" id="scan-msg">Démarrage de la caméra…</p>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-cam>🔄 Caméra</button><label class="btn orange">📷 Photo du QR<input type="file" accept="image/*" capture="environment" hidden class="scan-photo"></label></div>
      <p class="center" id="scan-diag" style="font-size:12px;color:var(--grey);margin-top:8px"></p></div>`;
  const video = container.querySelector('video'), msg = container.querySelector('#scan-msg'), partsEl = container.querySelector('.scan-parts');
  const me = scan = { stopped:false, parts:{}, id:null, n:0, frame:0 };
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently:true });
  const showParts = () => { const got = Object.keys(me.parts).length, pc = me.n ? Math.round(got / me.n * 100) : 0;
    partsEl.innerHTML = me.n > 1 ? `<div class="scan-prog"><div class="scan-bar" style="width:${pc}%"></div><span>${pc} %</span></div>` : ''; };
  let finished = false;
  const handle = async texts => {
    for (const txt of texts) {
      const pt = parsePart(txt);
      if (!pt) { msg.textContent = 'QR non reconnu (ce n\'est pas un QR d\'une appli N\'EPS).'; continue; }
      const okTypes = [].concat(expectType || []);
      if (okTypes.length && !okTypes.includes(pt.type)) { msg.textContent = okTypes.includes('R') ? 'Ce QR est destiné aux tablettes élèves (📷 Recevoir la leçon).' : 'Ce QR est destiné à la tablette enseignant (📥 Récupérer les saisies).'; continue; }
      if (pt.id === me.doneId) continue;            // QR déjà traité (encore devant la caméra)
      if (me.id !== pt.id) { me.id = pt.id; me.parts = {}; me.n = pt.n; }
      if (!me.parts[pt.i]) { me.parts[pt.i] = pt.data; if (navigator.vibrate) navigator.vibrate(40); }
      const got = Object.keys(me.parts).length;
      showParts();
      const miss = Array.from({length:me.n},(_,k)=>k+1).filter(k=>!me.parts[k]);
      msg.textContent = me.n > 1 ? (got < me.n ? `Import : ${Math.round(got / me.n * 100)} % · laissez défiler les QR devant la caméra` : 'Import : 100 %') : 'QR reçu !';
      if (got === me.n && !finished) {
        finished = true;
        const payload = Array.from({length: me.n}, (_, k) => me.parts[k+1]).join('');
        me.doneId = me.id; me.id = null; me.parts = {};
        let r;
        try { r = await onDone(await decodePacket(payload)); }
        catch(e) { console.warn(e); toast('⚠️ ' + e.message, 3500); r = 'continue'; }
        if (r === 'continue' && scan === me && !me.stopped) {     // la caméra reste allumée pour le QR suivant
          finished = false; showParts(); msg.textContent = '✓ Reçu'; me.timer = setTimeout(tick, 400);
        } else if (scan === me) stopScan();
        return;
      }
    }
  };
  // secours photo
  container.querySelector('.scan-photo').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    msg.textContent = 'Lecture de la photo…';
    try {
      const bmp = await createImageBitmap(f);
      const pcv = document.createElement('canvas'), pctx = pcv.getContext('2d', { willReadFrequently:true });
      const r = await decodeImageSource(bmp, bmp.width, bmp.height, pcv, pctx, 0, true);
      if (r.length) await handle(r); else msg.textContent = '⚠️ QR non trouvé sur la photo : recommencez en cadrant le QR bien net, en entier.';
    } catch(err) { msg.textContent = '⚠️ Photo illisible'; }
  });
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.innerHTML = '⚠️ Caméra indisponible : utilisez 📷 Photo du QR.'; return;
  }
  const diag = container.querySelector('#scan-diag');
  container.querySelector('[data-cam]').onclick = async () => {
    try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (cams.length < 2) return toast('Une seule caméra');
      scanCamIdx = (scanCamIdx + 1) % cams.length; scanCamId = cams[scanCamIdx].deviceId;
      startScan(container, expectType, onDone); } catch(e){}
  };
  // Plusieurs réglages essayés dans l'ordre (certains appareils donnent une image noire en haute résolution)
  const attempts = scanCamId
    ? [{ deviceId:{ exact: scanCamId } }]
    : [{ facingMode:'environment' }, { facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }, true];
  let lastErr = null;
  for (const vc of attempts) {
    try { me.stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio:false }); break; }
    catch(e) { lastErr = e; }
  }
  if (!me.stream) {
    const n = lastErr && lastErr.name;
    msg.innerHTML = n === 'NotAllowedError' ? '⚠️ Caméra refusée : autorisez la caméra pour ce site dans les réglages, ou utilisez 📷 Photo du QR.'
      : '⚠️ Caméra impossible à ouvrir (' + esc(n || 'erreur') + ') : utilisez 📷 Photo du QR.';
    return;
  }
  if (me.stopped) { me.stream.getTracks().forEach(t=>t.stop()); return; }
  const track = me.stream.getVideoTracks()[0];
  try { await track.applyConstraints({ advanced:[{ focusMode:'continuous' }] }); } catch(e){}
  video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
  video.srcObject = me.stream;
  const playIt = () => video.play().catch(()=>{});
  video.onloadedmetadata = playIt; playIt();
  msg.textContent = 'Visez le QR code…';
  const reader = () => nativeDetector ? 'lecteur Android' : zxReady ? 'lecteur ZXing' : 'lecteur jsQR';
  const t0 = Date.now(); let lastDiag = 0, decodes = 0, dark = 0, switched = false;
  const probe = document.createElement('canvas'), pctx = probe.getContext('2d', { willReadFrequently:true }); probe.width = 32; probe.height = 18;
  const tick = async () => {
    if (me.stopped || finished) return;
    const now = Date.now();
    if (video.readyState >= 2 && video.videoWidth) {
      me.frame++;
      // image noire ? (mauvais objectif sur certains appareils) → on passe à une autre caméra
      if (me.frame % 10 === 1) {
        pctx.drawImage(video, 0, 0, 32, 18); const d = pctx.getImageData(0, 0, 32, 18).data; let m = 0;
        for (let i = 0; i < d.length; i += 4) m += d[i] + d[i+1] + d[i+2]; m /= (d.length/4*3);
        dark = m < 6 ? dark + 1 : 0;
        if (dark >= 4 && !switched) { switched = true; toast('Image noire : autre caméra…');
          try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'videoinput');
            if (cams.length > 1) { const cur = track.getSettings().deviceId; const i = cams.findIndex(c => c.deviceId === cur);
              scanCamIdx = (i + 1) % cams.length; scanCamId = cams[scanCamIdx].deviceId; return startScan(container, expectType, onDone); } } catch(e){}
          msg.textContent = '⚠️ Image noire : touchez 🔄 Caméra ou utilisez 📷 Photo du QR.'; }
      }
      try { const r = await decodeImageSource(video, video.videoWidth, video.videoHeight, cv, ctx, me.frame); decodes++; if (r.length) await handle(r); } catch(e){ console.warn(e); }
    } else if (now - t0 > 4000 && me.frame === 0) {
      msg.textContent = '⚠️ La caméra ne renvoie pas d\'image : touchez 🔄 Caméra ou utilisez 📷 Photo du QR.';
      playIt();
    }
    if (diag && now - lastDiag > 1000) {
      const el = (now - (lastDiag || t0)) / 1000;
      diag.textContent = `Caméra ${video.videoWidth}×${video.videoHeight} · ${Math.round(decodes/el)} analyses/s · ${reader()} · v${APP_VERSION}`;
      lastDiag = now; decodes = 0;
    }
    if (!me.stopped && !finished) me.timer = setTimeout(tick, 60);
  };
  tick();
}
async function downloadJSON(obj, name){
  const blob = new Blob([JSON.stringify(obj)], { type:'application/json' });
  try {
    const file = new File([blob], name, { type:'application/json' });
    if (navigator.canShare && navigator.canShare({ files:[file] })) { await navigator.share({ files:[file], title:name }); return; }
  } catch(e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* =====================================================================
   Affichage
   ===================================================================== */
function setTop(main, sub, right=''){ $('#tb-main').textContent = main; $('#tb-sub').textContent = sub || ''; $('#tb-right').innerHTML = right; }
function go(view, opts={}){ Object.assign(UI, opts); UI.view = view; render(); window.scrollTo(0,0); }
function rerender(){ const y = window.scrollY; render(); window.scrollTo(0, y); }
const homeBtn = `<button class="btn small" data-action="go" data-view="home">⌂ Accueil</button>`;
const menuBtn = `<button class="btn small" data-action="tab" data-tab="menu">☰ Menu</button>`;
function render(){
  stopScan();
  let v = UI.view; const m = $('#main');
  if (!ROOT.role) { setTop(CFG.name, 'Choix du rôle de la tablette'); m.innerHTML = viewRole(); return; }
  const prof = isProf();
  if (!prof && !['home','saisie','entry','send','receive','tools','tool'].includes(v)) v = UI.view = 'home';
  if (prof && !UI.profUnlocked && !['home','tools','tool','saisie','entry'].includes(v)) v = UI.view = 'home';
  if (prof && UI.profUnlocked && v === 'home') { v = UI.view = 'prof'; UI.profTab = 'menu'; }
  if (v === 'home') { setTop(CFG.name, prof ? 'Tablette enseignant' : 'Tablette élève'); m.innerHTML = prof ? viewHomeProfLocked() : viewHomeEleve(); }
  else if (v === 'saisie') { setTop('Saisie · ' + lessonLabel(curLesson()), className(), prof && UI.profUnlocked ? menuBtn : homeBtn); m.innerHTML = viewSaisie(); }
  else if (v === 'tools') { setTop('🧰 Outils', className(), prof && UI.profUnlocked ? menuBtn : homeBtn); m.innerHTML = viewTools(); }
  else if (v === 'tool') { const T = TOOL_DEFS[UI.tool]; setTop(T.ico + ' ' + T.n, className(), `<button class="btn small" data-action="go" data-view="tools">🧰 Outils</button>`); m.innerHTML = T.view(); T.bind && T.bind(); }
  else if (v === 'entry') { setTop(nameOf(UI.sid), lessonLabel(curLesson()), `<button class="btn small" data-action="go" data-view="saisie">▦ Élèves</button>`); m.innerHTML = viewEntry(); bindEntry(); }
  else if (v === 'prof') { setTop(UI.profTab === 'menu' ? 'Espace enseignant' : (PTABS[UI.profTab]?.n || (UI.profTab === 'frDetail' ? 'Fil rouge · ' + nameOf(UI.sid) : '')), className() + ' · ' + lessonLabel(curLesson()), UI.profTab === 'menu' ? `<button class="btn small" data-action="lock" title="Verrouiller">🔒</button>` : menuBtn); m.innerHTML = viewProf(); afterProf(); }
  else if (v === 'send') { setTop('Envoyer mes saisies', 'QR code à scanner par l\'enseignant', homeBtn); m.innerHTML = viewSend(); afterSend(); }
  else if (v === 'receive') { setTop('Recevoir la ' + LECON, 'QR affiché par l\'enseignant', homeBtn); m.innerHTML = viewReceive(); afterReceive(); }
}

/* ---------------- Accueil ---------------- */
function viewRole(){
  return `<div class="home"><img class="home-logo" src="${ICON}" alt="">
    <h2 class="center">${esc(CFG.name)}</h2>${CFG.sub ? `<p class="center muted">${esc(CFG.sub)}</p>` : ''}
    <div class="card strong center" style="max-width:640px"><b>Cette tablette est…</b></div>
    <div class="home-grid two"><button class="home-btn prof" data-action="setRole" data-r="prof"><span class="ico">🧑‍🏫</span>Tablette enseignant</button>
    <button class="home-btn saisie" data-action="setRole" data-r="eleve"><span class="ico">📋</span>Tablette élève</button></div></div>`;
}
function lessonBanner(){
  const rs = ROOT.seance;
  return `<div class="home-lesson"><div class="big">${esc(className())}${SEANCE ? '' : ' · Leçon ' + curLesson()}</div>
    <div class="muted">${S.students.length} élève(s)${lesson(curLesson()).title ? ' · ' + esc(lesson(curLesson()).title) : ''}${!isProf() && rs ? ' · ' + LECON + ' reçue à ' + new Date(rs.at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : ''}</div></div>`;
}
function viewHomeEleve(){
  const ready = S.students.length > 0;
  return `<div class="home"><img class="home-logo" src="${ICON}" alt="">
    ${ready ? lessonBanner() : `<div class="home-lesson"><div class="big">Aucune ${LECON} reçue</div><div class="muted">Scanne le QR de la ${LECON} affiché sur la tablette de l'enseignant.</div></div>`}
    <div class="home-grid ${elTools().length ? 'four' : ''}">
      <button class="home-btn saisie" data-action="go" data-view="${ready ? 'saisie' : 'receive'}"><span class="ico">✍️</span>Saisie</button>
      <button class="home-btn stats" data-action="go" data-view="receive"><span class="ico">📷</span>Recevoir la ${LECON}</button>
      <button class="home-btn send" data-action="go" data-view="send" ${ready ? '' : 'disabled'}><span class="ico">📤</span>Envoyer mes saisies</button>
      ${elTools().length ? `<button class="home-btn tools" data-action="go" data-view="tools"><span class="ico">🧰</span>Outils</button>` : ''}
    </div>
    ${S.bc ? `<button class="btn orange" data-action="projBc">📊 Bilan de la classe · leçon ${S.bc.n}</button>` : ''}
    <button class="btn ghost small" data-action="unlock">🔒 Espace enseignant</button></div>`;
}
function viewHomeProfLocked(){
  return `<div class="home"><img class="home-logo" src="${ICON}" alt="">${lessonBanner()}
    <div class="home-grid two"><button class="home-btn prof" data-action="unlock"><span class="ico">🔒</span>Espace enseignant</button>
    <button class="home-btn saisie" data-action="go" data-view="saisie"><span class="ico">✍️</span>Saisie directe</button></div></div>`;
}

/* ---------------- Saisie : tuiles des élèves ---------------- */
function groupChips(sel, action='grp'){
  if (nbGroups() < 2) return '';
  return `<div class="filters"><b>Groupe :</b><button class="chip ${sel == null ? 'on' : ''}" data-action="${action}" data-g="">Tous</button>
    ${Array.from({ length:nbGroups() }, (_, g) => `<button class="chip ${sel === g ? 'on' : ''}" data-action="${action}" data-g="${g}"><span class="dot" style="background:${groupColor(g).c}"></span>${groupColor(g).n}</button>`).join('')}</div>`;
}
const band = sid => `<span class="band" style="background:${groupColor(student(sid)?.grp || 0).c}"></span>`;
function viewSaisie(){
  const n = curLesson(), g = ROOT.grp != null && ROOT.grp < nbGroups() ? ROOT.grp : null;
  const list = sortedStudents().filter(s => g == null || (s.grp || 0) === g);
  if (!S.students.length) return `<div class="card center"><b>Aucun élève.</b> ${isProf() ? 'Ajoutez les élèves dans Classe & élèves.' : 'Recevez d\'abord la leçon.'}</div>`;
  return `${groupChips(g)}<div class="tiles">${list.map(s => {
    const a = attOf(n, s.id), done = entryDone(n, s.id), st = entryStarted(n, s.id), ro = roleOf(n, s.id), off = isOff(a);
    const tg = TFIELDS.filter(f => targetOf(s.id, f) != null).map(f => `🎯 ${esc(f.label)} : ${fmtF(f, targetOf(s.id, f))}`).join('<br>');
    return `<button class="tile ${done ? 'done' : ''} ${off ? 'off' : ''}" data-action="entry" data-sid="${s.id}">${band(s.id)}
      <span class="name">${esc(nameOf(s.id))}</span>
      ${a ? `<span class="tag ${ATT[a].cls}">${ATT[a].ico} ${ATT[a].n}</span>` : ''}${ro ? `<span class="tag role r${roleIdx(n, s.id) % 6}">${esc(ro.n)}</span>` : ''}
      ${tg ? `<span class="target">${tg}</span>` : ''}
      ${done ? '<span class="check">✓</span>' : st ? '<span class="check half">…</span>' : ''}</button>`; }).join('')}</div>`;
}

/* ---------------- Saisie d'un élève ---------------- */
function viewEntry(){
  const n = curLesson(), sid = UI.sid, k = tries(n), a = attOf(n, sid), ro = roleOf(n, sid), C = calcAll(n, sid);
  const prev = [...Array(n - 1).keys()].map(i => n - 1 - i).find(l => hasData(l, sid));
  let h = `<div class="entry-head">${band(sid)}<div><div class="entry-name">${esc(nameOf(sid))}</div>
    <div class="muted">${a ? `<span class="tag ${ATT[a].cls}">${ATT[a].n}</span> ` : ''}${ro ? `<span class="tag role">${esc(ro.n)}</span> ${esc(ro.d || '')}` : ''}</div></div>
    <span id="saved-flag" class="saved"></span></div>`;
  if (FRS.length && !SEANCE) h += frStrip(sid);
  FIELDS.forEach(f => {
    if (!f.show && !isProf()) return;
    const t = f.target ? targetOf(sid, f) : null, pv = prev ? lessonVal(prev, sid, f) : null, Lv = C.L[f.id];
    h += `<div class="card field-card"><div class="fc-head"><h3>${esc(f.label)}${f.unit && f.type !== 'chrono' ? ` <small>(${esc(f.unit)})</small>` : ''}</h3>
      <div class="fc-info">${t != null ? `<span class="pill tgt">🎯 Cible : ${fmtF(f, t)}</span>` : ''}${pv != null ? `<span class="pill">Leçon ${prev} : ${fmtF(f, pv)}</span>` : ''}
      ${f.per === 'try' && k > 1 && Lv != null ? `<span class="pill strong" ${f.target ? gapCell(f, Lv, t) : ''}>${AGG_N[f.agg] || ''} : ${fmtF(f, Lv)}</span>` : ''}</div></div>
      ${f.help ? `<div class="muted help">${esc(f.help)}</div>` : ''}`;
    if (f.type === 'calc') {
      h += `<div class="calc-row">${f.per === 'try' ? C.t.map((o, j) => `<div class="calc-cell" ${f.target ? gapCell(f, o[f.id], t) : ''}><small>T${j+1}</small><b>${fmtF(f, o[f.id])}</b></div>`).join('') :
        `<div class="calc-cell big" ${f.target ? gapCell(f, Lv, t) : ''}><b>${fmtF(f, Lv)}</b></div>`}</div>`;
    } else if (f.per === 'try') {
      h += `<div class="ctl-grid ${f.type === 'dial' ? 'dials' : ''}">${Array.from({ length:k }, (_, j) => ctlHTML(f, rawVal(n, sid, f, j), j, t)).join('')}</div>`;
    } else h += `<div class="ctl-grid one ${f.type === 'dial' ? 'dials' : ''}">${ctlHTML(f, rawVal(n, sid, f), null, t)}</div>`;
    h += '</div>';
  });
  if (isProf() && UI.profUnlocked) h += `<div class="card"><h3>📝 Remarque de l'enseignant <small class="muted">(reste sur cette tablette)</small></h3>
    <textarea id="prof-note" rows="2" style="width:100%" placeholder="Comportement, progrès, conseil, blessure…">${esc(noteOf(n, sid))}</textarea>
    <div class="btn-row">${['Très bon investissement','Progrès nets','Manque d\'engagement','Bavardages','Bon rôle d\'observateur','À encourager'].map(t => `<button class="chip small-chip" data-action="quickNote" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
  const list = sortedStudents().filter(s => ROOT.grp == null || ROOT.grp >= nbGroups() || (s.grp || 0) === ROOT.grp), i = list.findIndex(s => s.id === sid), nx = list[i + 1];
  h += `<div class="btn-row spread entry-foot"><button class="btn" data-action="go" data-view="saisie">▦ Retour aux élèves</button>
    ${nx ? `<button class="btn primary" data-action="entry" data-sid="${nx.id}">${esc(nameOf(nx.id))} ▶</button>` : ''}</div>`;
  return h;
}
function flagSaved(){ const f = $('#saved-flag'); if (f) { f.textContent = '✓ Enregistré'; clearTimeout(f._h); f._h = setTimeout(() => f.textContent = '', 1500); } }
function bindEntry(){
  const n = curLesson(), sid = UI.sid;
  const put = (d, v) => { const f = fieldById(d.f), k = d.k === '' ? null : +d.k; setVal(n, sid, f, k, v); flagSaved(); };
  bindDials((d, v) => { put(d, v); rerender(); });
  const pn = $('#prof-note'); if (pn) pn.onchange = () => { (S.notes[n] = S.notes[n] || {})[sid] = pn.value.trim(); save(); flagSaved(); };
  $$('[data-act]').forEach(el => {
    const d = el.dataset, f = fieldById(d.f), k = d.k === '' ? null : +d.k, cur = () => rawVal(n, sid, f, k);
    if (d.act === 'num') { el.onchange = () => { const v = parseFloat(String(el.value).replace(',', '.')); put(d, isFinite(v) ? v : null); rerender(); }; return; }
    el.onclick = async () => {
      if (d.act === 'crit') { const arr = [...(cur() || [])]; while (arr.length < f.criteres.length) arr.push(null); const x = +d.x, i = +d.i; arr[i] = arr[i] === x ? null : x; put(d, arr); rerender(); return; }
      if (d.act === 'set') { const v = +d.v; put(d, cur() === v ? null : v); rerender(); }
      else if (d.act === 'inc' || d.act === 'dec') { const c = cur(); let v = c == null ? (d.act === 'inc' ? f.min : f.min) : c + (d.act === 'inc' ? f.step : -f.step);
        if (f.max > f.min) v = Math.max(f.min, Math.min(f.max, v)); put(d, r10(v, 3)); rerender(); }
      else if (d.act === 'type') { if (CHRONO.key) return; const v = await numberBox(f.label + (k != null ? ` · T${k+1}` : ''), cur(), { step:f.type === 'chrono' ? 0.01 : f.step, unit:f.unit });
        if (v !== undefined) { put(d, v == null ? null : r10(v, 3)); rerender(); } }
      else if (d.act === 'chrono') {
        const key = f.id + ':' + d.k;
        if (CHRONO.key === key) { const v = r10(chronoNow(), 2); CHRONO.key = null; put(d, v); rerender(); }
        else { if (CHRONO.key) return toast('Un chrono tourne déjà'); CHRONO.key = key; CHRONO.t0 = performance.now(); rerender(); clearInterval(CHRONO.timer); CHRONO.timer = setInterval(chronoTick, 50); }
      }
    };
  });
}

/* =====================================================================
   Espace enseignant
   ===================================================================== */
const PTABS = {
  classe:{ n:'Classe & élèves', ico:'👥' }, groupes:{ n:'Groupes', ico:'🎨' }, lecons:{ n:SEANCE ? 'Séance' : 'Paramètres du cycle', ico:'📅' }, appel:{ n:'Appel', ico:'✅' },
  ...(TFIELDS.length ? { cibles:{ n:'Cibles', ico:'🎯' } } : {}), ...(CFG.roles.length ? { roles:{ n:'Rôles', ico:'🎭' } } : {}),
  qr:{ n:'QR de la ' + LECON, ico:'📲' }, saisie:{ n:'Saisie directe', ico:'✍️' }, ...(Object.keys(TOOLS_ON).length ? { outils:{ n:'Outils', ico:'🧰' } } : {}),
  recup:{ n:'Récupérer les saisies', ico:'📥' },
  bilanL:{ n:'Bilan ' + (SEANCE ? 'de la séance' : 'par leçon'), ico:'🔎' }, resultats:{ n:'Résultats', ico:'📊' }, classement:{ n:'Classement', ico:'🏆' },
  ...(CFG.filsRouges.length ? { filrouge:{ n: CFG.filsRouges.length > 1 ? 'Fils rouges' : 'Fil rouge', ico:'🧶' } } : {}),
  ...(CFG.grade.on && CFG.grade.items.length ? { notes:{ n:'Notes', ico:'📝' } } : {}), export:{ n:'Export & sauvegarde', ico:'💾' } };
const PSECT = [ ['Préparer', ['classe','groupes','lecons','appel','cibles','roles']], ['Pendant la ' + LECON, ['qr','saisie','outils']], ['Récupérer', ['recup']], ['Bilans', ['bilanL','resultats','classement','filrouge','notes','export']] ];
function viewProf(){
  const t = UI.profTab;
  if (t === 'menu') return profMenu();
  const fn = { groupes:profGroupes, bilanL:profBilanL, filrouge:profFilRouge, frDetail:() => frDetailView(UI.sid), classe:profClasse, lecons:profLecons, appel:profAppel, cibles:profCibles, roles:profRoles, qr:profQR, recup:profRecup, resultats:profResultats, classement:profClassement, notes:profNotes, export:profExport }[t];
  return fn ? fn() : profMenu();
}
function profMenu(){
  return `${lessonBanner()}${PSECT.map(([t, L], i) => { const tabs = L.filter(k => PTABS[k]); if (!tabs.length) return '';
      return `<div class="p-sect"><h3><span class="p-step">${i + 1}</span>${t}</h3><div class="menu-grid">${tabs.map(k => `<button class="menu-btn ${['qr','recup'].includes(k) ? 'hl' : ''}" data-action="tab" data-tab="${k}"><span class="ico">${PTABS[k].ico}</span>${PTABS[k].n}</button>`).join('')}</div></div>`; }).join('')}
    ${appQRCard()}`;
}
function classChips(){
  return `<div class="filters"><b>Classe :</b>${Object.values(ROOT.classes).map(c => `<button class="chip ${c.id === S.id ? 'on' : ''}" data-action="useClass" data-c="${c.id}">${esc(className(c))}</button>`).join('')}
    <button class="chip" data-action="addClass">＋ Nouvelle classe</button></div>`;
}
function stepper(action, val, disp){ return `<div class="stepper"><button class="cbtn" data-action="${action}" data-d="-1">−</button><b>${disp ?? val}</b><button class="cbtn" data-action="${action}" data-d="1">+</button></div>`; }
function profClasse(){
  const list = sortedStudents();
  return `${classChips()}
    <div class="card"><div class="btn-row spread"><h3 style="margin:0">${esc(className())} · ${list.length} élève(s)</h3>
      <div class="btn-row"><button class="btn small" data-action="renameClass">✎ Renommer</button><button class="btn small red" data-action="delClass">🗑 Supprimer la classe</button></div></div></div>
    <div class="card"><h3>Ajouter des élèves</h3>
      <div class="btn-row"><label class="btn primary">📂 Importer un fichier (Pronote, Excel, CSV)<input type="file" id="imp-students" accept=".xlsx,.xls,.csv,.txt,.ods" hidden></label>
      <button class="btn" data-action="pasteStudents">📋 Coller une liste</button><button class="btn" data-action="addStudent">＋ Un élève</button></div>
      <p class="muted">Une ligne par élève : « NOM Prénom » ou NOM et Prénom dans deux colonnes.</p></div>
    <div class="card"><div class="btn-row spread"><h3 style="margin:0">Liste${CFG.sexe ? ' · F / G : touchez pour changer (sert à la mixité des groupes)' : ''}</h3><button class="btn small" data-action="tab" data-tab="groupes">🎨 Groupes →</button></div>
      <div class="st-list">${list.map(s => `<div class="st-row">${band(s.id).replace('class="band"', 'class="band inl"')}${CFG.sexe ? `<button class="sx-b ${s.sx || ''}" data-action="cycleSx" data-sid="${s.id}">${s.sx || '?'}</button>` : ''}
        <span class="st-n"><b>${esc(s.nom || '')}</b> ${esc(s.prenom || '')}</span><button class="btn small ghost" data-action="editStudent" data-sid="${s.id}">✎</button><button class="btn small ghost" data-action="delStudent" data-sid="${s.id}">🗑</button></div>`).join('') || '<p class="muted">Aucun élève pour l\'instant.</p>'}</div></div>`;
}
function profLecons(){
  const n = curLesson(), L = lesson(n);
  if (SEANCE) return `<div class="card"><h3>La séance</h3>
      <div class="form-row"><span>Titre / thème (facultatif)</span><button class="btn small" data-action="lessonTitle">${esc(L.title || '—')} ✎</button></div>
      ${INPUTS.some(f => f.per === 'try') ? `<div class="form-row"><span>Nombre d'essais par élève</span>${stepper('tries', L.tries)}</div>` : ''}</div>
    <div class="card"><h3>🔄 Nouvelle séance</h3><p class="muted">Pour rejouer la séance avec cette classe : les saisies, l'appel et les remarques sont effacés (pensez à l'export Excel avant). Les élèves, groupes et cibles sont gardés.</p>
      <div class="btn-row"><button class="btn" data-action="excel">📊 Export Excel d'abord</button><button class="btn red" data-action="newSeance">🔄 Nouvelle séance</button></div></div>`;
  return `<div class="card"><div class="btn-row spread"><h3 style="margin:0">Nombre de leçons du cycle</h3>${stepper('nbLessons', S.settings.nbLessons)}</div></div>
    <div class="card"><h3>Leçon en cours</h3><div class="lchips">${Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1).map(l => `<button class="chip ${l === n ? 'on' : ''} ${lesson(l).ev ? 'ev' : ''}" data-action="setLesson" data-n="${l}">${l}${lesson(l).ev ? ' 📝' : ''}</button>`).join('')}</div></div>
    <div class="card"><h3>Leçon ${n}</h3>
      <div class="form-row"><span>Titre / thème</span><button class="btn small" data-action="lessonTitle">${esc(L.title || '—')} ✎</button></div>
      ${INPUTS.some(f => f.per === 'try') ? `<div class="form-row"><span>Nombre d'essais par élève</span>${stepper('tries', L.tries)}</div>` : ''}
      <div class="form-row"><span>Leçon d'évaluation (comptée dans les notes)</span><button class="btn small ${L.ev ? 'green' : ''}" data-action="toggleEv">${L.ev ? '✓ Oui' : 'Non'}</button></div></div>`;
}
function profAppel(){
  const n = curLesson();
  const list = sortedStudents(), cnt = k => list.filter(s => attOf(n, s.id) === k).length;
  return `<div class="card"><b>Touchez un élève pour choisir : présent, absent, dispensé, inapte partiel, sans tenue.</b>
    <div class="att-sum"><span class="tag ok">✓ ${cnt(0)} présent(s)</span>${[1,2,3,4].map(k => cnt(k) ? `<span class="tag ${ATT[k].cls}">${ATT[k].ico} ${cnt(k)} ${ATT[k].n.toLowerCase()}</span>` : '').join('')}</div>
    <p class="muted small">« Inapte partiel » et « sans tenue » : l'élève reste dans les saisies (exercice adapté, rôle d'observateur…).</p></div>${groupChips(UI.appelG ?? null, 'appelGrp')}
    <div class="tiles">${list.filter(s => UI.appelG == null || (s.grp || 0) === UI.appelG).map(s => { const a = attOf(n, s.id);
      return `<button class="tile att ${a ? ATT[a].cls : 'ok'}" data-action="pickAtt" data-sid="${s.id}">${band(s.id)}<span class="name">${esc(nameOf(s.id))}</span><span class="meta">${a ? ATT[a].ico + ' ' + ATT[a].n : '✓ Présent'}</span></button>`; }).join('')}</div>`;
}
function profCibles(){
  const ls = Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1), from = UI.ciblesL || Math.max(1, curLesson() - 1);
  return `<div class="card"><h3>Calculer les cibles à partir des résultats</h3>
    <div class="btn-row"><span>Leçon</span><select id="cib-l">${ls.map(l => `<option value="${l}" ${l === from ? 'selected' : ''}>${l}</option>`).join('')}<option value="all" ${from === 'all' ? 'selected' : ''}>toutes</option></select>
      <button class="btn small primary" data-action="autoTargets" data-m="best">Meilleur résultat</button><button class="btn small" data-action="autoTargets" data-m="mean">Moyenne</button>
      <span>puis</span><button class="btn small" data-action="shiftTargets" data-d="1">＋1 cran</button><button class="btn small" data-action="shiftTargets" data-d="-1">−1 cran</button></div>
    <p class="muted">La cible reste la référence jusqu'au prochain changement. Les cases restent modifiables une par une.</p></div>
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>Élève</th>${TFIELDS.map(f => `<th>${esc(f.label)}${f.unit ? ` (${esc(f.unit)})` : ''}</th>`).join('')}</tr></thead><tbody>
    ${sortedStudents().map(s => `<tr><td class="nm">${band(s.id)}${esc(nameOf(s.id))}</td>${TFIELDS.map(f => `<td><input type="number" step="any" inputmode="decimal" class="tg-in" data-sid="${s.id}" data-f="${f.id}" value="${targetOf(s.id, f) ?? ''}"></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}
function profRoles(){
  const n = curLesson();
  return `<div class="card"><div class="btn-row spread"><b>Leçon ${n} · ${CFG.rotate ? 'rotation automatique dans chaque groupe' : 'rôles attribués à la main'}</b>
    <div class="btn-row">${CFG.rotate ? `<button class="btn small" data-action="shiftRoles">🔄 Décaler les rôles</button>` : ''}<button class="btn small ghost" data-action="resetRoles">↺ Réinitialiser</button></div></div>
    <p class="muted">Touchez un élève pour changer son rôle.</p></div>
    <div class="legend">${CFG.roles.map((r, i) => `<span class="tag role r${i % 6}">${esc(r.n)}</span>${r.d ? ` <small class="muted">${esc(r.d)}</small>` : ''}`).join(' · ')}</div>
    ${Array.from({ length:nbGroups() }, (_, g) => { const mates = sortedStudents().filter(s => (s.grp || 0) === g); if (!mates.length) return '';
      return `<div class="card">${nbGroups() > 1 ? `<h3><span class="dot" style="background:${groupColor(g).c}"></span> Groupe ${groupColor(g).n}</h3>` : ''}<div class="tiles">
        ${mates.map(s => { const i = roleIdx(n, s.id), a = attOf(n, s.id); return `<button class="tile ${a ? 'off' : ''}" data-action="cycleRole" data-sid="${s.id}">${band(s.id)}<span class="name">${esc(nameOf(s.id))}</span>
          ${a ? `<span class="tag ${ATT[a].cls}">${ATT[a].n}</span>` : i != null ? `<span class="tag role r${i % 6}">${esc(CFG.roles[i].n)}</span>` : ''}</button>`; }).join('')}</div></div>`; }).join('')}`;
}
function profQR(){
  return `<div class="card center"><b>Sur chaque tablette élève : Accueil → 📷 Recevoir la leçon.</b><br><span class="muted">Écran à 30–40 cm, luminosité au maximum. Les QR défilent seuls ; touchez un numéro manquant pour l'afficher.</span></div>
    <div id="qr-seance" class="center">Préparation…</div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn" data-action="fileSeance">📤 Partager la leçon en fichier (AirDrop…)</button></div>`;
}
function waitList(){
  const n = curLesson(), got = S.students.filter(s => res(n, s.id)), miss = S.students.filter(s => !res(n, s.id) && !attOf(n, s.id));
  return `<b>Leçon ${n} : ${got.length} fiche(s) reçue(s)</b>${miss.length ? `<div class="muted">Sans saisie : ${miss.map(s => esc(nameOf(s.id))).join(', ')}</div>` : '<div class="muted">Tous les élèves présents ont une saisie.</div>'}`;
}
function profRecup(){
  return `<div class="card center"><b>Sur chaque tablette élève : 📤 Envoyer mes saisies, puis scannez ici.</b><br><span class="muted">La caméra reste allumée : enchaînez les tablettes.</span></div>
    <div class="card" id="wait-box">${waitList()}</div><div id="scan-area"></div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><label class="btn">📂 Importer un fichier (.json)<input type="file" id="file-sync" accept=".json,application/json" hidden></label></div>`;
}
function profResultats(){
  const n = UI.resL || curLesson(), ls = Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1), shown = FIELDS;
  return `${SEANCE ? '' : `<div class="card"><div class="btn-row"><b>Leçon</b>${ls.map(l => `<button class="chip ${l === n ? 'on' : ''}" data-action="resL" data-n="${l}">${l}</button>`).join('')}
    <button class="chip ${UI.resL === 'evo' ? 'on' : ''}" data-action="resL" data-n="evo">📈 Évolution</button></div></div>`}
    ${UI.resL === 'evo' ? evoTable() : bilanCard(n) + `<div class="card scroll-x"><table class="tbl"><thead><tr><th>Élève</th>${CFG.roles.length ? '<th>Rôle</th>' : ''}${shown.map(f => `<th>${esc(f.label)}${f.per === 'try' && tries(n) > 1 ? `<br><small>${AGG_N[f.agg] || ''}</small>` : ''}</th>`).join('')}</tr></thead><tbody>
    ${sortedStudents().map(s => { const a = attOf(n, s.id), C = res(n, s.id) ? calcAll(n, s.id) : null, ro = roleOf(n, s.id);
      return `<tr><td class="nm"><button class="lnk" data-action="stuDetail" data-sid="${s.id}">${band(s.id)}${esc(nameOf(s.id))}</button></td>${CFG.roles.length ? `<td>${ro ? esc(ro.n) : ''}</td>` : ''}
        ${isOff(a) ? `<td colspan="${shown.length}" class="muted">${ATT[a].n}</td>` : shown.map(f => { const v = C ? C.L[f.id] : null, t = f.target ? targetOf(s.id, f) : null;
          return `<td ${f.target ? gapCell(f, v, t) : ''} title="${C && f.per === 'try' ? C.t.map((o, j) => `T${j+1} : ${fmtF(f, o[f.id])}`).join(' · ') : ''}">${fmtF(f, v)}</td>`; }).join('')}</tr>`; }).join('')}
    </tbody></table></div>${TFIELDS.length ? gapLegend() : ''}`}`;
}
const gapLegend = () => `<div class="legend">${GAP7.map(g => `<span class="lg" style="background:${g.c};color:${g.f}">${g.n}</span>`).join('')}</div>`;
function evoTable(){
  const ls = Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1), F = UI.evoF ? fieldById(UI.evoF) : (TFIELDS[0] || FIELDS[0]);
  if (!F) return '';
  return `<div class="card"><div class="btn-row"><b>Saisie</b>${FIELDS.map(f => `<button class="chip ${f === F ? 'on' : ''}" data-action="evoF" data-f="${f.id}">${esc(f.label)}</button>`).join('')}</div></div>
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>Élève</th>${ls.map(l => `<th>L${l}</th>`).join('')}${F.target ? '<th>🎯</th>' : ''}</tr></thead><tbody>
    ${sortedStudents().map(s => { const t = F.target ? targetOf(s.id, F) : null; return `<tr><td class="nm">${band(s.id)}${esc(nameOf(s.id))}</td>${ls.map(l => { const a = attOf(l, s.id), v = lessonVal(l, s.id, F);
      return `<td ${F.target ? gapCell(F, v, t) : ''}>${a ? `<small>${ATT[a].n[0]}</small>` : fmtF(F, v)}</td>`; }).join('')}${F.target ? `<td><b>${fmtF(F, t)}</b></td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
}
function stuDetail(sid){
  const ls = Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1).filter(l => hasData(l, sid) || attOf(l, sid));
  modal(`<h2>${esc(nameOf(sid))} <small class="muted">· ${esc(className())} · ${esc(CFG.name)}</small></h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Leçon</th>${FIELDS.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>
    ${ls.map(l => { const a = attOf(l, sid); return `<tr><td>${SEANCE ? 'Séance' : 'L' + l}</td>${isOff(a) ? `<td colspan="${FIELDS.length}">${ATT[a].n}</td>` : FIELDS.map(f => { const v = lessonVal(l, sid, f), t = f.target ? targetOf(sid, f) : null; return `<td ${f.target ? gapCell(f, v, t) : ''}>${fmtF(f, v)}</td>`; }).join('')}</tr>`; }).join('') || `<tr><td colspan="${FIELDS.length + 1}">Aucune donnée</td></tr>`}
    ${TFIELDS.length ? `<tr><td>🎯</td>${FIELDS.map(f => `<td><b>${f.target ? fmtF(f, targetOf(sid, f)) : ''}</b></td>`).join('')}</tr>` : ''}</tbody></table></div>
    ${CFG.grade.on && CFG.grade.items.length ? (() => { const G = gradeOf(sid); return `<h3 style="margin-top:14px">Note : ${G.onTotal == null ? '—' : fmtN(G.onTotal, 2) + ' / ' + CFG.grade.total}</h3>`; })() : ''}
    ${FRS.length ? `<h3 style="margin-top:14px">Fils rouges</h3>${frStrip(sid)}<p>${FRS.map(fr => `${esc(fr.nom)} : ${frFinal(fr, sid) ? '<b>' + COMP_LV[frFinal(fr, sid)].n + '</b>' : frSuggest(fr, sid) ? 'proposé ' + COMP_LV[frSuggest(fr, sid)].n : '—'}`).join(' · ')}</p>` : ''}
    ${(() => { const r = ls.map(l => noteOf(l, sid) ? `<li>${SEANCE ? '' : 'L' + l + ' : '}${esc(noteOf(l, sid))}</li>` : '').join(''); return r ? `<h3 style="margin-top:14px">📝 Remarques</h3><ul>${r}</ul>` : ''; })()}
    <div class="btn-row spread no-print" style="margin-top:12px"><button class="btn" data-print>🖨 Imprimer la fiche</button><button class="btn primary" data-close>Fermer</button></div>`, { wide:true });
  const m = $('#modal-root .modal'); m.querySelector('[data-close]').onclick = closeModal;
  m.querySelector('[data-print]').onclick = () => { document.body.classList.add('print-modal'); window.print(); setTimeout(() => document.body.classList.remove('print-modal'), 500); };
}
function profNotes(){
  const G = CFG.grade, ls = gradeLessons();
  return `${SEANCE ? '' : `<div class="card"><b>Leçons prises en compte : ${ls.join(', ')}</b> <span class="muted">(${S.settings.nbLessons && ls.length === S.settings.nbLessons ? 'aucune leçon d\'évaluation : toutes les leçons' : 'leçons d\'évaluation'})</span></div>`}
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>Élève</th>${G.items.map(it => { const f = fieldById(it.field); return `<th>${esc(it.label || (f ? f.label : '?'))}<br><small>${String(it.field).startsWith('fr:') ? 'niveau final 1 → 4' : FROM_N[it.from]} · /${fmtN(it.pts, 2)}</small></th>`; }).join('')}<th>Total<br><small>/${CFG.grade.total}</small></th></tr></thead><tbody>
    ${sortedStudents().map(s => { const R = gradeOf(s.id); return `<tr><td class="nm">${band(s.id)}${esc(nameOf(s.id))}</td>${R.items.map(x => { const f = fieldById(x.it.field);
      return `<td>${x.p == null ? '—' : `<b>${fmtN(x.p, 2)}</b>`}<br><small class="muted">${x.it.from === 'cible' ? (x.v == null ? '' : x.v + ' %') : f ? fmtF(f, x.v) : (x.v ? COMP_LV[x.v].n : '')}</small></td>`; }).join('')}
      <td><b class="note">${R.onTotal == null ? '—' : fmtN(R.onTotal, 2)}</b></td></tr>`; }).join('')}</tbody></table></div>`;
}
function profExport(){
  return `<div class="card"><h3>Export</h3><div class="btn-row"><button class="btn primary" data-action="excel">📊 Export Excel (${esc(className())})</button>
      <button class="btn" data-action="backup">💾 Sauvegarde complète (.json)</button><label class="btn">📂 Restaurer / importer<input type="file" id="file-sync" accept=".json,application/json" hidden></label></div></div>
    <div class="card"><h3>Réglages</h3>
      <div class="form-row"><span>Code enseignant (4 chiffres)</span><button class="btn small" data-action="setPin">${'•'.repeat(4)} ✎</button></div>
      <div class="form-row"><span>Rôle de cette tablette</span><button class="btn small" data-action="toEleve">📋 Passer en tablette élève</button></div>
      <div class="form-row"><span>Effacer les saisies de ${SEANCE ? 'la séance' : 'la leçon ' + curLesson()}</span><button class="btn small red" data-action="clearLesson">🗑 Effacer</button></div></div>
    ${appQRCard()}
    <div class="card muted">${esc(CFG.name)} · v${esc(APP_VERSION)}${CFG.author ? ' · ' + esc(CFG.author) : ''} · conçue avec la Fabrique N'EPS</div>`;
}
const appURL = () => location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
function appQRCard(){
  if (!/^https?:/.test(location.protocol) || PREVIEW || !window.qrcode) return '';
  const qr = qrcode(0, 'M'); qr.addData(appURL()); qr.make();
  return `<div class="card app-qr"><img src="${qr.createDataURL(5, 16)}" alt="QR d'accès à l'application">
    <div><b>📲 Accès à l'application</b><div class="muted">Scannez avec l'appareil photo d'une tablette pour ouvrir l'appli, puis « Ajouter à l'écran d'accueil ».</div><div class="app-url">${esc(appURL())}</div></div></div>`;
}
function pinPad(onOk, title='🔒 Code enseignant'){
  let code = '';
  const m = modal(`<h2 class="center">${title}</h2><div class="pin-dots">${'<span></span>'.repeat(4)}</div>
    <div class="pin-pad">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✕'].map(k=>`<button data-k="${k}">${k}</button>`).join('')}</div>
    <p class="center muted" style="font-size:14px">Code par défaut : 0000 (modifiable dans Export & réglages)</p>`);
  const dots = m.querySelectorAll('.pin-dots span');
  m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === '✕') return closeModal();
    if (k === '⌫') code = code.slice(0,-1); else if (code.length < 4) code += k;
    dots.forEach((d,i)=>d.classList.toggle('f', i < code.length));
    if (code.length === 4) {
      if (code === String(ROOT.pin || '0000')) { closeModal(); onOk(); }
      else { toast('Code incorrect'); code=''; dots.forEach(d=>d.classList.remove('f')); }
    }
  });
}

/* Bilan de la leçon : présence, fiches complètes, moyenne et cibles atteintes par saisie */
function bilanCard(n){
  const list = S.students, pres = list.filter(s => !isOff(attOf(n, s.id))), done = pres.filter(s => entryDone(n, s.id)).length;
  const rows = FIELDS.map(f => { const v = vals(pres.map(s => res(n, s.id) ? calcAll(n, s.id).L[f.id] : null)); if (!v.length) return '';
    const tg = f.target ? pres.filter(s => targetOf(s.id, f) != null && res(n, s.id)) : [], ok = tg.filter(s => reached(f, calcAll(n, s.id).L[f.id], targetOf(s.id, f))).length;
    return `<div class="bil-f"><b>${esc(f.label)}</b><span>moyenne ${fmtF(f, avg(v))}</span><span>meilleur ${fmtF(f, f.better === 'low' ? Math.min(...v) : Math.max(...v))}</span>${tg.length ? `<span>🎯 ${ok}/${tg.length} cibles atteintes</span>` : ''}</div>`; }).join('');
  return `<div class="card bilan"><div class="bil-top"><span class="big-n">${pres.length}<small>/${list.length} présents</small></span><span class="big-n">${done}<small> fiche(s) complète(s)</small></span></div>${rows}</div>`;
}
/* Classement d'une saisie (leçon choisie, meilleure leçon du cycle ou progrès) */
function profClassement(){
  const F = UI.clF ? fieldById(UI.clF) : (TFIELDS[0] || FIELDS[0]), mode = SEANCE ? 'l' : (UI.clM || 'l'), n = curLesson();
  if (!F) return '<div class="card">Aucune saisie.</div>';
  const val = sid => { if (mode === 'l') return isOff(attOf(n, sid)) ? null : lessonVal(n, sid, F);
    const a = Array.from({ length:S.settings.nbLessons }, (_, i) => lessonVal(i + 1, sid, F)).filter(v => v != null); if (!a.length) return null;
    if (mode === 'p') return a.length < 2 ? null : (F.better === 'low' ? a[0] - a[a.length - 1] : a[a.length - 1] - a[0]);
    return F.better === 'low' ? Math.min(...a) : Math.max(...a); };
  const low = F.better === 'low' && mode !== 'p', rows = S.students.map(s => ({ s, v: val(s.id) })).filter(x => x.v != null).sort((a, b) => low ? a.v - b.v : b.v - a.v);
  const g = UI.clG ?? null, R = rows.filter(x => g == null || (x.s.grp || 0) === g), medal = ['🥇','🥈','🥉'];
  return `<div class="card"><div class="btn-row"><b>Saisie</b>${FIELDS.map(f => `<button class="chip ${f === F ? 'on' : ''}" data-action="clF" data-f="${f.id}">${esc(f.label)}</button>`).join('')}</div>
    ${SEANCE ? '' : `<div class="btn-row" style="margin-top:8px"><b>Classer selon</b>${[['l', 'la leçon ' + n], ['b', 'la meilleure leçon du cycle'], ['p', 'le progrès']].map(([k, l]) => `<button class="chip ${mode === k ? 'on' : ''}" data-action="clM" data-m="${k}">${l}</button>`).join('')}</div>`}</div>
    ${groupChips(g, 'clG')}
    <div class="card"><ol class="rank">${R.map((x, i) => { const pos = rows.indexOf(x); return `<li class="${pos < 3 ? 'top' : ''}"><span class="rk">${pos < 3 ? medal[pos] : pos + 1}</span>${band(x.s.id)}<b>${esc(nameOf(x.s.id))}</b><span class="rv">${mode === 'p' ? (x.v >= 0 ? '+' : '') : ''}${fmtF(F, x.v)}</span></li>`; }).join('') || '<li class="muted">Pas encore de résultats.</li>'}</ol>
    <p class="muted small">À utiliser avec discernement : le classement par progrès valorise l'investissement de chacun.</p></div>`;
}

/* =====================================================================
   SOCLE N'EPS — modules repris de Biathlon et généralisés :
   groupes automatiques, bilans (par leçon, collectif, projection), fils rouges
   ===================================================================== */

/* ---------------------------------------------------------------------
   Groupes (= tablettes) : manuel (toucher un élève puis un groupe) ou automatique
   niveau = critères réussis (dernière leçon observée) ou rang de performance sur une saisie
   --------------------------------------------------------------------- */
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const CRIT_F = FIELDS.filter(f => f.type === 'criteres');
const LEVEL_F = FIELDS.filter(f => f.type !== 'chrono' || true);
/* % de réussite de chaque critère pour un élève dans une leçon (essais confondus) */
function critPerCrit(n, sid, f){
  const r = res(n, sid); if (!r) return null; const v = r.v[f.id]; if (!v) return null;
  const arrs = f.per === 'try' ? v.filter(Array.isArray) : [v];
  const out = f.criteres.map((_, i) => { const o = arrs.map(a => a[i]).filter(x => x != null); return o.length ? o.filter(x => x).length / o.length * 100 : null; });
  return out.some(x => x != null) ? out : null;
}
function perfRank(f){
  const ms = S.students.map(s => { const v = []; for (let n = 1; n <= S.settings.nbLessons; n++) { const x = lessonVal(n, s.id, f); if (x != null) v.push(x); } return { id:s.id, m: v.length ? avg(v) : null }; })
    .filter(x => x.m != null).sort((x, y) => f.better === 'low' ? y.m - x.m : x.m - y.m);
  const out = {}; ms.forEach((x, i) => out[x.id] = ms.length > 1 ? i / (ms.length - 1) * 100 : 50); return out;
}
function levelOf(sid, f, pr){
  if (f && f.type === 'criteres') for (let n = curLesson(); n >= 1; n--) { const c = critPerCrit(n, sid, f); if (!c) continue;
    let k = -1; c.forEach((p, j) => { if (p != null && (k < 0 || p < c[k])) k = j; });
    return { v: avg(vals(c)), src:'q', n, crit: k >= 0 && c[k] < 75 ? k : null }; }
  return pr[sid] != null ? { v: pr[sid], src:'p' } : { v:null, src:null };
}
function proposeGroups(mode, fid, mix){
  const G = nbGroups(), f = fieldById(fid), pr = f ? perfRank(f) : {};
  const st = S.students.map(s => ({ s, lv: levelOf(s.id, f, pr), cat: mix ? (s.sx || '?') : '*' }));
  const groups = Array.from({ length:G }, () => []);
  if (mode === 'need') {                       // par besoin : même critère à retravailler → même groupe (tailles équilibrées)
    const key = x => x.lv.src === 'q' ? (x.lv.crit != null ? x.lv.crit : 50) : x.lv.src === 'p' ? 80 + x.lv.v / 1000 : 90;
    let order = shuffle(st).sort((x, y) => key(x) - key(y) || (x.lv.v ?? 0) - (y.lv.v ?? 0));
    if (mix) { const byK = {}; order.forEach(x => (byK[Math.floor(key(x))] = byK[Math.floor(key(x))] || []).push(x));
      order = Object.keys(byK).sort((x, y) => x - y).flatMap(k => { const F = byK[k].filter(x => x.cat === 'F'), O = byK[k].filter(x => x.cat !== 'F'), r = [];
        while (F.length || O.length) { if (F.length) r.push(F.shift()); if (O.length) r.push(O.shift()); } return r; }); }
    const base = Math.floor(order.length / G), extra = order.length % G; let p = 0;
    for (let g = 0; g < G; g++) { const sz = base + (g < extra ? 1 : 0); groups[g] = order.slice(p, p + sz); p += sz; }
  } else {                                     // hétérogènes / aléatoire : élève suivant → groupe le moins rempli (dans sa catégorie F/G)
    const order = mode === 'het' ? [...shuffle(st.filter(x => x.lv.v != null)).sort((x, y) => y.lv.v - x.lv.v), ...shuffle(st.filter(x => x.lv.v == null))] : shuffle(st);
    const cats = mix ? ['F', 'G', '?'] : ['*'], sum = g => groups[g].reduce((t, x) => t + (x.lv.v ?? 50), 0);
    cats.forEach(c => order.filter(x => x.cat === c).forEach(x => { let best = null;
      for (const g of shuffle(Array.from({ length:G }, (_, i) => i))) {
        const sc = [groups[g].filter(y => y.cat === c).length, groups[g].length, mode === 'het' ? sum(g) : 0];
        if (!best || sc[0] < best.sc[0] || (sc[0] === best.sc[0] && (sc[1] < best.sc[1] || (sc[1] === best.sc[1] && sc[2] < best.sc[2])))) best = { g, sc }; }
      groups[best.g].push(x); }));
  }
  return { groups, f, mode, mix };
}
function profGroupes(){
  const G = nbGroups(), list = sortedStudents(), sel = UI.gsel;
  const ag = UI.ag = UI.ag || { mode:'het', mix: CFG.sexe, f: (CRIT_F[0] || TFIELDS[0] || FIELDS[0] || {}).id };
  const nF = S.students.filter(s => s.sx === 'F').length, nG = S.students.filter(s => s.sx === 'G').length;
  const M = [['het', '⚖️ Hétérogènes', 'Niveaux mélangés dans chaque groupe'], ['need', '🎯 Par besoin', CRIT_F.length ? 'Même critère à retravailler ensemble' : 'Niveaux proches ensemble'], ['rand', '🎲 Aléatoire', 'Tirage au sort']];
  return `<div class="card"><div class="btn-row spread"><h3 style="margin:0">Nombre de groupes (= tablettes)</h3>${stepper('nbGroups', G)}</div>
      <p class="muted">Une tablette par groupe : chaque tablette n'affiche que les élèves de son groupe.</p></div>
    ${G > 1 ? `<div class="card strong ag-card"><h3>⚡ Remplissage automatique</h3>
      <div class="ag-modes">${M.map(([k, t, d]) => `<button class="ag-mode ${ag.mode === k ? 'on' : ''}" data-action="agSet" data-k="mode" data-v="${k}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
      ${ag.mode !== 'rand' && FIELDS.length ? `<div class="ag-line"><b>Niveau d'après :</b> ${FIELDS.filter(f => f.type !== 'choice' || true).map(f => `<button class="chip ${ag.f === f.id ? 'on' : ''}" data-action="agSet" data-k="f" data-v="${f.id}">${esc(f.label)}</button>`).join('')}</div>
        <div class="muted ag-hint">${fieldById(ag.f)?.type === 'criteres' ? 'Niveau = critères réussis à la dernière leçon observée ; « par besoin » regroupe ceux qui ont le même critère à retravailler.' : 'Niveau = rang de l\'élève sur cette saisie (moyenne des leçons). Élève sans résultat : réparti au hasard.'}</div>` : ''}
      ${CFG.sexe ? `<div class="ag-line"><button class="chip ${ag.mix ? 'on' : ''}" data-action="agSet" data-k="mix" data-v="${ag.mix ? 0 : 1}">${ag.mix ? '☑' : '☐'} Mixité F / G équilibrée</button><span class="muted">${nF} F · ${nG} G${S.students.length - nF - nG ? ` · <b>${S.students.length - nF - nG} non renseigné(s)</b>` : ''}</span></div>` : ''}
      <button class="btn primary" data-action="agPropose">✨ Proposer ${G} groupes</button></div>` : ''}
    ${G > 1 ? `<div class="card"><b>${sel ? `Touchez le groupe où mettre ${esc(nameOf(sel))}` : 'Pour déplacer un élève : touchez-le, puis touchez son nouveau groupe.'}</b></div>
    <div class="g-grid">${Array.from({ length:G }, (_, g) => { const L = list.filter(s => (s.grp || 0) === g), c = groupColor(g);
      return `<div class="g-col ${sel ? 'target' : ''}" data-action="gMove" data-g="${g}" style="border-top:10px solid ${c.c}"><h3>${c.n} <span class="muted">· ${L.length}${CFG.sexe ? ` · ${L.filter(s => s.sx === 'F').length} F / ${L.filter(s => s.sx === 'G').length} G` : ''}</span></h3>
        ${L.map(s => `<button class="g-st ${sel === s.id ? 'sel' : ''}" data-action="gSel" data-sid="${s.id}">${esc(nameOf(s.id))}${s.sx ? ` <span class="sx ${s.sx}">${s.sx}</span>` : ''}</button>`).join('')}</div>`; }).join('')}</div>` : ''}`;
}
function showGroupProposal(){
  const ag = UI.ag, P = UI.agProp = proposeGroups(ag.mode, ag.f, ag.mix && CFG.sexe);
  const lvTxt = x => x.lv.src === 'q' ? `👀 ${Math.round(x.lv.v)} %` : x.lv.src === 'p' ? `📈 ${Math.round(x.lv.v)}` : '';
  const col = (list, g) => { const c = groupColor(g), F = list.filter(x => x.s.sx === 'F').length, Gc = list.filter(x => x.s.sx === 'G').length, lv = list.filter(x => x.lv.v != null), needs = {};
    list.forEach(x => { if (x.lv.crit != null) needs[x.lv.crit] = (needs[x.lv.crit] || 0) + 1; });
    return `<div class="agp-col" style="border-top:8px solid ${c.c}"><h3>${c.n} <span class="muted">· ${list.length}</span></h3>
      <div class="agp-meta">${CFG.sexe ? `${F} F · ${Gc} G` : ''}${lv.length ? ` · niveau moy. ${Math.round(avg(lv.map(x => x.lv.v)))}` : ''}</div>
      ${P.mode === 'need' && P.f?.type === 'criteres' && Object.keys(needs).length ? `<div class="agp-need">🎯 ${Object.entries(needs).sort((x, y) => y[1] - x[1]).map(([i, k]) => `${esc(P.f.criteres[+i] || '')} (${k})`).join(' · ')}</div>` : ''}
      ${list.map(x => `<div class="agp-st">${esc(nameOf(x.s.id))}${x.s.sx ? ` <span class="sx ${x.s.sx}">${x.s.sx}</span>` : ''}<span class="agp-lv">${lvTxt(x)}</span></div>`).join('')}</div>`; };
  const m = modal(`<h2>✨ Proposition de groupes</h2>
    <div class="muted">${{ het:'⚖️ Hétérogènes', need:'🎯 Par besoin', rand:'🎲 Aléatoire' }[P.mode]}${P.mode !== 'rand' && P.f ? ' · ' + esc(P.f.label) : ''}${P.mix ? ' · mixité F/G' : ''} · 👀 = critères réussis · 📈 = rang /100</div>
    <div class="agp-grid">${P.groups.map(col).join('')}</div>
    <div class="btn-row spread"><button class="btn ghost" data-r="0">Annuler</button><button class="btn" data-r="2">🎲 Relancer</button><button class="btn green" data-r="1">✓ Appliquer ces groupes</button></div>`, { wide:true });
  m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { if (b.dataset.r === '2') return showGroupProposal(); closeModal();
    if (b.dataset.r === '1') { P.groups.forEach((list, g) => list.forEach(x => x.s.grp = g)); save(); render(); toast('✓ Groupes appliqués : renvoyez le QR de la ' + LECON); } });
}

/* ---------------------------------------------------------------------
   Bilan par leçon : qui progresse, qui manque d'investissement, qui encourager
   --------------------------------------------------------------------- */
function lessonInsight(n, sid){
  const at = attOf(n, sid); if (isOff(at)) return { at };
  const o = { prog:[], inv:[], enc:[] }, r = res(n, sid);
  if (!r) { o.inv.push('aucune saisie'); return o; }
  INPUTS.filter(f => f.per === 'try').forEach(f => { const k = tries(n), d = Array.from({ length:k }, (_, j) => rawVal(n, sid, f, j)).filter(v => f.type === 'criteres' ? critFull(v) : v != null).length;
    if (d < k) o.inv.push(`${f.label} : ${d}/${k} essai${k > 1 ? 's' : ''}`); });
  FIELDS.filter(f => f.type !== 'choice').forEach(f => { const v = lessonVal(n, sid, f); if (v == null) return;
    const R = fieldRange(f) || Math.abs(v) || 1, sg = f.better === 'low' ? -1 : 1, u = f.type === 'criteres' ? ' %' : (f.unit ? ' ' + f.unit : '');
    let pv = null; for (let k = n - 1; k >= 1 && pv == null; k--) pv = lessonVal(k, sid, f);
    if (pv != null) { const d = (v - pv) * sg / R; if (d >= 0.05) o.prog.push(`${f.label} ${sg * (v - pv) > 0 && f.better === 'low' ? '−' : '+'}${fmtN(Math.abs(v - pv), f.dec)}${u}`); if (d <= -0.05) o.enc.push(`${f.label} en baisse`); }
    const t = f.target ? targetOf(sid, f) : null;
    if (t != null) { const g = (v - t) * sg / R; if (g >= 0.05) o.prog.push(`${f.label} au-dessus de la cible`); if (g <= -0.15) o.enc.push(`${f.label} loin de la cible`); }
    if (f.type === 'criteres' && v >= 75 && pv == null) o.prog.push(`${f.label} : ${Math.round(v)} % des critères`); });
  if (at === 3) o.enc.push('⚠️ inapte partiel'); if (at === 4) o.enc.push('👕 sans tenue');
  return o;
}
function profBilanL(){
  let n = UI.bilN; if (!n) { n = curLesson(); while (n > 1 && !S.students.some(s => res(n, s.id))) n--; }
  const ins = sortedStudents().map(s => ({ s, o: lessonInsight(n, s.id) })), off = ins.filter(x => x.o.at);
  const grp = (k, t, cls, hint) => { const l = ins.filter(x => !x.o.at && x.o[k].length);
    return `<div class="card bl-col ${cls}"><h3>${t} <span class="muted">· ${l.length}</span></h3><div class="muted bl-hint">${hint}</div>
      ${l.map(x => `<div class="bl-it" data-action="stuDetail" data-sid="${x.s.id}">${band(x.s.id)}<b>${esc(nameOf(x.s.id))}</b><span>${x.o[k].map(esc).join(' · ')}</span></div>`).join('') || '<div class="muted">Personne</div>'}</div>`; };
  return `<div class="card strong"><h3>🔎 Bilan de ${SEANCE ? 'la séance' : 'la leçon ' + n}</h3>
      ${SEANCE ? '' : `<div class="lchips">${Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1).map(k => `<button class="chip ${k === n ? 'on' : ''}" data-action="bilN" data-n="${k}">${k}</button>`).join('')}</div>`}
      <div class="muted">${esc(lesson(n).title || '')}${off.length ? ` · ${off.length} absent(s)/dispensé(s) : ${off.map(x => esc(nameOf(x.s.id))).join(', ')}` : ''}</div>
      ${CRIT_F.some(f => critStats(n, f)?.nb) ? `<button class="btn orange" data-action="proj" data-n="${n}" style="margin-top:8px">📺 Montrer le bilan à la classe</button>` : ''}</div>
    ${bilanCard(n)}${classCrit(n)}
    <div class="bl-grid">${grp('prog', '📈 Ils progressent', 'good', 'En hausse par rapport à la leçon précédente, au-dessus de la cible, ou critères réussis.')}
      ${grp('inv', '⚠️ Manque d\'investissement', 'warn', 'Tous les essais prévus n\'ont pas été faits, ou rien n\'a été saisi.')}
      ${grp('enc', '💬 À encourager', 'enc', 'En baisse, loin de la cible, inapte partiel ou sans tenue.')}</div>`;
}
/* Bilan collectif des critères : % de la classe, élèves en difficulté, critère à retravailler */
const DIFF = 50;
function critStats(n, f){
  const rows = sortedStudents().map(s => ({ s, c: critPerCrit(n, s.id, f) })).filter(x => x.c);
  const cr = f.criteres.map((c, i) => { const v = rows.filter(x => x.c[i] != null);
    return { c, i, p: v.length ? avg(v.map(x => x.c[i])) : null, nb: v.length, ok: v.filter(x => x.c[i] >= DIFF).length, diff: v.filter(x => x.c[i] < DIFF).map(x => x.s.id) }; });
  const obs = cr.filter(x => x.p != null), low = obs.length ? obs.reduce((m, x) => x.p < m.p ? x : m) : null;
  cr.forEach(x => { x.todo = x.diff.length > 0 && (x === low || x.diff.length / x.nb >= 1/3); });
  return { f, nb: rows.length, cr, low: low && low.diff.length ? low : null, tot: rows.length ? avg(vals(rows.map(x => avg(vals(x.c))))) : null };
}
const pctCol = p => p >= 75 ? '#1E8E3E' : p >= 50 ? '#3FB65C' : p >= 25 ? '#F07000' : '#D0161B';
function classCrit(n){
  return CRIT_F.map(f => { const st = critStats(n, f); if (!st.nb) return '';
    const bar = p => `<div class="cc-bar"><span style="width:${Math.max(p, 2)}%;background:${pctCol(p)}"></span></div><b class="cc-p">${Math.round(p)} %</b>`;
    return `<div class="card cc-card"><h3>👀 ${esc(f.label)} <span class="muted">· ${st.nb} élève(s) observé(s)</span></h3>
      ${st.cr.map(x => `<div class="cc-item ${x.todo ? 'low' : ''}"><div class="cc-row"><span class="cc-c">${esc(x.c)}</span>${x.p == null ? '<span class="muted">—</span>' : bar(x.p)}${x.todo ? '<span class="cc-tag">⚠ à retravailler</span>' : x.p != null ? `<span class="cc-ok">✓ ${x.ok}/${x.nb}</span>` : ''}</div>
        ${x.p != null && x.diff.length ? `<div class="cc-diff"><b>${x.diff.length} en difficulté :</b> ${x.diff.map(id => `<button class="cc-st" data-action="stuDetail" data-sid="${id}">${esc(nameOf(id))}</button>`).join('')}</div>` : ''}</div>`).join('')}
      ${st.cr.length > 1 && st.tot != null ? `<div class="cc-row tot"><span class="cc-c">Moyenne de la classe</span>${bar(st.tot)}</div>` : ''}</div>`; }).join('');
}
/* Données compactes du bilan collectif (aussi envoyées aux tablettes élèves avec la leçon suivante) */
function bcData(n){ const F = CRIT_F.map(f => { const st = critStats(n, f); if (!st.nb) return null; return [f.label, st.cr.filter(x => x.p != null).map(x => [x.c, x.ok, x.nb, x.todo ? 1 : 0, x.diff.length]), st.low ? st.low.c : '']; }).filter(Boolean);
  return F.length ? { n, F } : null; }
function prevBilanLesson(n){ for (let k = n - 1; k >= 1; k--) if (bcData(k)) return k; return null; }
/* Mode projection : plein écran, gros caractères, sans noms d'élèves */
function showProj(B){
  if (!B) return toast('Aucune observation de critères pour cette leçon');
  const body = B.F.map(([lab, cr, low]) => `<div class="pj-card"><h2>👀 ${esc(lab)}</h2>${cr.map(([c, ok, nb, todo, nd]) => `<div class="pj-cr ${todo ? 'todo' : 'ok'}"><div class="pj-ico">${todo ? '⚠️' : '✅'}</div>
      <div class="pj-txt"><div class="pj-name">${esc(c)}</div><div class="pj-sub">réussi par <b>${ok} élève${ok > 1 ? 's' : ''} sur ${nb}</b>${todo ? ` · à retravailler (${nd})` : ''}</div>
      <div class="pj-bar"><span style="width:${nb ? Math.max(ok / nb * 100, 2) : 0}%"></span></div></div></div>`).join('')}
    ${low ? `<div class="pj-next">🎯 La prochaine fois, on se concentre sur : <b>« ${esc(low)} »</b></div>` : '<div class="pj-next good">👏 Bravo, critères réussis par toute la classe !</div>'}</div>`).join('');
  const root = $('#modal-root');
  root.innerHTML = `<div class="proj-full"><div class="proj-top"><div class="proj-t">📊 Bilan de la classe${SEANCE ? '' : ' · Leçon ' + B.n}<small>${esc(className())}</small></div><button class="btn primary" data-pclose>✕ Fermer</button></div><div class="proj-body">${body}</div></div>`;
  root.querySelector('[data-pclose]').onclick = closeModal;
}

/* ---------------------------------------------------------------------
   Fils rouges : une compétence suivie leçon après leçon (4 niveaux),
   proposée par l'appli, décidée par l'enseignant. Plusieurs fils possibles
   (ex. 🧶 investissement + 🧵 méthodo).
   Règles : cible · criteres · echelle · completude · prof · fonction
   --------------------------------------------------------------------- */
const COMP_LV = [null, { n:'Insuffisante', c:'#D0161B', f:'#fff' }, { n:'Fragile', c:'#F07000', f:'#fff' }, { n:'Satisfaisante', c:'#86DC96', f:'#0A1633' }, { n:'Très bonne', c:'#0B4F1C', f:'#fff' }];
const FRS = CFG.filsRouges;
const lvFromPct = (p, s) => p >= s[2] ? 4 : p >= s[1] ? 3 : p >= s[0] ? 2 : 1;
const frStore = () => (S.frl = S.frl || {});
function frLesson(fr, n, sid){
  const at = attOf(n, sid); if (isOff(at)) return { at };
  if (!SEANCE && n > curLesson()) return null;
  const R = fr.regle, f = fieldById(R.champ);
  if (R.type === 'prof') { const v = frStore()[fr.id]?.[n]?.[sid]; return v ? { lv:v, why:'niveau donné par l\'enseignant' } : (res(n, sid) ? { lv:null, why:'à évaluer' } : null); }
  if (!S.frs?.[sid] && !res(n, sid)) return null;
  if (!res(n, sid)) { const l = S.frs?.[sid]?.[fr.id]?.[n - 1]; return l ? { lv:l, why:'' } : null; }   // tablette élève : niveaux reçus
  if (R.type === 'fonction' && typeof R.calcul === 'function') { try { return R.calcul(n, sid, API) || null; } catch(e){ return null; } }
  if (R.type === 'cible' && f) {
    const k = f.per === 'try' ? tries(n) : 1, raw = f.per === 'try' ? Array.from({ length:k }, (_, j) => rawVal(n, sid, f, j)) : [rawVal(n, sid, f)];
    const v = vals(raw.map(x => f.type === 'criteres' ? critPct(x) : x)); if (!v.length) return null;
    if (R.toutFait !== false && v.length < k) return n === curLesson() ? { lv:null, why:`en cours : ${v.length}/${k}` } : { lv:1, why:`${v.length}/${k} essais faits` };
    const t = targetOf(sid, f); if (t == null) return { lv:null, why:'sans cible' };
    const sg = f.better === 'low' ? -1 : 1, rg = fieldRange(f) || Math.abs(t) || 1, s = R.seuils || [rg * .05, rg * .15, rg * .25];
    const ec = avg(v.map(x => Math.max(0, (t - x) * sg)));
    return { lv: ec <= s[0] ? 4 : ec <= s[1] ? 3 : ec <= s[2] ? 2 : 1, why:`${v.length}/${k} essais · écart moyen à la cible ${fmtN(ec, 2)}` };
  }
  if (R.type === 'criteres' && f) { const p = lessonVal(n, sid, f); if (p == null) return null; return { lv: lvFromPct(p, R.seuils || [25, 50, 75]), why:`${Math.round(p)} % des critères` }; }
  if (R.type === 'echelle' && f) { const v = lessonVal(n, sid, f); if (v == null) return null;
    let lo = f.min, hi = f.max; if (f.type === 'choice') { const o = f.opts.map(x => x.v); lo = Math.min(...o); hi = Math.max(...o); }
    const lv = hi > lo ? Math.round(1 + (v - lo) / (hi - lo) * 3) : Math.round(v); return { lv: Math.max(1, Math.min(4, lv)), why:`${f.label} : ${fmtF(f, v)}` }; }
  if (R.type === 'completude') { const L = (R.champs || []).map(fieldById).filter(Boolean), F = L.length ? L : INPUTS, k = tries(n); let tot = 0, ok = 0;
    F.forEach(x => { const arr = x.per === 'try' ? Array.from({ length:k }, (_, j) => rawVal(n, sid, x, j)) : [rawVal(n, sid, x)]; tot += arr.length; ok += arr.filter(v => x.type === 'criteres' ? critFull(v) : v != null).length; });
    const p = tot ? ok / tot * 100 : 0; return { lv: lvFromPct(p, R.seuils || [50, 75, 100]), why:`${Math.round(p)} % des saisies faites` }; }
  return null;
}
const frLevels = (fr, sid) => Array.from({ length: SEANCE ? 1 : Math.max(curLesson(), 1) }, (_, i) => frLesson(fr, i + 1, sid));
function frMoy(fr, sid){ const l = frLevels(fr, sid).filter(x => x && x.lv).map(x => x.lv); return l.length ? avg(l) : null; }
const frSuggest = (fr, sid) => { const m = frMoy(fr, sid); return m == null ? null : Math.max(1, Math.min(4, Math.round(m))); };
const frFinal = (fr, sid) => S.comp?.[sid]?.[fr.id] || null;
const compDot = (lv, sug, big) => lv ? `<span class="cdot ${big ? 'big' : ''}" style="background:${COMP_LV[lv].c}" title="${COMP_LV[lv].n}"></span>`
  : sug ? `<span class="cdot sug ${big ? 'big' : ''}" style="border-color:${COMP_LV[sug].c};background:${COMP_LV[sug].c}55" title="Proposé : ${COMP_LV[sug].n}"></span>` : `<span class="cdot none ${big ? 'big' : ''}" title="Non évalué"></span>`;
const yarnIcon = (fr, s=22) => `<svg class="yarn-ico" viewBox="-21 -21 42 42" width="${s}" height="${s}"><circle r="19" fill="${fr.couleur}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
  <path d="M-15 -8 Q 0 -20 15 -6 M-18 2 Q 0 -12 18 4 M-14 11 Q 2 -2 15 12 M-6 -18 Q 8 0 -2 18 M5 -18 Q 16 2 6 18" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2.5" stroke-linecap="round"/></svg>`;
/* la pelote et son fil : un nœud coloré par leçon */
function yarnSVG(fr, sid){
  const L = frLevels(fr, sid), N = Math.max(L.length, 1), cur = curLesson(), x0 = 66, step = 46, W = x0 + N * step + 10, y = 40;
  let thread = `M30 ${y + 4} C 44 ${y + 16}, 52 ${y - 8}, ${x0} ${y}`;
  for (let i = 0; i < N; i++) { const a = x0 + i * step, b = a + step, m = (a + b) / 2; thread += ` S ${m} ${i % 2 ? y - 9 : y + 9}, ${b} ${y}`; }
  const knots = L.map((f, i) => { const n = i + 1, x = x0 + i * step + step / 2, at = f && f.at, fill = at ? '#C9D1E0' : f && f.lv ? COMP_LV[f.lv].c : '#fff';
    return `<g><title>${SEANCE ? 'Séance' : 'L' + n}${at ? ' · ' + ATT[at].n : f ? ' · ' + (f.lv ? COMP_LV[f.lv].n + ' · ' : '') + (f.why || '') : ''}</title>
      ${n === cur && !SEANCE ? `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#F59A1B" stroke-width="3" stroke-dasharray="4 3"/>` : ''}
      <circle cx="${x}" cy="${y}" r="12" fill="${fill}" stroke="${f && (f.lv || at) ? '#fff' : '#B0B8C8'}" stroke-width="3" ${f && (f.lv || at) ? '' : 'stroke-dasharray="3 3"'}/>
      ${at ? `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="900" fill="#0A1633">${at === 1 ? 'A' : 'D'}</text>` : ''}
      <text x="${x}" y="13" text-anchor="middle" font-size="13" font-weight="900" fill="#002E6E">${SEANCE ? '' : 'L' + n}</text></g>`; }).join('');
  return `<svg class="yarn-svg" viewBox="0 0 ${W} 64" style="max-width:${W * 1.25}px"><path d="${thread}" fill="none" stroke="${fr.couleur}" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(26 42)">${yarnIcon(fr, 40).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>${knots}</svg>`;
}
function frStrip(sid){ return FRS.filter(fr => isProf() || fr.eleve !== false).map(fr => { const m = frMoy(fr, sid);
  return `<div class="fr-strip" style="--frc:${fr.couleur}"><div class="fr-h"><b>${yarnIcon(fr)} ${esc(fr.nom)}</b>${m != null ? `<span class="fr-moy">${compDot(Math.round(m), null, true)} ${COMP_LV[Math.round(m)].n}</span>` : ''}</div>${yarnSVG(fr, sid)}</div>`; }).join(''); }
function profFilRouge(){
  if (!FRS.length) return '<div class="card">Aucun fil rouge dans cette appli.</div>';
  return `<div class="card strong"><h3>${FRS.map(fr => yarnIcon(fr, 26)).join(' ')} Fils rouges</h3>
      ${FRS.map(fr => `<div class="comp-legend"><b>${yarnIcon(fr, 18)} ${esc(fr.nom)}</b> · ${esc(fr.explication || '')}</div>`).join('')}
      <div class="comp-legend">${[1, 2, 3, 4].map(k => `${compDot(k)} ${COMP_LV[k].n}`).join(' · ')} · ${compDot(null, 3)} proposé par l'appli · ${compDot(null)} non évalué</div></div>
    ${groupChips(UI.frG ?? null, 'frG')}
    <div class="tiles">${sortedStudents().filter(s => UI.frG == null || (s.grp || 0) === UI.frG).map(s => { const all = FRS.every(fr => frFinal(fr, s.id));
      return `<button class="tile ${all ? 'done' : ''}" data-action="frDetail" data-sid="${s.id}">${band(s.id)}${all ? '<span class="check">✓</span>' : ''}<span class="name">${esc(nameOf(s.id))}</span>
        <span class="comp-row">${FRS.map(fr => `<span>${yarnIcon(fr, 18)} ${compDot(frFinal(fr, s.id), frSuggest(fr, s.id))}</span>`).join(' ')}</span></button>`; }).join('')}</div>`;
}
function frDetailView(sid){
  const N = SEANCE ? 1 : S.settings.nbLessons;
  let rows = '';
  for (let n = 1; n <= N; n++) { const at = attOf(n, sid), L = FRS.map(fr => frLesson(fr, n, sid)); if (!L.some(Boolean) && !at) continue;
    rows += `<tr><td><b>${SEANCE ? 'Séance' : 'L' + n}</b>${at ? ` <span class="tag ${ATT[at].cls}">${ATT[at].n}</span>` : ''}</td>${FRS.map((fr, i) => { const f = L[i];
      if (fr.regle.type === 'prof' && !isOff(at)) return `<td>${[1, 2, 3, 4].map(v => `<button class="mini-lv ${f && f.lv === v ? 'on' : ''}" style="--cc:${COMP_LV[v].c}" data-action="frSet" data-fr="${fr.id}" data-n="${n}" data-sid="${sid}" data-v="${v}" title="${COMP_LV[v].n}"></button>`).join('')}</td>`;
      return `<td>${f && !f.at ? `${compDot(f.lv, null, true)} <span class="d4-why">${f.lv ? `<b>${COMP_LV[f.lv].n}</b> · ` : ''}${esc(f.why || '')}</span>` : ''}</td>`; }).join('')}</tr>`; }
  return `<div class="entry-head">${band(sid)}<div class="entry-name">${esc(nameOf(sid))}</div><button class="btn small" data-action="tab" data-tab="filrouge" style="margin-left:auto">← Retour</button></div>
    ${frStrip(sid)}
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>${SEANCE ? '' : 'Leçon'}</th>${FRS.map(fr => `<th>${esc(fr.nom)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${FRS.length + 1}" class="muted">Pas encore de données</td></tr>`}</tbody></table>
      ${FRS.map(fr => fr.explication ? `<details class="d4-rule"><summary>Comment l'appli calcule « ${esc(fr.nom)} »</summary><p>${esc(fr.explication)}</p></details>` : '').join('')}</div>
    ${FRS.map(fr => { const sg = frSuggest(fr, sid), C = frFinal(fr, sid), m = frMoy(fr, sid);
      return `<div class="card strong comp-pick"><h3>${yarnIcon(fr, 24)} ${esc(fr.nom)} : niveau final (décision de l'enseignant)</h3>
        <div class="comp-aid">Proposition de l'appli : ${sg ? `${compDot(sg)} <b>${COMP_LV[sg].n}</b> (moyenne ${fmtN(m, 1)} / 4)` : '<b>—</b> (pas assez de données)'}</div>
        <div class="comp-btns">${[1, 2, 3, 4].map(v => `<button class="cpk ${C === v ? 'on' : ''} ${sg === v && !C ? 'reco' : ''}" style="--cc:${COMP_LV[v].c};--cf:${COMP_LV[v].f}" data-action="compSet" data-fr="${fr.id}" data-sid="${sid}" data-v="${v}">${COMP_LV[v].n}</button>`).join('')}
          ${C ? `<button class="btn ghost small" data-action="compSet" data-fr="${fr.id}" data-sid="${sid}" data-v="0">Effacer</button>` : ''}</div></div>`; }).join('')}`;
}
/* outils mis à disposition des règles « fonction » écrites dans activite.js */
const API = { res, rawVal, lessonVal, calcAll, targetOf, tries, attOf, fieldById, critPct, critPerCrit, curLesson, avg, vals };

/* =====================================================================
   Échanges entre tablettes (QR codes ou fichiers)
   S = leçon (prof → tablettes) · R = saisies (tablette → prof)
   ===================================================================== */
async function encodePacket(obj){
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) { try { return 'Z' + b45enc(await streamBytes(raw, new CompressionStream('deflate-raw'))); } catch(e){} }
  return 'J' + b45enc(raw);
}
async function decodePacket(str){
  const flag = str[0], bytes = b45dec(str.slice(1));
  let raw = bytes;
  if (flag === 'Z') { if (!window.DecompressionStream) throw new Error('Appareil trop ancien pour décompresser'); raw = await streamBytes(bytes, new DecompressionStream('deflate-raw')); }
  return JSON.parse(new TextDecoder().decode(raw));
}
function buildSeance(n){
  n = n || curLesson(); const L = lesson(n), list = sortedStudents(), tg = {}, hist = {};
  list.forEach(s => {
    TFIELDS.forEach(f => { const t = targetOf(s.id, f); if (t != null) (tg[s.id] = tg[s.id] || {})[f.id] = t; });
    for (let k = 1; k < n; k++) { if (!hasData(k, s.id)) continue; (hist[s.id] = hist[s.id] || {})[k] = FIELDS.map(f => { const v = lessonVal(k, s.id, f); return v == null ? null : r10(v, 3); }); }
  });
  const roles = CFG.roles.length ? Object.fromEntries(list.map(s => [s.id, roleIdx(n, s.id)]).filter(x => x[1] != null)) : null;
  return { k:'seance', a:CFG.id, an:CFG.name, cid:S.id, cn:className(), pin:ROOT.pin, nbL:S.settings.nbLessons, cur:n, ng:nbGroups(),
    L:{ t:L.title, tr:L.tries, ev:L.ev }, st: list.map(s => [s.id, nameOf(s.id), s.grp || 0, attOf(n, s.id)]), tg, hist, ro:roles,
    frs: FRS.length ? Object.fromEntries(list.map(s => [s.id, Object.fromEntries(FRS.map(fr => [fr.id, Array.from({ length:n - 1 }, (_, i) => { const f = frLesson(fr, i + 1, s.id); return f && f.lv || 0; })]))])) : null,
    bc: (k => k ? bcData(k) : null)(prevBilanLesson(n)) };
}
function targetClass(cid, name, create){
  if (cid && ROOT.classes[cid]) return ROOT.classes[cid];
  if (cid && create) { const c = newClassState(name || 'Classe', cid); ROOT.classes[cid] = c; return c; }
  return S;
}
const hasFullNames = c => c.students.some(s => s.nom);
function applySeance(p){
  const c = targetClass(p.cid, p.cn, true);
  if (hasFullNames(c)) throw new Error('QR de la leçon : à scanner sur les tablettes élèves');
  useClass(c.id);
  Object.assign(S.settings, { className:p.cn, nbLessons:p.nbL, current:p.cur, nbGroups:p.ng || 1 });
  ROOT.pin = p.pin || ROOT.pin;
  S.students = p.st.map(a => ({ id:a[0], disp:a[1], grp:a[2] || 0 }));
  const L = lesson(p.cur); L.title = p.L.t || ''; L.tries = p.L.tr || CFG.attempts; L.ev = !!p.L.ev;
  L.att = {}; p.st.forEach(a => { if (a[3]) L.att[a[0]] = a[3]; });
  L.role = { ...(p.ro || {}) }; L.roleS = !!p.ro;
  S.targets = p.tg || {}; S.hist = p.hist || {}; S.frs = p.frs || null; S.bc = p.bc || null;
  ROOT.seance = { cid:S.id, n:p.cur, at:now() };
  save(); toast(`✓ Leçon reçue : ${className()} · leçon ${p.cur}`, 3500);
  go('home');
  return 'done';
}
function buildMine(all){
  const R = {}; let count = 0; const cur = curLesson();
  Object.entries(S.results).forEach(([n, byS]) => { if (!all && +n !== cur) return;
    Object.entries(byS).forEach(([sid, r]) => { if (r.d === ROOT.deviceId) { (R[n] = R[n] || {})[sid] = r; count++; } }); });
  return { pkt:{ k:'res', a:CFG.id, an:CFG.name, cid:S.id, from:ROOT.deviceId, at:now(), R }, count };
}
function mergeRes(R){
  let n = 0;
  Object.entries(R || {}).forEach(([l, byS]) => Object.entries(byS || {}).forEach(([sid, r]) => {
    S.results[l] = S.results[l] || {}; const cur = S.results[l][sid];
    if (!cur || (r.ts || 0) > (cur.ts || 0)) { S.results[l][sid] = r; n++; } }));
  return n;
}
async function applyPacket(p){
  if (!p || !p.k) throw new Error('Données non reconnues');
  if (p.a && p.a !== CFG.id) throw new Error(`Ce QR vient d'une autre appli (${p.an || p.a})`);
  if (p.k === 'seance') { if (isProf()) throw new Error('QR de la leçon : à scanner sur les tablettes élèves'); return applySeance(p); }
  if (p.k === 'res') {
    if (!isProf()) throw new Error('QR des saisies : à scanner sur la tablette enseignant');
    if (!ROOT.classes[p.cid]) throw new Error('Classe inconnue sur cette tablette');
    const prev = S.id; useClass(p.cid); const n = mergeRes(p.R); useClass(prev); save();
    toast(`✓ ${className(ROOT.classes[p.cid])} · tablette ${p.from} : ${n} fiche(s) récupérée(s)`, 3500); return n;
  }
  throw new Error('Type de données inconnu');
}
function viewSend(){
  const { count } = buildMine();
  return `<div class="card strong center"><b style="font-size:20px">${count} fiche(s) d'élève saisie(s) sur cette tablette (leçon ${curLesson()})</b></div>
    <div id="qr-area" class="center">Préparation…</div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn" data-action="fileMine">📤 Partager en fichier (AirDrop…) à la place</button></div>`;
}
async function afterSend(){
  const payload = await encodePacket(buildMine().pkt);
  const area = $('#qr-area'); if (!area) return;
  showQRSeries(chunkQR(payload, 'R', 300), area, '');
}
function viewReceive(){
  return `<div class="card strong center"><b style="font-size:20px">📷 Scanne le QR de la leçon affiché par l'enseignant</b></div>
    <div id="scan-area"></div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><label class="btn">📂 Importer un fichier (.json)<input type="file" id="file-sync" accept=".json,application/json" hidden></label></div>`;
}
function afterReceive(){ startScan($('#scan-area'), ['S'], async p => applyPacket(p)); }
function afterProf(){
  if (UI.profTab === 'qr') (async () => { const area = $('#qr-seance'); const payload = await encodePacket(buildSeance(curLesson()));
    if (area && UI.profTab === 'qr' && UI.view === 'prof') showQRSeries(chunkQR(payload, 'S', QR_CHUNK), area, `Leçon ${curLesson()} · ${esc(className())}`); })();
  if (UI.profTab === 'recup') startScan($('#scan-area'), ['R'], async p => { await applyPacket(p); const w = $('#wait-box'); if (w) w.innerHTML = waitList(); return 'continue'; });
  if (UI.profTab === 'cibles') $$('.tg-in').forEach(inp => inp.onchange = () => {
    const v = parseFloat(String(inp.value).replace(',', '.')), sid = inp.dataset.sid;
    S.targets[sid] = S.targets[sid] || {}; if (isFinite(v)) S.targets[sid][inp.dataset.f] = v; else delete S.targets[sid][inp.dataset.f]; save(); });
  const imp = $('#imp-students'); if (imp) imp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importStudentsFile(f); };
}
async function importSyncFile(file){
  try {
    const obj = JSON.parse(await file.text());
    if (obj.k) await applyPacket(obj);
    else if (obj.classes) {
      if (obj.app && obj.app !== CFG.id) throw new Error('Sauvegarde d\'une autre appli');
      if (!(await confirmBox('Restaurer la sauvegarde ?', 'Toutes les classes de cet appareil seront remplacées.', 'Restaurer', true))) return;
      const dev = ROOT.deviceId; ROOT = obj; ROOT.deviceId = dev; delete ROOT.app; Object.values(ROOT.classes).forEach(normClass);
      useClass(ROOT.classes[ROOT.active] ? ROOT.active : Object.keys(ROOT.classes)[0]); save(); toast('✓ Sauvegarde restaurée'); go('home');
    } else throw new Error('Fichier non reconnu');
    render();
  } catch(e){ toast('⚠️ ' + e.message, 3500); }
}

/* ---------------------------------------------------------------------
   Import des élèves (Pronote, Excel, CSV, liste collée)
   --------------------------------------------------------------------- */
async function readSheetRows(file){
  if (!window.XLSX) throw new Error('Bibliothèque Excel non chargée');
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    wb = XLSX.read(text.replace(/^﻿/, ''), { type:'string', raw:true });
  } else wb = XLSX.read(buf, { type:'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, raw:false, defval:'' });
}
const HEADER_RX = /^(nom|noms|élève|élèves|eleve|eleves|nom\s*(et)?\s*pr[ée]nom|pr[ée]nom|identit[ée]|classe)\b/i;
const isNameLike = s => !!s && /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- .]+$/.test(s) && !/\d/.test(s);
function parseStudents(rows){
  const out = [];
  rows.forEach((row, i) => {
    const a = String(row[0]||'').trim().replace(/\s+/g,' '), b = String(row[1]||'').trim().replace(/\s+/g,' ');
    if (!a) return;
    if (HEADER_RX.test(a) && (i < 3 || !b || HEADER_RX.test(b))) return;
    if (!isNameLike(a)) return;
    let nom, prenom;
    if (b && isNameLike(b) && !HEADER_RX.test(b)) { nom = a; prenom = b; }
    else {
      const tk = a.split(' '), isUp = t => t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
      let k = 0; while (k < tk.length && isUp(tk[k])) k++;
      if (k === 0) { nom = tk[0]; prenom = tk.slice(1).join(' '); }
      else if (k === tk.length) { nom = tk.slice(0, Math.max(1,k-1)).join(' '); prenom = tk.slice(Math.max(1,k-1)).join(' '); }
      else { nom = tk.slice(0,k).join(' '); prenom = tk.slice(k).join(' '); }
      if (!prenom) prenom = nom;
    }
    const sxc = row.slice(1).map(x => String(x || '').trim()).find(x => /^(f|fille|féminin|feminin|g|m|garçon|garcon|masculin)$/i.test(x));
    out.push({ nom: nom.toUpperCase(), prenom: capName(prenom), sx: sxc ? (/^f/i.test(sxc) ? 'F' : 'G') : undefined });
  });
  return out;
}
async function addStudents(list){
  if (!list.length) return toast('Aucun élève reconnu');
  let mode = 'add';
  if (S.students.length) {
    mode = await choiceBox('Importer ' + list.length + ' élève(s)', `La liste contient déjà ${S.students.length} élève(s).`,
      [{label:'Ajouter à la liste', value:'add', cls:'primary'}, {label:'Remplacer la liste', value:'replace', cls:'red'}]);
    if (!mode) return;
  }
  if (mode === 'replace') { S.students = []; S.results = {}; S.targets = {}; S.hist = {}; Object.values(S.lessons).forEach(L => { L.att = {}; L.role = {}; }); }
  let added = 0;
  list.forEach(p => { if (S.students.some(s => s.nom === p.nom && (s.prenom||'').toLowerCase() === p.prenom.toLowerCase())) return;
    S.students.push({ id: newStudentId(), nom: p.nom, prenom: p.prenom, grp: 0, ...(p.sx ? { sx:p.sx } : {}) }); added++; });
  save(); render(); toast(`✓ ${added} élève(s) ajouté(s)`);
}
async function importStudentsFile(file){
  try { await addStudents(parseStudents(await readSheetRows(file))); }
  catch(e){ console.error(e); toast('⚠️ Lecture impossible : ' + e.message, 3500); }
}

/* ---------------------------------------------------------------------
   Export Excel et sauvegarde
   --------------------------------------------------------------------- */
function exportExcel(){
  if (!window.XLSX) return toast('Bibliothèque Excel non chargée');
  const wb = XLSX.utils.book_new(), list = sortedStudents(), nL = S.settings.nbLessons;
  const cell = v => v == null ? '' : r10(v, 3);
  // Synthèse : une colonne par leçon et par saisie
  const head = ['Nom', 'Prénom', 'Groupe']; FIELDS.forEach(f => { for (let l = 1; l <= nL; l++) head.push(`${f.label}${SEANCE ? '' : ' L' + l}`); if (f.target) head.push(`${f.label} cible`); });
  const rows = [head, ...list.map(s => { const r = [s.nom || s.disp || '', s.prenom || '', groupColor(s.grp || 0).n];
    FIELDS.forEach(f => { for (let l = 1; l <= nL; l++) { const a = attOf(l, s.id); r.push(isOff(a) ? ATT[a].n : cell(lessonVal(l, s.id, f))); } if (f.target) r.push(cell(targetOf(s.id, f))); }); return r; })];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Synthèse');
  // Détail par leçon (toutes les tentatives)
  for (let l = 1; l <= nL; l++) {
    if (!S.results[l] && !Object.keys(lesson(l).att).length && !S.notes[l]) continue;
    const k = tries(l), h = ['Nom', 'Prénom', 'Groupe', 'Présence']; if (CFG.roles.length) h.push('Rôle');
    FIELDS.forEach(f => { if (f.per === 'try') for (let j = 1; j <= k; j++) h.push(`${f.label} essai ${j}`); h.push(f.per === 'try' ? `${f.label} (${AGG_N[f.agg]})` : f.label); }); h.push('Remarque');
    const data = [h, ...list.map(s => { const a = attOf(l, s.id), C = res(l, s.id) ? calcAll(l, s.id) : null, ro = roleOf(l, s.id);
      const r = [s.nom || s.disp || '', s.prenom || '', groupColor(s.grp || 0).n, a ? ATT[a].n : 'Présent']; if (CFG.roles.length) r.push(ro ? ro.n : '');
      FIELDS.forEach(f => { if (f.per === 'try') for (let j = 0; j < k; j++) r.push(C ? cell(C.t[j][f.id]) : ''); r.push(C ? cell(C.L[f.id]) : ''); }); r.push(noteOf(l, s.id)); return r; })];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), SEANCE ? 'Séance' : 'Leçon ' + l);
  }
  if (CFG.grade.on && CFG.grade.items.length) {
    const h = ['Nom', 'Prénom', ...CFG.grade.items.flatMap(it => { const f = fieldById(it.field), n = it.label || (f ? f.label : '?'); return [`${n} (valeur)`, `${n} /${it.pts}`]; }), `Note /${CFG.grade.total}`];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h, ...list.map(s => { const G = gradeOf(s.id);
      return [s.nom || s.disp || '', s.prenom || '', ...G.items.flatMap(x => [cell(x.v), cell(x.p)]), cell(G.onTotal)]; })]), 'Notes');
  }
  if (FRS.length) {
    const h = ['Nom', 'Prénom']; FRS.forEach(fr => { for (let l = 1; l <= (SEANCE ? 1 : nL); l++) h.push(`${fr.nom}${SEANCE ? '' : ' L' + l}`); h.push(`${fr.nom} moyenne /4`, `${fr.nom} proposé`, `${fr.nom} final`); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h, ...list.map(s => { const r = [s.nom || s.disp || '', s.prenom || ''];
      FRS.forEach(fr => { for (let l = 1; l <= (SEANCE ? 1 : nL); l++) { const f = frLesson(fr, l, s.id); r.push(f && f.at ? ATT[f.at].n : f && f.lv ? COMP_LV[f.lv].n : ''); }
        const m = frMoy(fr, s.id), sg = frSuggest(fr, s.id), fi = frFinal(fr, s.id); r.push(m == null ? '' : r10(m, 2), sg ? COMP_LV[sg].n : '', fi ? COMP_LV[fi].n : ''); }); return r; })]), 'Fils rouges');
  }
  XLSX.writeFile(wb, `${CFG.short} - ${className()}.xlsx`.replace(/[\\/:*?"<>|]/g, '-'));
}
async function downloadBackup(){ await downloadJSON({ ...ROOT, app:CFG.id }, `${CFG.short}-sauvegarde-${new Date().toISOString().slice(0,10)}.json`); }

/* =====================================================================
   Actions (boutons data-action)
   ===================================================================== */
const ACT = {
  go: d => go(d.view),
  setRole: d => { ROOT.role = d.r; save(); if (d.r === 'prof') { UI.profUnlocked = true; go('prof', { profTab:'menu' }); } else go('home'); },
  unlock: () => pinPad(() => { ROOT.role = 'prof'; UI.profUnlocked = true; save(); go('prof', { profTab:'menu' }); }),
  lock: () => { UI.profUnlocked = false; go('home'); },
  toEleve: async () => { if (await confirmBox('Passer en tablette élève ?', 'Les données de cette tablette sont conservées. Le code enseignant permet de revenir.', 'Passer en élève')) { ROOT.role = 'eleve'; UI.profUnlocked = false; save(); go('home'); } },
  tab: d => { if (d.tab === 'saisie') return go('saisie'); if (d.tab === 'outils') return go('tools'); go('prof', { profTab:d.tab }); },
  grp: d => { ROOT.grp = d.g === '' ? null : +d.g; save(); rerender(); },
  appelGrp: d => { UI.appelG = d.g === '' ? null : +d.g; rerender(); },
  entry: d => go('entry', { sid:d.sid }),
  useClass: d => { useClass(d.c); save(); rerender(); },
  addClass: async () => { const n = await textBox('Nom de la nouvelle classe', ''); if (!n) return; const c = newClassState(n); ROOT.classes[c.id] = c; useClass(c.id); save(); rerender(); },
  renameClass: async () => { const n = await textBox('Nom de la classe', className()); if (!n) return; S.settings.className = n; save(); rerender(); },
  delClass: async () => { if (Object.keys(ROOT.classes).length < 2) return toast('Il faut garder au moins une classe');
    if (!(await confirmBox('Supprimer ' + esc(className()) + ' ?', 'Élèves et saisies de cette classe seront effacés.', 'Supprimer', true))) return;
    delete ROOT.classes[S.id]; useClass(Object.keys(ROOT.classes)[0]); save(); rerender(); },
  pasteStudents: () => { const m = modal(`<h2>Coller une liste d'élèves</h2><p class="muted">Une ligne par élève : NOM Prénom (ou NOM ⇥ Prénom copié depuis un tableur).</p>
      <textarea id="paste-in" rows="10" style="width:100%"></textarea><div class="btn-row spread" style="margin-top:10px"><button class="btn ghost" data-c="x">Annuler</button><button class="btn primary" data-c="ok">Ajouter</button></div>`);
    m.querySelector('[data-c="x"]').onclick = closeModal;
    m.querySelector('[data-c="ok"]').onclick = () => { const rows = m.querySelector('#paste-in').value.split(/\r?\n/).map(l => l.split(/\t|;/)); closeModal(); addStudents(parseStudents(rows)); }; },
  addStudent: async () => { const n = await textBox('NOM Prénom', ''); if (n) addStudents(parseStudents([[n]])); },
  editStudent: async d => { const s = student(d.sid); const n = await textBox('NOM Prénom', `${s.nom} ${s.prenom}`); if (!n) return; const p = parseStudents([[n]])[0]; if (p) { s.nom = p.nom; s.prenom = p.prenom; save(); rerender(); } },
  delStudent: async d => { if (await confirmBox('Retirer ' + esc(nameOf(d.sid)) + ' ?', 'Ses saisies seront effacées.', 'Retirer', true)) { S.students = S.students.filter(s => s.id !== d.sid); Object.values(S.results).forEach(r => delete r[d.sid]); delete S.targets[d.sid]; save(); rerender(); } },
  nbGroups: d => { S.settings.nbGroups = Math.max(1, Math.min(CFG.maxGroups, nbGroups() + +d.d)); S.students.forEach(s => { if ((s.grp || 0) >= S.settings.nbGroups) s.grp = 0; }); save(); rerender(); },
  cycleGrp: d => { const s = student(d.sid); s.grp = ((s.grp || 0) + 1) % nbGroups(); save(); rerender(); },
  autoGroups: async () => { if (!(await confirmBox('Répartir automatiquement ?', `Les élèves seront répartis dans ${nbGroups()} groupes (ordre alphabétique).`, 'Répartir'))) return;
    const l = sortedStudents(), g = nbGroups(), per = Math.ceil(l.length / g); l.forEach((s, i) => s.grp = Math.floor(i / per)); save(); rerender(); },
  nbLessons: d => { S.settings.nbLessons = Math.max(1, Math.min(40, S.settings.nbLessons + +d.d)); if (curLesson() > S.settings.nbLessons) S.settings.current = S.settings.nbLessons; save(); rerender(); },
  setLesson: d => { S.settings.current = +d.n; save(); rerender(); },
  lessonTitle: async () => { const t = await textBox('Titre de la leçon ' + curLesson(), lesson(curLesson()).title); if (t == null) return; lesson(curLesson()).title = t; save(); rerender(); },
  tries: d => { const L = lesson(curLesson()); L.tries = Math.max(1, Math.min(20, L.tries + +d.d)); save(); rerender(); },
  toggleEv: () => { const L = lesson(curLesson()); L.ev = !L.ev; save(); rerender(); },
  pickAtt: d => { const L = lesson(curLesson()), cur = L.att[d.sid] || 0;
    const m = modal(`<h2>${esc(nameOf(d.sid))}</h2><div class="att-pick">${[0,1,2,3,4].map(k => `<button class="btn ${k === cur ? 'primary' : ''} att-b ${k ? ATT[k].cls : 'ok'}" data-k="${k}">${k ? ATT[k].ico + ' ' + ATT[k].n : '✓ Présent'}</button>`).join('')}</div>
      <div class="btn-row spread" style="margin-top:12px"><span></span><button class="btn ghost" data-x>Annuler</button></div>`);
    m.querySelector('[data-x]').onclick = closeModal;
    m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = +b.dataset.k; if (k) L.att[d.sid] = k; else delete L.att[d.sid]; save(); closeModal(); rerender(); }); },
  quickNote: d => { const pn = $('#prof-note'); if (!pn) return; pn.value = (pn.value ? pn.value.replace(/\s+$/, '') + ' · ' : '') + d.t; pn.onchange(); },
  newSeance: async () => { if (!(await confirmBox('Nouvelle séance ?', 'Les saisies, l\'appel et les remarques de cette classe sont effacés. Élèves, groupes et cibles sont gardés.', 'Nouvelle séance', true))) return;
    S.results = {}; S.notes = {}; const L = lesson(1); L.att = {}; L.role = {}; L.shift = (L.shift || 0) + 1; save(); toast('✓ Prêt pour une nouvelle séance'); rerender(); },
  clF: d => { UI.clF = d.f; rerender(); },
  clM: d => { UI.clM = d.m; rerender(); },
  clG: d => { UI.clG = d.g === '' ? null : +d.g; rerender(); },
  tool: d => go('tool', { tool:d.t }),
  agSet: d => { UI.ag[d.k] = d.k === 'mix' ? d.v === '1' : d.v; rerender(); },
  agPropose: () => showGroupProposal(),
  gSel: (d, el) => { UI.gsel = UI.gsel === d.sid ? null : d.sid; rerender(); },
  gMove: d => { if (!UI.gsel) return; const s = student(UI.gsel); if (s) s.grp = +d.g; UI.gsel = null; save(); rerender(); },
  cycleSx: d => { const s = student(d.sid); s.sx = s.sx === 'F' ? 'G' : s.sx === 'G' ? undefined : 'F'; if (!s.sx) delete s.sx; save(); rerender(); },
  bilN: d => { UI.bilN = +d.n; rerender(); },
  proj: d => showProj(bcData(+d.n)),
  projBc: () => showProj(S.bc),
  frG: d => { UI.frG = d.g === '' ? null : +d.g; rerender(); },
  frDetail: d => go('prof', { profTab:'frDetail', sid:d.sid }),
  frSet: d => { const st = frStore(), m = st[d.fr] = st[d.fr] || {}, L = m[d.n] = m[d.n] || {}; L[d.sid] = L[d.sid] === +d.v ? undefined : +d.v; if (!L[d.sid]) delete L[d.sid]; save(); rerender(); },
  compSet: d => { S.comp = S.comp || {}; const c = S.comp[d.sid] = S.comp[d.sid] || {}; if (+d.v) c[d.fr] = +d.v; else delete c[d.fr]; save(); rerender(); },
  tirG: d => { TS.tirage.g = d.g === '' ? null : +d.g; rerender(); },
  trG: d => { TS.tours.g = d.g === '' ? null : +d.g; rerender(); },
  cycleAtt: d => { const L = lesson(curLesson()); const a = ((L.att[d.sid] || 0) + 1) % 3; if (a) L.att[d.sid] = a; else delete L.att[d.sid]; save(); rerender(); },
  autoTargets: async d => {
    const sel = $('#cib-l').value, ls = sel === 'all' ? Array.from({ length:S.settings.nbLessons }, (_, i) => i + 1) : [+sel]; UI.ciblesL = sel === 'all' ? 'all' : +sel;
    if (!(await confirmBox('Remplacer les cibles ?', `Cibles = ${d.m === 'best' ? 'meilleur résultat' : 'moyenne'} ${sel === 'all' ? 'de toutes les leçons' : 'de la leçon ' + sel}. Les élèves sans résultat gardent leur cible.`, 'Remplacer'))) return;
    let n = 0;
    S.students.forEach(s => TFIELDS.forEach(f => { const a = vals(ls.map(l => lessonVal(l, s.id, f))); if (!a.length) return;
      let v = d.m === 'mean' ? avg(a) : (f.better === 'low' ? Math.min(...a) : Math.max(...a));
      if (['dial','counter','scale'].includes(f.type)) v = Math.round((v - f.min) / f.step) * f.step + f.min;
      (S.targets[s.id] = S.targets[s.id] || {})[f.id] = r10(v, 3); n++; }));
    save(); rerender(); toast(`✓ ${n} cible(s) mise(s) à jour`); },
  shiftTargets: d => { S.students.forEach(s => TFIELDS.forEach(f => { const t = targetOf(s.id, f); if (t == null) return; let v = t + (+d.d) * (f.step || 1) * (f.better === 'low' ? -1 : 1);
      if (f.max > f.min) v = Math.max(f.min, Math.min(f.max, v)); S.targets[s.id][f.id] = r10(v, 3); })); save(); rerender(); },
  shiftRoles: () => { const L = lesson(curLesson()); L.shift = (L.shift || 0) + 1; save(); rerender(); },
  resetRoles: () => { const L = lesson(curLesson()); L.role = {}; L.shift = 0; delete L.roleS; save(); rerender(); },
  cycleRole: d => { const L = lesson(curLesson()), i = roleIdx(curLesson(), d.sid); L.role[d.sid] = i == null ? 0 : (i + 1) % CFG.roles.length; save(); rerender(); },
  resL: d => { UI.resL = d.n === 'evo' ? 'evo' : +d.n; rerender(); },
  evoF: d => { UI.evoF = d.f; rerender(); },
  stuDetail: d => stuDetail(d.sid),
  excel: () => exportExcel(),
  backup: () => downloadBackup(),
  fileMine: () => downloadJSON(buildMine().pkt, `${CFG.short}-saisies-${ROOT.deviceId}.json`),
  fileSeance: () => downloadJSON(buildSeance(curLesson()), `${CFG.short}-lecon-${curLesson()}.json`),
  setPin: async () => { const v = await textBox('Nouveau code (4 chiffres)', ''); if (v == null) return; if (!/^\d{4}$/.test(v)) return toast('4 chiffres, s\'il vous plaît'); ROOT.pin = v; save(); toast('✓ Code modifié'); },
  clearLesson: async () => { if (await confirmBox('Effacer les saisies de la leçon ' + curLesson() + ' ?', 'Action définitive pour cette classe.', 'Effacer', true)) { delete S.results[curLesson()]; save(); rerender(); } },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.action]; if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('change', e => { if (e.target.id === 'file-sync' && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; importSyncFile(f); } });

/* =====================================================================
   Démarrage
   ===================================================================== */
window.addEventListener('DOMContentLoaded', function init(){   // après le chargement de outils.js
  const r = document.documentElement.style; r.setProperty('--navy', CFG.color); r.setProperty('--orange', CFG.accent);
  document.title = CFG.name; const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = CFG.color;
  $('#signature').innerHTML = CFG.author ? `<b>${esc(CFG.author)}</b> · N'EPS` : 'N\'EPS';
  $('#app-version').textContent = 'v' + APP_VERSION + (PREVIEW ? ' · aperçu' : '');
  if (ICON !== 'icons/icon-512.png') { const i = document.querySelector('.tb-home img'); if (i) i.src = ICON; }
  if (PREVIEW) UI.profUnlocked = true;   // aperçu dans la Fabrique : pas de code à chaque rechargement
  loadRoot(); render();
  if ('serviceWorker' in navigator && !PREVIEW && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
});
