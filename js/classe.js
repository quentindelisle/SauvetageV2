/* =========================================================
   Classe — mode enseignant / mode élève
   Classes, élèves (appel Pronote), programmation du cycle,
   leçons du jour, piliers d'enseignement, résultats, bilans,
   paquets échangés par QR (séance S, résultats R).
   Stockage : localStorage « sca2.v6 » (propre à chaque appareil)
   ========================================================= */
const Classe = (function(){
'use strict';

const KEY = 'sca2.v6';
const PIN_DEFAULT = '0000';
const MAX_LESSONS = 20;

function read(k, fb){ try{ const r=localStorage.getItem(k); return r ? JSON.parse(r) : fb; }catch(e){ return fb; } }
function write(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
function rid(n=4){ const a='abcdefghijkmnpqrstuvwxyz23456789'; let s=''; for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
const clone = (o)=>JSON.parse(JSON.stringify(o));

/* ---------- Piliers d'enseignement (banque par défaut, modifiable) ----------
   Un pilier = un nom, des contenus (ce que l'élève doit savoir/faire),
   et 3 critères, chacun avec son observable (ce que l'observateur voit : oui / non). */
const DEFAULT_PILIERS = [
  { id:'entree', n:"Entrer dans l'eau", c:"Je pars dès le signal.\nJ'entre dans l'eau corps gainé (tête ou pieds en premier selon le départ).\nJ'enchaîne directement avec une coulée, sans m'arrêter.",
    cr:[ {t:'Réaction au signal', o:"Part dès le signal, sans hésiter"},
         {t:'Corps gainé', o:"Corps droit et serré à l'entrée dans l'eau"},
         {t:'Enchaînement', o:"Enchaîne coulée puis nage sans s'arrêter"} ] },
  { id:'coulee', n:'Coulée et alignement', c:"Après le départ et chaque virage, je m'allonge : bras tendus devant, tête entre les bras.\nJe glisse sous l'eau avant de reprendre la nage.\nJe reprends la nage quand je ralentis.",
    cr:[ {t:'Alignement', o:"Bras tendus devant, tête entre les bras"},
         {t:'Glisse', o:"Glisse au moins 3 m sous l'eau avant de nager"},
         {t:'Reprise de nage', o:"Reprend la nage sans s'arrêter (pas de redressement)"} ] },
  { id:'virage', n:'Virage efficace', c:"J'arrive au mur sans ralentir.\nJe pose les pieds au mur, jambes fléchies, et je pousse fort.\nJe repars en coulée, sous l'eau.",
    cr:[ {t:'Continuité', o:"Ne s'arrête pas au mur (aucune pause)"},
         {t:'Appui au mur', o:"Pieds posés au mur, jambes fléchies, poussée franche"},
         {t:'Départ en coulée', o:"Repart sous l'eau, bras tendus devant"} ] },
  { id:'immersion', n:"S'immerger et franchir les obstacles", c:"Je plonge en canard : tête la première, jambes à la verticale.\nJe passe dans le cerceau sans le toucher.\nJe remonte en regardant où je vais.",
    cr:[ {t:'Plongeon canard', o:"Tête la première, jambes à la verticale hors de l'eau"},
         {t:'Franchissement', o:"Passe l'obstacle sans le toucher ni s'arrêter"},
         {t:'Remontée orientée', o:"Remonte en regardant devant, dans la bonne direction"} ] },
  { id:'respiration', n:'Respirer et gérer son apnée', c:"Je souffle sous l'eau (bulles) pour pouvoir inspirer vite.\nJe respire régulièrement pendant la nage.\nJe tiens l'apnée jusqu'au bout de la distance demandée.",
    cr:[ {t:'Expiration aquatique', o:"Souffle sous l'eau : bulles visibles"},
         {t:'Respiration régulière', o:"Inspire régulièrement, sans relever la tête"},
         {t:'Apnée tenue', o:"Ne remonte pas avant la fin de l'apnée"} ] },
  { id:'remorquage', n:'Ramasser et remorquer', c:"Je descends saisir l'objet ou le mannequin du premier coup.\nJe garde la tête du mannequin hors de l'eau.\nJe remorque sur le dos avec des battements réguliers.",
    cr:[ {t:'Saisie', o:"Saisit l'objet ou le mannequin du premier coup"},
         {t:'Tête hors de l’eau', o:"Visage du mannequin toujours hors de l'eau"},
         {t:'Propulsion', o:"Battements de jambes réguliers, sans s'arrêter"} ] },
  { id:'crawl', n:'Nager efficacement', c:"Mes bras entrent loin devant et poussent l'eau jusqu'à la cuisse.\nMes jambes battent en continu, tendues.\nMa tête reste dans l'axe, regard vers le fond.",
    cr:[ {t:'Bras', o:"Main qui entre loin devant, poussée jusqu'à la cuisse"},
         {t:'Jambes', o:"Battements continus, jambes presque tendues"},
         {t:'Tête', o:"Tête dans l'axe, regard vers le fond"} ] },
];

/* ---------- État ---------- */
let R = load();
function load(){
  const r = read(KEY, null) || {};
  r.deviceId = r.deviceId || rid(4);
  r.pin = r.pin || PIN_DEFAULT;
  r.role = r.role || null;            // 'prof' | 'eleve' | null
  r.piliers = Array.isArray(r.piliers) ? r.piliers : clone(DEFAULT_PILIERS);
  r.classes = r.classes || {};
  r.active = r.active && r.classes[r.active] ? r.active : (Object.keys(r.classes)[0] || null);
  r.seance = r.seance || null;        // tablette élève : leçon reçue
  r.mine = Array.isArray(r.mine) ? r.mine : [];   // tablette élève : passages enregistrés
  r.sent = r.sent || {};
  return r;
}
function save(){ write(KEY, R); }

/* ---------- Rôle de l'appareil ---------- */
const role = ()=>R.role;
function setRole(r){ R.role = r; save(); }
const checkPin = (p)=>String(p||'')===String(R.pin);
function setPin(p){ if(!/^\d{4}$/.test(p)) return false; R.pin=p; save(); return true; }
const deviceId = ()=>R.deviceId;

/* ---------- Piliers ---------- */
const piliers = ()=>R.piliers;
const pilier = (id)=>R.piliers.find(p=>p.id===id) || null;
function savePilier(p){
  const cr = [0,1,2].map(i=>({ t:String(p.cr?.[i]?.t||'').trim(), o:String(p.cr?.[i]?.o||'').trim() }));
  const q = { id:p.id || rid(5), n:String(p.n||'').trim() || 'Pilier sans nom', c:String(p.c||'').trim(), cr };
  const i = R.piliers.findIndex(x=>x.id===q.id);
  if(i>=0) R.piliers[i]=q; else R.piliers.push(q);
  save(); return q;
}
function deletePilier(id){ R.piliers = R.piliers.filter(p=>p.id!==id); save(); }
function resetPiliers(){ R.piliers = clone(DEFAULT_PILIERS); save(); }
const pilSnap = (p)=>p ? { id:p.id, n:p.n, c:p.c, cr:p.cr.map(x=>({t:x.t,o:x.o})) } : null;

/* ---------- Classes ---------- */
function newClass(name){
  const c = { id:rid(4), name:String(name||'').trim()||'Classe', students:[], nb:8, cur:1, lessons:{}, results:{} };
  R.classes[c.id]=c; R.active=c.id; save(); return c;
}
const classes = ()=>Object.values(R.classes).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
const active = ()=>R.active ? R.classes[R.active] : null;
function setActive(id){ if(R.classes[id]){ R.active=id; save(); } }
function renameClass(id, name){ const c=R.classes[id]; if(c){ c.name=String(name||'').trim()||c.name; save(); } }
function deleteClass(id){ delete R.classes[id]; if(R.active===id) R.active=Object.keys(R.classes)[0]||null; save(); }
function lesson(c, n){
  c.lessons[n] = c.lessons[n] || { pil:[], obj:'', par:[], att:{}, date:'' };
  const L = c.lessons[n]; L.pil=L.pil||[]; L.par=L.par||[]; L.att=L.att||{};
  return L;
}
function setNb(c, nb){ c.nb = Math.max(1, Math.min(MAX_LESSONS, nb|0)); if(c.cur>c.nb) c.cur=c.nb; save(); }
function setCur(c, n){ c.cur = Math.max(1, Math.min(c.nb, n|0)); save(); }

/* ---------- Élèves : affichage « Prénom N. » ---------- */
function capName(s){ return String(s||'').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m,a,b)=>a+b.toUpperCase()); }
function dispNames(list){
  const out = {};
  const base = (s, k)=>{ const nom=(s.nom||'').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g,''); return `${s.prenom} ${nom.slice(0,k).toUpperCase()}${nom.length>k?'.':''}`.trim(); };
  list.forEach(s=>{ out[s.id]=base(s,1); });
  for(let k=2;k<=6;k++){
    const seen={}; list.forEach(s=>{ (seen[out[s.id]]=seen[out[s.id]]||[]).push(s); });
    let dup=false;
    Object.values(seen).forEach(g=>{ if(g.length>1){ dup=true; g.forEach(s=>{ out[s.id]=base(s,k); }); } });
    if(!dup) break;
  }
  return out;
}
function students(c){
  const D = dispNames(c.students);
  return c.students.map(s=>({ id:s.id, nom:s.nom, prenom:s.prenom, disp:D[s.id] }))
    .sort((a,b)=>a.disp.localeCompare(b.disp,'fr'));
}

/* Import Pronote : « NOM Prénom » en colonne A, ou NOM en A et Prénom en B (xlsx, csv, ou copier-coller) */
const HEADER_RX = /^(nom|noms|élève|élèves|eleve|eleves|nom\s*(et)?\s*pr[ée]nom|pr[ée]nom|identit[ée]|classe)\b/i;
const isNameLike = s => !!s && /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- .]+$/.test(s) && !/\d/.test(s);
function parseRows(rows){
  const out=[];
  rows.forEach((row,i)=>{
    const a=String(row[0]||'').trim().replace(/\s+/g,' '), b=String(row[1]||'').trim().replace(/\s+/g,' ');
    if(!a) return;
    if(HEADER_RX.test(a) && (i<3 || !b || HEADER_RX.test(b))) return;
    if(!isNameLike(a)) return;
    let nom, prenom;
    if(b && isNameLike(b) && !HEADER_RX.test(b)){ nom=a; prenom=b; }
    else{
      const tk=a.split(' ');
      const isUp=t=>t===t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
      let k=0; while(k<tk.length && isUp(tk[k])) k++;
      if(k===0){ nom=tk[0]; prenom=tk.slice(1).join(' '); }
      else if(k===tk.length){ nom=tk.slice(0,Math.max(1,k-1)).join(' '); prenom=tk.slice(Math.max(1,k-1)).join(' '); }
      else { nom=tk.slice(0,k).join(' '); prenom=tk.slice(k).join(' '); }
      if(!prenom) prenom=nom;
    }
    out.push({ nom:nom.toUpperCase(), prenom:capName(prenom) });
  });
  return out;
}
function parseText(text){
  const rows = String(text||'').split(/\r?\n/).map(l=>{
    if(l.includes('\t')) return l.split('\t');
    if(l.includes(';')) return l.split(';');
    return [l];
  });
  return parseRows(rows);
}
async function parseFile(file){
  if(/\.(csv|txt)$/i.test(file.name)){
    const buf=await file.arrayBuffer();
    let text=new TextDecoder('utf-8').decode(buf);
    if(text.includes('�')) text=new TextDecoder('windows-1252').decode(buf);
    return parseText(text.replace(/^﻿/,''));
  }
  if(!window.XLSX) throw new Error('Bibliothèque Excel non chargée');
  const wb=XLSX.read(await file.arrayBuffer(), {type:'array'});
  const ws=wb.Sheets[wb.SheetNames[0]];
  return parseRows(XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''}));
}
function newStudentId(c){ let id; do{ id=rid(3); }while(c.students.some(s=>s.id===id)); return id; }
function addStudents(c, list, replace=false){
  if(replace){ c.students=[]; }
  let added=0;
  list.forEach(p=>{
    if(c.students.some(s=>s.nom===p.nom && (s.prenom||'').toLowerCase()===p.prenom.toLowerCase())) return;
    c.students.push({ id:newStudentId(c), nom:p.nom, prenom:p.prenom }); added++;
  });
  save(); return added;
}
function removeStudent(c, sid){ c.students=c.students.filter(s=>s.id!==sid); save(); }

