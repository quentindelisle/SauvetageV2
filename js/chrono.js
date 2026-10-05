/* =========================================================
   Chrono — logique de chronométrage (sans interface)
   Principe : la liste des « étapes » est déduite du parcours ;
   chaque tap enregistre l'instant de l'étape suivante.
   Annuler = retirer le dernier tap. Tout se recalcule.
   ========================================================= */
const Chrono = (function(){
'use strict';

function fmt(ms, withTenths=true){
  if(ms==null || !isFinite(ms)) return '—';
  ms = Math.max(0, ms);
  const tenths = Math.floor(ms/100);
  const m = Math.floor(tenths/600);
  const s = Math.floor((tenths%600)/10);
  const d = tenths%10;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(withTenths?'.'+d:'');
}
function secs(ms){ // pour tableur : 83,4
  if(ms==null || !isFinite(ms)) return '';
  return (Math.floor(Math.max(0,ms)/100)/10).toFixed(1).replace('.',',');
}

function steps(p, timeObstacles=true){
  const out=[];
  for(let i=0;i<p.n;i++){
    const L = Store.lenLabel(i);
    if(i===0) out.push({kind:'start', li:0, label:'Départ', sub:L});
    if(timeObstacles){
      (p.obstacles[i]||[]).slice().sort((a,b)=>a.dist-b.dist).forEach(o=>{
        const T = Store.TYPES[o.type];
        const extra = o.type==='apnee' ? ` · ${o.depl} m` : (o.type==='mannequin' ? ` · rem. ${o.remorque} m` : '');
        out.push({kind:'obsStart', li:i, obsId:o.id, type:o.type, label:'Début '+T.short.toLowerCase(), sub:`${L} · ${o.dist} m${extra}`});
        out.push({kind:'obsEnd',   li:i, obsId:o.id, type:o.type, label:'Fin '+T.short.toLowerCase(),   sub:`${L} · ${o.dist} m${extra}`});
      });
    }
    if(i<p.n-1) out.push({kind:'turn', li:i, label:'Virage', sub:`Fin ${L} → ${Store.lenLabel(i+1)}`});
    else out.push({kind:'finish', li:i, label:'Arrivée', sub:`Fin ${L}`});
  }
  return out;
}

function newSession(p, opts={}){
  return {
    v:1,
    parcours: Store.clone(p),
    timeObstacles: opts.timeObstacles!==false,
    startEpoch: null,
    taps: [],
    faults: 0,
    student: Object.assign({nom:'',prenom:'',classe:''}, opts.student||{}),
    saved: false,
  };
}

function elapsed(s, now=Date.now()){
  if(!s.startEpoch) return 0;
  const st = steps(s.parcours, s.timeObstacles);
  if(s.taps.length>=st.length) return s.taps[s.taps.length-1];
  return now - s.startEpoch;
}

function tap(s, now=Date.now()){
  const st = steps(s.parcours, s.timeObstacles);
  if(s.taps.length>=st.length) return false;
  if(!s.startEpoch){ s.startEpoch = now; s.taps.push(0); }
  else s.taps.push(Math.max(s.taps[s.taps.length-1]||0, now - s.startEpoch));
  s.saved=false;
  return true;
}
function undo(s){
  if(!s.taps.length) return false;
  s.taps.pop();
  if(!s.taps.length) s.startEpoch=null;
  s.saved=false;
  return true;
}

/** Calcule toutes les durées à partir des taps */
function compute(s, now=Date.now()){
  const p = s.parcours;
  const st = steps(p, s.timeObstacles);
  const t = s.taps;
  const finished = t.length>=st.length;
  const el = elapsed(s, now);
  const lengths = Array.from({length:p.n}, ()=>({start:null,end:null,dur:null}));
  const obsMap = {}; // key li:id
  st.forEach((step,k)=>{
    const at = t[k]; if(at==null) return;
    if(step.kind==='start') lengths[0].start=at;
    else if(step.kind==='turn'){ lengths[step.li].end=at; lengths[step.li+1].start=at; }
    else if(step.kind==='finish') lengths[step.li].end=at;
    else {
      const key=step.li+':'+step.obsId;
      obsMap[key]=obsMap[key]||{start:null,end:null};
      if(step.kind==='obsStart') obsMap[key].start=at; else obsMap[key].end=at;
    }
  });
  lengths.forEach(l=>{ if(l.start!=null && l.end!=null) l.dur=l.end-l.start; });
  const obstacles=[];
  p.obstacles.forEach((arr,li)=>arr.slice().sort((a,b)=>a.dist-b.dist).forEach(o=>{
    const r = obsMap[li+':'+o.id] || {start:null,end:null};
    obstacles.push({li, o, start:r.start, end:r.end, dur:(r.start!=null&&r.end!=null)?r.end-r.start:null});
  }));
  const sum = (arr)=>arr.reduce((a,x)=>a+(x.dur||0),0);
  const lenTotal = sum(lengths);
  const obsTotal = sum(obstacles);
  const byType = {};
  obstacles.forEach(x=>{
    const b = byType[x.o.type] = byType[x.o.type] || {count:0, timed:0, total:0, items:[]};
    b.count++; b.items.push(x); if(x.dur!=null){ b.timed++; b.total+=x.dur; }
  });
  return {
    steps: st, next: finished ? null : st[t.length], nextIndex: t.length,
    started: !!s.startEpoch, finished, elapsed: el,
    lengths, obstacles, byType,
    total: finished ? t[t.length-1] : null,
    lenTotal, obsTotal, swimTotal: s.timeObstacles ? Math.max(0, lenTotal-obsTotal) : null,
  };
}

/** Résultat à archiver */
function toResult(s){
  const c = compute(s);
  return {
    id: Store.uid('R'),
    ts: Date.now(),
    nom: (s.student.nom||'').trim().toUpperCase(),
    prenom: (s.student.prenom||'').trim(),
    classe: (s.student.classe||'').trim(),
    parcours: { id:s.parcours.id, name:s.parcours.name, n:s.parcours.n, obstacles:s.parcours.obstacles },
    timeObstacles: s.timeObstacles,
    total: c.total, faults: s.faults,
    swim: c.swimTotal, obsTotal: s.timeObstacles ? c.obsTotal : null,
    lengths: c.lengths.map(l=>l.dur),
    obstacles: c.obstacles.map(x=>({li:x.li, type:x.o.type, dist:x.o.dist, depl:x.o.depl, remorque:x.o.remorque, dur:x.dur})),
  };
}

return { fmt, secs, steps, newSession, tap, undo, compute, elapsed, toResult };
})();
