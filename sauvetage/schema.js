/* =========================================================
   Schema — plan du parcours (toutes les longueurs empilées)
   Utilisé : éditeur (aperçu), bibliothèque (vignettes),
             chronométrie (repère), export PNG.
   ========================================================= */
const Schema = (function(){
'use strict';
const POOL = 25;

const THEMES = {
  dark:  { bg:'#0b1a33', lane:'#1565c0', laneAlt:'#1976d2', line:'rgba(0,0,0,.45)', text:'rgba(255,255,255,.92)', sub:'rgba(255,255,255,.6)', tick:'rgba(255,255,255,.25)', hl:'#ffd54f', done:'rgba(0,0,0,.35)' },
  light: { bg:'#EAF6FF', lane:'#2D8CE6', laneAlt:'#4FA3EE', line:'rgba(0,30,70,.55)', text:'#002E6E', sub:'#5B6478', tick:'rgba(0,46,110,.18)', hl:'#F59A1B', done:'rgba(255,255,255,.6)' },
};

function rr(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

/** Dessine un pictogramme d'obstacle centré en (x,y). size ≈ hauteur disponible */
function icon(ctx, type, x, y, size, opts={}){
  const s = size;
  ctx.save();
  if(type==='cerceau'){
    ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(2,s*0.12);
    ctx.beginPath(); ctx.arc(x, y+s*0.18, s*0.36, Math.PI, 0, false); ctx.stroke();
    ctx.fillStyle='#111'; ctx.fillRect(x-s*0.46, y+s*0.16, s*0.92, Math.max(2,s*0.08));
  }else if(type==='apnee'){
    const L = (opts.lenPx || s*1.6), dir = opts.dir||1;
    const headL=Math.min(14, s*0.45), headW=Math.min(12, s*0.42);
    ctx.strokeStyle='#00e676'; ctx.fillStyle='#00e676'; ctx.lineWidth=Math.max(3, s*0.14); ctx.lineCap='butt';
    const xTip = x + dir*L, xs = xTip - dir*headL;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(xs,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xTip,y); ctx.lineTo(xs,y-headW/2); ctx.lineTo(xs,y+headW/2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,Math.max(3,s*0.13),0,Math.PI*2); ctx.fill();
  }else if(type==='mannequin'){
    if(opts.lenPx){ // trajet de remorquage
      const dir=opts.dir||1;
      ctx.strokeStyle='rgba(255,235,59,.75)'; ctx.lineWidth=Math.max(2,s*0.08); ctx.setLineDash([6,5]);
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dir*opts.lenPx,y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle='#ffeb3b'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=1;
    const bw=s*0.46, bh=s*0.62;
    ctx.fillRect(x-bw/2, y-bh*0.2, bw, bh); ctx.strokeRect(x-bw/2, y-bh*0.2, bw, bh);
    ctx.beginPath(); ctx.arc(x, y-bh*0.42, s*0.22, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  }else if(type==='objet'){
    ctx.fillStyle='#303030';
    const k=s/12;
    ctx.fillRect(x-4*k,y-1.2*k,8*k,2.4*k);
    ctx.fillRect(x-6.8*k,y-4.2*k,2.6*k,8.4*k);
    ctx.fillRect(x+4.2*k,y-4.2*k,2.6*k,8.4*k);
  }else if(type==='tapis'){
    const w = opts.lenPx || s*1.2, h = s*0.8;
    rr(ctx, x-w/2, y-h/2, w, h, h/2.5); ctx.fillStyle='#c2185b'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.5; ctx.stroke();
  }
  ctx.restore();
}

/**
 * draw(ctx, parcours, W, H, opts)
 *  opts.theme       'dark' | 'light'
 *  opts.labels      afficher les libellés de longueur (défaut true)
 *  opts.ticks       graduations 5 m (défaut true)
 *  opts.highlight   {li, obsId|null, kind}  élément attendu (chrono)
 *  opts.doneUpTo    index de longueur entièrement terminée (grisée)
 *  opts.compact     vignette
 */
function draw(ctx, p, W, H, opts={}){
  const T = THEMES[opts.theme||'light'];
  const compact = !!opts.compact;
  const n = p.n;
  ctx.save();
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = T.bg; ctx.fillRect(0,0,W,H);

  const labelW = (opts.labels===false || compact) ? 0 : Math.min(92, W*0.16);
  const padX = compact ? 4 : 10, padTop = (opts.ticks===false || compact) ? (compact?4:8) : 22, padBot = compact?4:8;
  const gap = compact ? 2 : Math.max(3, Math.min(8, H*0.012));
  const x0 = padX + labelW, x1 = W - padX, w = x1 - x0;
  const bandH = Math.max(compact?4:14, (H - padTop - padBot - gap*(n-1)) / n);
  const mx = (m)=> x0 + (m/POOL)*w;

  // graduations
  if(!compact && opts.ticks!==false){
    ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    for(let m=0;m<=25;m+=5){
      ctx.fillStyle=T.sub; ctx.fillText(m+' m', Math.min(Math.max(mx(m), x0+14), x1-14), 14);
      ctx.strokeStyle=T.tick; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(mx(m), padTop-4); ctx.lineTo(mx(m), H-padBot); ctx.stroke();
    }
  }

  for(let i=0;i<n;i++){
    const y = padTop + i*(bandH+gap);
    const dir = (i%2===0) ? 1 : -1;
    const pair = Math.floor(i/2);
    // couloir
    rr(ctx, x0, y, w, bandH, compact?2:6);
    ctx.fillStyle = (pair%2===0) ? T.lane : T.laneAlt; ctx.fill();
    // ligne de fond (2,5 → 22,5 m)
    if(bandH>=10){
      ctx.strokeStyle=T.line; ctx.lineWidth=Math.max(1.5, bandH*0.07);
      const ym=y+bandH/2;
      ctx.beginPath(); ctx.moveTo(mx(2.5), ym); ctx.lineTo(mx(22.5), ym); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx(2.5), ym-bandH*0.22); ctx.lineTo(mx(2.5), ym+bandH*0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx(22.5), ym-bandH*0.22); ctx.lineTo(mx(22.5), ym+bandH*0.22); ctx.stroke();
    }
    // flèche de sens
    if(!compact && bandH>=16){
      ctx.fillStyle='rgba(255,255,255,.55)';
      const ax = dir>0 ? x0+12 : x1-12, ay=y+bandH/2, a=Math.min(7,bandH*0.25);
      ctx.beginPath(); ctx.moveTo(ax+dir*a, ay); ctx.lineTo(ax-dir*a*0.6, ay-a); ctx.lineTo(ax-dir*a*0.6, ay+a); ctx.closePath(); ctx.fill();
    }
    // libellé
    if(labelW){
      ctx.fillStyle=T.text; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.font = `800 ${Math.max(11, Math.min(14, bandH*0.42))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText(Store.lenLabel(i), 6, y+bandH/2);
    }
    // obstacles
    const s = Math.max(compact?5:10, Math.min(bandH*0.78, 26));
    (p.obstacles[i]||[]).forEach(o=>{
      const xPool = dir>0 ? o.dist : POOL - o.dist;
      const x = mx(xPool), yy = y + bandH/2;
      const o2 = {dir};
      if(o.type==='apnee') o2.lenPx = (o.depl/POOL)*w;
      if(o.type==='mannequin') o2.lenPx = (Math.min(o.remorque, POOL-o.dist)/POOL)*w;
      if(o.type==='tapis') o2.lenPx = (3/POOL)*w;
      const hl = opts.highlight && opts.highlight.li===i && opts.highlight.obsId===o.id;
      if(hl){
        ctx.save(); ctx.strokeStyle=T.hl; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(x, yy, Math.max(12, bandH*0.5), 0, Math.PI*2); ctx.stroke(); ctx.restore();
      }
      icon(ctx, o.type, x, yy, s, o2);
    });
    // longueur terminée
    if(opts.doneUpTo!=null && i<=opts.doneUpTo){
      rr(ctx, x0, y, w, bandH, compact?2:6); ctx.fillStyle=T.done; ctx.fill();
    }
    // longueur attendue (départ/virage/arrivée)
    if(opts.highlight && opts.highlight.li===i && opts.highlight.obsId==null){
      ctx.save(); ctx.strokeStyle=T.hl; ctx.lineWidth=3;
      rr(ctx, x0-1.5, y-1.5, w+3, bandH+3, compact?3:7); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
}

/** Rend dans un <canvas> en tenant compte du devicePixelRatio */
function render(canvas, p, opts={}){
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  const W = Math.max(60, r.width), H = Math.max(30, r.height);
  canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw(ctx, p, W, H, opts);
}

return { draw, render, icon };
})();