/* ---------- Appel ---------- */
const attOf = (c, n, sid)=>lesson(c,n).att[sid] || null;     // 'abs' | 'inap' | null
function setAtt(c, n, sid, v){ const L=lesson(c,n); if(!v || L.att[sid]===v) delete L.att[sid]; else L.att[sid]=v; save(); }

/* ---------- Parcours d'une leçon (copies figées des parcours de la bibliothèque) ---------- */
function addParcours(c, n, p){
  const L=lesson(c,n);
  const snap = Store.clone(p); snap.builtin=false;
  if(L.par.some(x=>x.id===snap.id)) L.par = L.par.map(x=>x.id===snap.id?snap:x); else L.par.push(snap);
  save();
}
function removeParcours(c, n, pid){ const L=lesson(c,n); L.par=L.par.filter(x=>x.id!==pid); save(); }

/* ---------- Contexte d'un passage (chrono) ----------
   Tablette élève : la leçon reçue par QR. Appareil enseignant : la leçon du jour de la classe active. */
function context(){
  if(R.role==='eleve'){
    const s=R.seance; if(!s) return null;
    return { mode:'eleve', cid:s.cid, cn:s.cn, n:s.n, students:s.st, piliers:s.pils, parcours:s.pars, obj:s.obj };
  }
  if(R.role==='prof'){
    const c=active(); if(!c || !c.students.length) return null;
    const L=lesson(c, c.cur);
    const att=(sid)=>L.att[sid]||null;
    return { mode:'prof', cid:c.id, cn:c.name, n:c.cur, students:students(c).map(s=>({id:s.id, disp:s.disp, att:att(s.id)})),
      piliers:L.pil.map(pilier).filter(Boolean).map(pilSnap), parcours:L.par, obj:L.obj };
  }
  return null;
}

