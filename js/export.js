/* =========================================================
   Export — fichiers JSON, CSV (tableur) et fiche PNG élève
   ========================================================= */
const Exporter = (function(){
'use strict';

function safe(s, max=40){
  return (String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().replace(/[^\w\-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,max)) || 'sans_nom';
}
function stamp(d=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

/** Télécharge (ou partage sur mobile si demandé) un Blob */
async function deliver(blob, filename, {share=false}={}){
  try{
    if(share && navigator.canShare){
      const file = new File([blob], filename, {type:blob.type});
      if(navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:filename}); return true; }
    }
  }catch(e){ if(e && e.name==='AbortError') return false; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  return true;
}

/* ---------- Parcours JSON ---------- */
function parcoursJson(p){
  const blob = new Blob([JSON.stringify(Store.toExchange(p), null, 2)], {type:'application/json'});
  return deliver(blob, safe(p.name, 60)+'.json');
}

/* ---------- CSV des passages ---------- */
function resultsCsv(results){
  // colonnes d'obstacles : union des libellés « L3 Cerceau 8m »
  const obsCols = [];
  const seen = new Set();
  let maxLen = 0;
  results.forEach(r=>{
    maxLen = Math.max(maxLen, r.lengths.length);
    r.obstacles.forEach(o=>{
      const k = obsKey(o);
      if(!seen.has(k)){ seen.add(k); obsCols.push({k, li:o.li, dist:o.dist}); }
    });
  });
  obsCols.sort((a,b)=>a.li-b.li || a.dist-b.dist || a.k.localeCompare(b.k));
  const head = ['Nom','Prénom','Classe','Date','Heure','Parcours','Temps total','Temps total (s)','Fautes','Nage hors obstacles (s)','Obstacles cumulés (s)'];
  for(let i=0;i<maxLen;i++) head.push(`${Store.lenLabel(i)} (s)`);
  obsCols.forEach(c=>head.push(c.k+' (s)'));
  const rows = [head];
  results.slice().sort((a,b)=>(a.classe||'').localeCompare(b.classe||'') || a.nom.localeCompare(b.nom) || a.ts-b.ts).forEach(r=>{
    const d = new Date(r.ts);
    const row = [r.nom, r.prenom, r.classe, d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
      r.parcours.name, Chrono.fmt(r.total), Chrono.secs(r.total), r.faults, Chrono.secs(r.swim), Chrono.secs(r.obsTotal)];
    for(let i=0;i<maxLen;i++) row.push(Chrono.secs(r.lengths[i]));
    const m = {}; r.obstacles.forEach(o=>{ m[obsKey(o)] = o.dur; });
    obsCols.forEach(c=>row.push(Chrono.secs(m[c.k])));
    rows.push(row);
  });
  const csv = rows.map(r=>r.map(cell=>{
    const s = String(cell==null?'':cell);
    return /[;"\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }).join(';')).join('\r\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  return deliver(blob, `Sauvetage_CA2_resultats_${stamp()}.csv`);
}
function obsKey(o){ return `${Store.lenShort(o.li)} ${Store.TYPES[o.type].short} ${o.dist}m`; }

/* ---------- Fiche PNG ---------- */
function resultPng(r, {share=true}={}){
  const W = 1100, pad = 36;
  const p = r.parcours;
  const lineH = 30;
  const nObsLines = Math.max(1, r.obstacles.length);
  const schemaH = Math.min(340, 40 + p.n*44);
  const H = pad + 150 + schemaH + 40 + 46 + p.n*lineH + 30 + 46 + nObsLines*lineH + pad + 30;
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const ctx = c.getContext('2d');
  const F = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const M = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0b3d91'; ctx.fillRect(0,0,W,10);

  let y = pad+28;
  ctx.fillStyle='#0b1a33'; ctx.font=`800 28px ${F}`; ctx.textBaseline='alphabetic';
  ctx.fillText('Sauvetage aquatique CA2 — fiche de passage', pad, y);
  y += 26; ctx.font=`500 16px ${F}`; ctx.fillStyle='#4a5568';
  ctx.fillText(`${new Date(r.ts).toLocaleString('fr-FR')} · Parcours « ${p.name} » · ${p.n} longueurs`, pad, y);
  y += 44; ctx.font=`800 30px ${F}`; ctx.fillStyle='#0b1a33';
  ctx.fillText(`${r.nom} ${r.prenom}`.trim() || 'Élève', pad, y);
  if(r.classe){ ctx.font=`600 18px ${F}`; ctx.fillStyle='#4a5568'; ctx.fillText(r.classe, pad, y+28); }

  // bloc temps total
  ctx.textAlign='right';
  ctx.font=`900 52px ${M}`; ctx.fillStyle='#000'; ctx.fillText(Chrono.fmt(r.total), W-pad, pad+92);
  ctx.font=`800 20px ${F}`; ctx.fillStyle = r.faults ? '#c62828' : '#2e7d32';
  ctx.fillText(`Fautes : ${r.faults}`, W-pad, pad+124);
  ctx.textAlign='left';

  // schéma
  y = pad + 150;
  ctx.save(); ctx.translate(pad, y);
  Schema.draw(ctx, p, W-2*pad, schemaH, {theme:'light'});
  ctx.restore();
  y += schemaH + 40;

  // synthèse
  ctx.font=`800 20px ${F}`; ctx.fillStyle='#0b1a33'; ctx.fillText('Longueurs', pad, y);
  if(r.timeObstacles){
    ctx.textAlign='right'; ctx.font=`600 16px ${F}`; ctx.fillStyle='#4a5568';
    ctx.fillText(`Nage hors obstacles : ${Chrono.fmt(r.swim)}   ·   Obstacles cumulés : ${Chrono.fmt(r.obsTotal)}`, W-pad, y);
    ctx.textAlign='left';
  }
  y += 14;
  r.lengths.forEach((d,i)=>{
    y += lineH;
    if(i%2===0){ ctx.fillStyle='#f3f6fb'; ctx.fillRect(pad-8, y-21, W-2*pad+16, lineH); }
    ctx.fillStyle='#1a202c'; ctx.font=`600 17px ${F}`; ctx.fillText(Store.lenLabel(i), pad, y);
    ctx.font=`700 17px ${M}`; ctx.fillText(Chrono.fmt(d), pad+240, y);
  });

  y += 46;
  ctx.font=`800 20px ${F}`; ctx.fillStyle='#0b1a33'; ctx.fillText('Obstacles', pad, y);
  y += 14;
  if(!r.timeObstacles || !r.obstacles.length){
    y += lineH; ctx.font=`500 16px ${F}`; ctx.fillStyle='#718096';
    ctx.fillText(r.obstacles.length ? 'Obstacles non chronométrés pour ce passage.' : 'Aucun obstacle.', pad, y);
  }else{
    r.obstacles.forEach((o,k)=>{
      y += lineH;
      if(k%2===0){ ctx.fillStyle='#f3f6fb'; ctx.fillRect(pad-8, y-21, W-2*pad+16, lineH); }
      const T = Store.TYPES[o.type];
      let lbl = `${T.label} — ${Store.lenLabel(o.li)} à ${o.dist} m`;
      if(o.type==='apnee') lbl += ` (${o.depl} m)`;
      if(o.type==='mannequin') lbl += ` (remorquage ${o.remorque} m)`;
      ctx.fillStyle='#1a202c'; ctx.font=`600 17px ${F}`; ctx.fillText(lbl, pad, y);
      ctx.font=`700 17px ${M}`; ctx.fillText(Chrono.fmt(o.dur), pad+620, y);
    });
  }

  ctx.font=`600 13px ${F}`; ctx.fillStyle='#a0aec0'; ctx.textAlign='right';
  ctx.fillText("N'EPS numérique — Académie de Nantes · by Quentin Delisle", W-pad, H-16);

  return new Promise(res=>c.toBlob(b=>{
    res(deliver(b, `Sauvetage_${safe(r.nom)}_${safe(r.prenom)}_${stamp(new Date(r.ts))}.png`, {share}));
  }, 'image/png'));
}

return { deliver, parcoursJson, resultsCsv, resultPng, safe };
})();
