/* =========================================================
   Store — modèle de données, persistance locale, import/export
   ========================================================= */
const Store = (function(){
'use strict';

const POOL = 25;
const MAX_LEN = 12;
const MAX_OBS_PER_LEN = 4;

/* ---------- Types d'obstacles ---------- */
const TYPES = {
  cerceau:   { label:'Cerceau lesté', short:'Cerceau',   color:'#9aa4b2', extra:null },
  apnee:     { label:'Apnée',         short:'Apnée',     color:'#00e676', extra:{key:'depl',     label:"Distance d'apnée", def:10} },
  mannequin: { label:'Mannequin',     short:'Mannequin', color:'#ffeb3b', extra:{key:'remorque', label:'Remorquage',       def:10} },
  objet:     { label:'Objet lesté',   short:'Objet',     color:'#8d8d8d', extra:null },
  tapis:     { label:'Tapis',         short:'Tapis',     color:'#e0457b', extra:null },
};
const TYPE_ORDER = ['cerceau','apnee','mannequin','objet','tapis'];

/* ---------- Parcours intégrés (modèles) ---------- */
const BUILTIN_RAW = [
  /* ----- 100 m (4 longueurs) — difficulté croissante ----- */
  {id:'B100N1', ts:1791158400000, name:'100 m · 1 — Découverte', data:{nbLongueurs:4, obstacles:{1:[],
    2:[{id:1,type:'cerceau',dist:12}],
    3:[{id:2,type:'cerceau',dist:8},{id:3,type:'cerceau',dist:17}],
    4:[{id:4,type:'mannequin',dist:15,remorque:10}]}}},
  {id:'B100N2', ts:1791158400001, name:'100 m · 2 — Initiation', data:{nbLongueurs:4, obstacles:{
    1:[{id:1,type:'cerceau',dist:15}],
    2:[{id:2,type:'apnee',dist:0,depl:8},{id:3,type:'cerceau',dist:18}],
    3:[{id:4,type:'objet',dist:12}],
    4:[{id:5,type:'mannequin',dist:13,remorque:12}]}}},
  {id:'B100N3', ts:1791158400002, name:'100 m · 3 — Confirmé', data:{nbLongueurs:4, obstacles:{
    1:[{id:1,type:'cerceau',dist:10},{id:2,type:'cerceau',dist:18}],
    2:[{id:3,type:'apnee',dist:0,depl:12},{id:4,type:'objet',dist:18}],
    3:[{id:5,type:'tapis',dist:10},{id:6,type:'cerceau',dist:17}],
    4:[{id:7,type:'mannequin',dist:8,remorque:17}]}}},
  {id:'B100N4', ts:1791158400003, name:'100 m · 4 — Expert', data:{nbLongueurs:4, obstacles:{
    1:[{id:1,type:'cerceau',dist:8},{id:2,type:'cerceau',dist:14},{id:3,type:'cerceau',dist:20}],
    2:[{id:4,type:'apnee',dist:0,depl:15},{id:5,type:'objet',dist:20}],
    3:[{id:6,type:'tapis',dist:6},{id:7,type:'apnee',dist:12,depl:12}],
    4:[{id:8,type:'mannequin',dist:5,remorque:20}]}}},
  /* ----- 150 m (6 longueurs) — difficulté croissante ----- */
  {id:'B150N1', ts:1791158400004, name:'150 m · 1 — Découverte', data:{nbLongueurs:6, obstacles:{1:[],
    2:[{id:1,type:'cerceau',dist:12}], 3:[],
    4:[{id:2,type:'apnee',dist:0,depl:6}],
    5:[{id:3,type:'objet',dist:12}],
    6:[{id:4,type:'mannequin',dist:15,remorque:10}]}}},
  {id:'B150N2', ts:1791158400005, name:'150 m · 2 — Initiation', data:{nbLongueurs:6, obstacles:{1:[],
    2:[{id:1,type:'cerceau',dist:10},{id:2,type:'cerceau',dist:18}],
    3:[{id:3,type:'apnee',dist:0,depl:8}],
    4:[{id:4,type:'objet',dist:14}], 5:[],
    6:[{id:5,type:'mannequin',dist:12,remorque:13}]}}},
  {id:'B150N3', ts:1791158400006, name:'150 m · 3 — Confirmé', data:{nbLongueurs:6, obstacles:{
    1:[{id:1,type:'cerceau',dist:12}],
    2:[{id:2,type:'apnee',dist:0,depl:10},{id:3,type:'cerceau',dist:18}],
    3:[{id:4,type:'tapis',dist:10}],
    4:[{id:5,type:'objet',dist:8}],
    5:[{id:6,type:'apnee',dist:10,depl:12}],
    6:[{id:7,type:'mannequin',dist:8,remorque:17}]}}},
  {id:'B150N4', ts:1791158400007, name:'150 m · 4 — Expert', data:{nbLongueurs:6, obstacles:{
    1:[{id:1,type:'cerceau',dist:8},{id:2,type:'cerceau',dist:16}],
    2:[{id:3,type:'apnee',dist:0,depl:15}],
    3:[{id:4,type:'tapis',dist:6},{id:5,type:'objet',dist:16}],
    4:[{id:6,type:'apnee',dist:0,depl:12}],
    5:[{id:7,type:'apnee',dist:8,depl:15}],
    6:[{id:8,type:'mannequin',dist:3,remorque:22}]}}},
  /* ----- Parcours de la V4c ----- */
  {id:'Pmlgbnnkxtmd5gz', ts:1770711077409, name:'LJ Difficulté 1', data:{nbLongueurs:6, obstacles:{1:[],2:[],
    3:[{id:1,type:'cerceau',dist:8},{id:2,type:'cerceau',dist:14},{id:3,type:'cerceau',dist:19}],
    4:[{id:4,type:'apnee',dist:0,depl:6}], 5:[], 6:[{id:5,type:'mannequin',dist:15,remorque:10}]}}},
  {id:'Pmlgbsj9tr1mhi6', ts:1770711305105, name:'LJ Difficulté 2', data:{nbLongueurs:6, obstacles:{1:[],2:[],
    3:[{id:1,type:'cerceau',dist:10},{id:2,type:'cerceau',dist:14},{id:3,type:'cerceau',dist:19}],
    4:[{id:4,type:'apnee',dist:0,depl:8}], 5:[{id:6,type:'apnee',dist:17,depl:8}], 6:[{id:5,type:'mannequin',dist:1,remorque:20}]}}},
  {id:'Pmlgbrhbvvpb2wq', ts:1770711255931, name:'LJ Difficulté 3', data:{nbLongueurs:6, obstacles:{1:[],2:[],
    3:[{id:1,type:'cerceau',dist:10},{id:2,type:'cerceau',dist:14},{id:3,type:'cerceau',dist:19}],
    4:[{id:4,type:'apnee',dist:0,depl:10}], 5:[{id:6,type:'apnee',dist:15,depl:10}], 6:[{id:5,type:'mannequin',dist:1,remorque:25}]}}},
];

/* ---------- Utilitaires ---------- */
const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
const uid = (p='P')=> p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const clone = (o)=>JSON.parse(JSON.stringify(o));

function lenLabel(i){ // i : index 0-based
  const pair = Math.floor(i/2)+1;
  return (i%2===0 ? 'Aller ' : 'Retour ') + pair;
}
function lenShort(i){ return 'L'+(i+1); }

/** Normalise n'importe quel format connu vers le modèle interne
 *  {id,name,ts,builtin,n,obstacles:[[{id,type,dist,depl?,remorque?}],...]} */
function normalize(input){
  if(!input || typeof input!=='object') throw new Error('Parcours vide');
  const src = input.data ? input.data : input;
  let n, obsRaw;
  if(Array.isArray(src.obstacles)){ n = src.n || src.nbLongueurs || src.obstacles.length; obsRaw = src.obstacles; }
  else { n = src.nbLongueurs || src.n || 4; obsRaw = src.obstacles || {}; }
  n = clamp(parseInt(n,10)||4, 1, MAX_LEN);
  const obstacles = [];
  let k = 1;
  for(let i=0;i<n;i++){
    const arr = Array.isArray(obsRaw) ? (obsRaw[i]||[]) : (obsRaw[i+1] || obsRaw[String(i+1)] || []);
    obstacles.push(arr.filter(o=>o && TYPES[o.type]).slice(0, MAX_OBS_PER_LEN).map(o=>{
      const r = { id:k++, type:o.type, dist:clamp(Number(o.dist)||0, 0, POOL) };
      if(o.type==='apnee') r.depl = clamp(Number(o.depl ?? 10), 1, POOL);
      if(o.type==='mannequin') r.remorque = clamp(Number(o.remorque ?? 10), 0, POOL);
      return r;
    }).sort((a,b)=>a.dist-b.dist));
  }
  return {
    id: input.id || uid(),
    name: String(input.name || 'Sans nom').trim().slice(0,80) || 'Sans nom',
    ts: Number(input.ts) || Date.now(),
    builtin: !!input.builtin,
    n, obstacles
  };
}

/** Format d'échange JSON (compatible avec l'ancienne version V4c) */
function toExchange(p){
  const obstacles = {};
  p.obstacles.forEach((arr,i)=>{ obstacles[i+1] = arr.map(o=>{
    const r={id:o.id,type:o.type,dist:o.dist};
    if(o.type==='apnee') r.depl=o.depl;
    if(o.type==='mannequin') r.remorque=o.remorque;
    return r;
  }); });
  return { format:'sauvetage-ca2-parcours', v:2, id:p.id, ts:p.ts, name:p.name, data:{ nbLongueurs:p.n, obstacles } };
}

function emptyParcours(n=4){
  return { id:uid(), name:'', ts:Date.now(), builtin:false, n, obstacles:Array.from({length:n},()=>[]) };
}

function countObstacles(p){ return p.obstacles.reduce((s,a)=>s+a.length,0); }

function summary(p){
  const c = {};
  p.obstacles.flat().forEach(o=>{ c[o.type]=(c[o.type]||0)+1; });
  const parts = TYPE_ORDER.filter(t=>c[t]).map(t=>c[t]+' '+TYPES[t].short.toLowerCase()+(c[t]>1 && !/s$/.test(TYPES[t].short)?'s':''));
  return parts.length ? parts.join(' · ') : 'Aucun obstacle';
}

/** Avertissements pédagogiques/techniques (non bloquants) */
function warnings(p){
  const w = [];
  p.obstacles.forEach((arr,i)=>{
    const sorted = arr.slice().sort((a,b)=>a.dist-b.dist);
    sorted.forEach((o,j)=>{
      let end = o.dist;
      if(o.type==='apnee'){ end = o.dist + o.depl; if(end>POOL) w.push(`${lenLabel(i)} : l'apnée se termine à ${end} m (au-delà du mur).`); }
      if(o.type==='mannequin'){ end = o.dist + o.remorque; if(end>POOL) w.push(`${lenLabel(i)} : le remorquage se termine à ${end} m (au-delà du mur, il sera arrêté au mur).`); }
      if(o.type==='tapis'){ end = o.dist + 1.5; }
      const next = sorted[j+1];
      if(next){
        const nStart = next.type==='tapis' ? next.dist-1.5 : next.dist;
        if(nStart < end) w.push(`${lenLabel(i)} : ${TYPES[o.type].short.toLowerCase()} (${o.dist} m) et ${TYPES[next.type].short.toLowerCase()} (${next.dist} m) se chevauchent.`);
        else if(nStart - end < 1 && o.type!=='apnee' && o.type!=='mannequin') w.push(`${lenLabel(i)} : obstacles très proches (${o.dist} m et ${next.dist} m).`);
      }
    });
  });
  return w;
}

/* ---------- Stockage local ---------- */
const K = { lib:'sca2.library', cur:'sca2.current', chrono:'sca2.chrono', results:'sca2.results', settings:'sca2.settings' };
function read(key, fallback){ try{ const r=localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }catch(e){ return fallback; } }
function write(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ return false; } }

const builtins = BUILTIN_RAW.map(b=>normalize(Object.assign({}, b, {builtin:true})));

function library(){
  const user = (read(K.lib, [])||[]).map(p=>{ try{ return normalize(p); }catch(e){ return null; } }).filter(Boolean);
  return { builtins, user: user.sort((a,b)=>b.ts-a.ts) };
}
function findParcours(id){
  const L = library();
  return L.user.find(p=>p.id===id) || L.builtins.find(p=>p.id===id) || null;
}
function saveToLibrary(p){
  const list = read(K.lib, []) || [];
  const item = clone(p); item.builtin=false; item.ts = Date.now();
  const i = list.findIndex(x=>x && x.id===item.id);
  if(i>=0) list[i]=item; else list.unshift(item);
  write(K.lib, list);
  return item;
}
function deleteFromLibrary(id){
  write(K.lib, (read(K.lib, [])||[]).filter(p=>p && p.id!==id));
}
function nameExists(name, exceptId){
  const n = String(name||'').trim().toLowerCase();
  const L = library();
  return [...L.builtins, ...L.user].some(p=>p.id!==exceptId && p.name.trim().toLowerCase()===n);
}

/* Parcours actif (utilisé par Visualiser et Chrono) */
function current(){
  const c = read(K.cur, null);
  if(c){ try{ return normalize(c); }catch(e){} }
  return clone(builtins[0]);
}
function setCurrent(p){ write(K.cur, clone(p)); }

/* Résultats (passages chronométrés) */
function results(){ return read(K.results, []) || []; }
function addResult(r){ const a=results(); a.unshift(r); write(K.results, a); }
function deleteResult(id){ write(K.results, results().filter(r=>r.id!==id)); }
function clearResults(){ write(K.results, []); }

/* Session chrono en cours */
function chronoSession(){ return read(K.chrono, null); }
function saveChronoSession(s){ s ? write(K.chrono, s) : localStorage.removeItem(K.chrono); }

/* Réglages */
const DEFAULT_SETTINGS = { timeObstacles:true, simSpeed:1 };
function settings(){ return Object.assign({}, DEFAULT_SETTINGS, read(K.settings, {})); }
function setSetting(k,v){ const s=settings(); s[k]=v; write(K.settings, s); }

/* ---------- Migration depuis la V4c ---------- */
(function migrate(){
  try{
    if(localStorage.getItem('sca2.migrated')) return;
    // ancienne liste (jamais réellement remplie à cause d'un bug, mais au cas où)
    const oldList = read('pa_parcours_list_v1', null);
    if(Array.isArray(oldList) && oldList.length){
      const lib = read(K.lib, []) || [];
      oldList.forEach(p=>{ try{ const n=normalize(p); if(!lib.some(x=>x.id===n.id)) lib.push(n); }catch(e){} });
      write(K.lib, lib);
    }
    // dernier parcours travaillé dans la V4c
    const oldState = read('pa_state_v3', null);
    if(oldState && oldState.data && !read(K.cur, null)){
      const p = normalize({ name:'Parcours récupéré (ancienne version)', data:oldState.data });
      if(countObstacles(p)>0){ setCurrent(p); saveToLibrary(p); }
    }
    localStorage.setItem('sca2.migrated','1');
  }catch(e){}
})();

return {
  POOL, MAX_LEN, MAX_OBS_PER_LEN, TYPES, TYPE_ORDER,
  uid, clone, clamp, lenLabel, lenShort,
  normalize, toExchange, emptyParcours, countObstacles, summary, warnings,
  library, findParcours, saveToLibrary, deleteFromLibrary, nameExists,
  current, setCurrent,
  results, addResult, deleteResult, clearResults,
  chronoSession, saveChronoSession,
  settings, setSetting,
};
})();