/* ---------- Résultats ---------- */
function addResult(r){
  if(R.role==='eleve'){ R.mine.push(r); }
  else { const c=R.classes[r.cid]; if(c){ c.results[r.id]=r; } }
  save();
}
function deleteResult(cid, id){
  if(R.role==='eleve'){ R.mine=R.mine.filter(r=>r.id!==id); }
  else { const c=R.classes[cid]; if(c) delete c.results[id]; }
  save();
}
const mine = ()=>R.mine;
function mineFor(cid, n){ return R.mine.filter(r=>r.cid===cid && (n==null || r.n===n)); }
function resultsOf(c, n){ return Object.values(c.results).filter(r=>n==null || r.n===n).sort((a,b)=>a.ts-b.ts); }

/* ---------- Paquets QR ---------- */
const ds = (ms)=>ms==null ? null : Math.round(ms/100);          // dixièmes de seconde
const ms = (d)=>d==null ? null : d*100;
function packParcours(p){
  return [p.id, p.name, p.n, Store.validEntree(p.entree),
    p.obstacles.map(arr=>arr.map(o=>[o.type, o.dist, o.type==='apnee'?o.depl:(o.type==='mannequin'?o.remorque:0)]))];
}
function unpackParcours(a){
  let k=1;
  return Store.normalize({ id:a[0], name:a[1], entree:a[3], data:{ nbLongueurs:a[2], entree:a[3],
    obstacles:a[4].map(arr=>arr.map(o=>{ const r={id:k++, type:o[0], dist:o[1]}; if(o[0]==='apnee') r.depl=o[2]; if(o[0]==='mannequin') r.remorque=o[2]; return r; })) } });
}
/** QR « Séance » : tout ce dont une tablette élève a besoin pour la leçon */
function buildSeance(c, n){
  const L=lesson(c,n);
  const st=students(c).map(s=>[s.id, s.disp, L.att[s.id]==='abs'?1:(L.att[s.id]==='inap'?2:0)]);
  const pils=L.pil.map(pilier).filter(Boolean).map(p=>[p.id, p.n, p.c, p.cr.map(x=>[x.t,x.o])]);
  return { k:'S', v:1, cid:c.id, cn:c.name, n, nb:c.nb, pin:R.pin, obj:L.obj||'', pils, pars:L.par.map(packParcours), st, at:Math.floor(Date.now()/1000) };
}
function applySeance(p){
  if(R.role!=='eleve') throw new Error('Ce QR est destiné aux tablettes élèves');
  if(p.pin && /^\d{4}$/.test(p.pin)) R.pin = p.pin;
  R.seance = {
    cid:p.cid, cn:p.cn, n:p.n, nb:p.nb, obj:p.obj||'', at:p.at,
    pils:(p.pils||[]).map(a=>({ id:a[0], n:a[1], c:a[2], cr:a[3].map(x=>({t:x[0], o:x[1]})) })),
    pars:(p.pars||[]).map(unpackParcours),
    st:(p.st||[]).map(a=>({ id:a[0], disp:a[1], att:a[2]===1?'abs':(a[2]===2?'inap':null) })),
  };
  save();
  return R.seance;
}
const seance = ()=>R.seance;
function obStr(ob, nL){ let s=''; for(let i=0;i<nL;i++) for(let k=0;k<3;k++){ const v=ob?.[i]?.[k]; s += v===1?'1':(v===0?'0':'-'); } return s; }
function obParse(s, nL){ const out=[]; for(let i=0;i<nL;i++){ out.push([0,1,2].map(k=>{ const ch=s[i*3+k]; return ch==='1'?1:(ch==='0'?0:null); })); } return out; }
/** QR « Résultats » : passages d'une tablette élève pour une leçon */
function buildResults(list){
  const s=R.seance;
  return { k:'R', v:1, cid: s ? s.cid : (list[0]?.cid||''), d:R.deviceId,
    rs:list.map(r=>[r.id, Math.floor(r.ts/1000), r.n, r.sid, r.pid, r.pname, r.entree, ds(r.total), r.faults||0,
      r.lens.map(ds), (r.obs||[]).map(ds), r.pil||'', obStr(r.ob, r.nL), r.nL]) };
}
function unpackResult(a, cid, d){
  return { id:a[0], ts:a[1]*1000, n:a[2], sid:a[3], pid:a[4], pname:a[5], entree:a[6], total:ms(a[7]), faults:a[8],
    lens:a[9].map(ms), obs:a[10].map(ms), pil:a[11]||null, ob:obParse(a[12]||'', a[13]), nL:a[13], cid, d };
}
function applyResults(p){
  if(R.role!=='prof') throw new Error('Ce QR est destiné à l’appareil enseignant');
  const c=R.classes[p.cid];
  if(!c) throw new Error('Classe inconnue sur cet appareil (QR d’une autre classe ?)');
  let n=0;
  (p.rs||[]).forEach(a=>{ const r=unpackResult(a, p.cid, p.d); if(!c.results[r.id]){ n++; } c.results[r.id]=r; });
  save();
  return { c, n, total:(p.rs||[]).length };
}
async function applyPacket(p){
  if(!p || !p.k) throw new Error('Données non reconnues');
  if(p.k==='S') return { kind:'S', seance:applySeance(p) };
  if(p.k==='R') return Object.assign({ kind:'R' }, applyResults(p));
  throw new Error('Type de QR inconnu');
}
function markSent(cid, n){ R.sent[cid+':'+n]=Date.now(); save(); }
const sentAt = (cid, n)=>R.sent[cid+':'+n]||null;

/* ---------- Bilans ---------- */
function pilierOf(id, ctxPils){ return (ctxPils||[]).find(p=>p.id===id) || pilier(id); }
/** compte des oui / observations pour chaque critère, sur une liste de passages */
function obsCount(list, pid){
  const out=[0,1,2].map(()=>({yes:0, tot:0}));
  list.filter(r=>r.pil===pid).forEach(r=>(r.ob||[]).forEach(len=>len.forEach((v,k)=>{ if(v===1||v===0){ out[k].tot++; if(v===1) out[k].yes++; } })));
  return out;
}
function lessonBilan(c, n){
  const L=lesson(c,n), res=resultsOf(c,n);
  return students(c).map(s=>{
    const mineR=res.filter(r=>r.sid===s.id);
    const best={}; mineR.forEach(r=>{ if(r.total!=null && (best[r.pid]==null || r.total<best[r.pid].total)) best[r.pid]=r; });
    return { s, att:L.att[s.id]||null, n:mineR.length, best, obs:L.pil.map(pid=>({pid, c:obsCount(mineR, pid)})) };
  });
}
function studentCycle(c, sid){
  const out=[];
  for(let n=1;n<=c.nb;n++){
    const L=lesson(c,n), res=resultsOf(c,n).filter(r=>r.sid===sid);
    const pids=[...new Set([...L.pil, ...res.map(r=>r.pil).filter(Boolean)])];
    out.push({ n, L, att:L.att[sid]||null, res, obs:pids.map(pid=>({pid, c:obsCount(res, pid)})) });
  }
  return out;
}

/* ---------- Export Excel du cycle ---------- */
function exportXlsx(c, fmt, secs){
  if(!window.XLSX) throw new Error('Bibliothèque Excel non chargée');
  const S=students(c), wb=XLSX.utils.book_new();
  const head=['Élève','Nom','Prénom','Présences','Absences','Inaptitudes','Passages'];
  const pilIds=[...new Set(Object.values(c.lessons).flatMap(L=>L.pil||[]))];
  pilIds.forEach(id=>{ const p=pilier(id); if(p) p.cr.forEach(x=>head.push(`${p.n} · ${x.t} (% oui)`)); });
  const rows=[head];
  S.forEach(s=>{
    let pres=0, abs=0, inap=0;
    for(let n=1;n<=c.nb;n++){ const a=attOf(c,n,s.id); if(a==='abs') abs++; else if(a==='inap') inap++; else if(resultsOf(c,n).length || (lesson(c,n).par||[]).length) pres++; }
    const res=Object.values(c.results).filter(r=>r.sid===s.id);
    const row=[s.disp, s.nom, s.prenom, pres, abs, inap, res.length];
    pilIds.forEach(id=>{ const p=pilier(id); if(!p) return; obsCount(res,id).forEach(x=>row.push(x.tot?Math.round(x.yes/x.tot*100):'')); });
    rows.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Synthèse');
  let maxL=1; Object.values(c.results).forEach(r=>{ maxL=Math.max(maxL, r.nL||0); });
  const h2=['Leçon','Date','Élève','Parcours','Entrée','Temps (s)','Temps','Fautes'];
  for(let i=1;i<=maxL;i++) h2.push(`L${i} (s)`);
  h2.push('Pilier observé'); for(let i=1;i<=maxL;i++) h2.push(`Obs. L${i}`);
  const det=[h2];
  const D=dispNames(c.students);
  Object.values(c.results).sort((a,b)=>a.n-b.n || a.ts-b.ts).forEach(r=>{
    const p=r.pil?pilier(r.pil):null;
    const row=[r.n, new Date(r.ts).toLocaleString('fr-FR'), D[r.sid]||'?', r.pname, Store.ENTREES[Store.validEntree(r.entree)].label,
      secs(r.total), fmt(r.total), r.faults||0];
    for(let i=0;i<maxL;i++) row.push(r.lens[i]!=null?secs(r.lens[i]):'');
    row.push(p?p.n:(r.pil||''));
    for(let i=0;i<maxL;i++){ const o=r.ob?.[i]; row.push(o ? o.map(v=>v===1?'oui':(v===0?'non':'·')).join(' / ') : ''); }
    det.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), 'Passages');
  const prog=[['Leçon','Date','Piliers','Infos','Parcours','Absents','Inaptes']];
  for(let n=1;n<=c.nb;n++){ const L=lesson(c,n);
    prog.push([n, L.date||'', L.pil.map(id=>pilier(id)?.n||id).join(' · '), L.obj||'', L.par.map(p=>p.name).join(' · '),
      Object.values(L.att).filter(v=>v==='abs').length, Object.values(L.att).filter(v=>v==='inap').length]); }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prog), 'Programmation');
  XLSX.writeFile(wb, `Sauvetage_${c.name.replace(/[^\w\-]+/g,'_')}_bilan.xlsx`);
}

/* ---------- Sauvegarde complète (fichier) ---------- */
const backup = ()=>clone(R);
function restore(obj){
  if(!obj || !obj.classes) throw new Error('Fichier de sauvegarde non reconnu');
  obj.deviceId=R.deviceId; write(KEY, obj); R=load(); save();
}

return {
  MAX_LESSONS, DEFAULT_PILIERS,
  save, role, setRole, checkPin, setPin, deviceId,
  piliers, pilier, savePilier, deletePilier, resetPiliers, pilSnap, pilierOf,
  newClass, classes, active, setActive, renameClass, deleteClass, lesson, setNb, setCur,
  students, dispNames, parseText, parseFile, addStudents, removeStudent,
  attOf, setAtt, addParcours, removeParcours,
  context, addResult, deleteResult, mine, mineFor, resultsOf,
  buildSeance, buildResults, applyPacket, seance, markSent, sentAt,
  obsCount, lessonBilan, studentCycle, exportXlsx, backup, restore,
};
})();
