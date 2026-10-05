/* =========================================================
   Sim — animation du parcours (vue de dessus + vue de côté)
   Moteur repris de la V4c, nettoyé et encapsulé.
   ========================================================= */
const Sim = (function(){
'use strict';
let cvTop=null, cvSide=null, ctxT=null, ctxS=null;
let active=false, rafId=null, speed=1;
let D={nbLongueurs:1, obstacles:{1:[]}};
let listeners={state:()=>{}, frame:()=>{}};
function onState(){ try{ listeners.state(getStatus()); }catch(e){} }
function onFrame(){ try{ listeners.frame(getStatus()); }catch(e){} }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function cssW(c){ return c.width/(c._dpr||1); }
function cssH(c){ return c.height/(c._dpr||1); }

/* ========= Mapping ========= */
const POOL_LEN=25.0;
const LANE_W=2.5;
const DEPTH=1.8;

function m2x(m, W, pad, lenM){ return pad + (m/lenM)*(W-2*pad); }
function m2y(m, H, pad, widM){ return pad + (m/widM)*(H-2*pad); }
function getXPool(len, sAlong){ // pool coordinate (0..25), sAlong is progress along current length (0..25 from start wall)
 const goingRight = (len%2===1);
 return goingRight ? sAlong : (POOL_LEN - sAlong);
}

function roundRectPath(ctx,x,y,w,h,r){
 r=Math.max(0, Math.min(r, Math.min(w,h)/2));
 ctx.beginPath();
 ctx.moveTo(x+r,y);
 ctx.arcTo(x+w,y,x+w,y+h,r);
 ctx.arcTo(x+w,y+h,x,y+h,r);
 ctx.arcTo(x,y+h,x,y,r,r);
 ctx.arcTo(x,y,x+w,y,r);
 ctx.closePath();
}

/* ========= Dessin bassin ========= */
function drawBordersTop(ctx,W,H,pad){
 const DARK_BLUE = '#0d47a1';
 const segments = [
  {a:0,b:5, c:'#e53935'},
  {a:5,b:9.9, c:'#ffffff'},
  {a:9.9,b:10, c:'#e53935', solid:true},
  {a:10.1,b:14.9, c:DARK_BLUE},
  {a:14.9,b:15, c:'#e53935', solid:true},
  {a:15.1,b:20, c:'#ffffff'},
  {a:20,b:25, c:'#e53935'}
 ];
 const thick = Math.max(2, (H-2*pad) * (0.10/LANE_W));
 const dash = (W-2*pad) * (0.10/POOL_LEN);
 const gap = dash*0.7;
 function drawEdge(y){
  segments.forEach(s=>{
   const x1=m2x(s.a,W,pad,POOL_LEN);
   const x2=m2x(s.b,W,pad,POOL_LEN);
   ctx.strokeStyle=s.c;
   ctx.lineWidth=thick;
   ctx.lineCap='butt';
   if(s.solid){
    ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(x2,y); ctx.stroke();
   }else{
    let x=x1;
    while(x<x2){
     const xe=Math.min(x+dash, x2);
     ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(xe,y); ctx.stroke();
     x += dash + gap;
    }
   }
  });
  ctx.strokeStyle='rgba(0,0,0,0.25)';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
 }
 const edgeOffset = Math.min(pad*0.55, thick*1.4);
 const yTop = Math.max(thick/2+1, pad - edgeOffset);
 const yBot = Math.min(H - thick/2 - 1, (H-pad) + edgeOffset);
 drawEdge(yTop);
 drawEdge(yBot);
}
function drawHLineTop(ctx,W,H,pad){
 const yMid = m2y(LANE_W/2, H, pad, LANE_W);
 const halfV = (1.0/2) * (H-2*pad)/LANE_W;
 const xA = m2x(2.5, W, pad, POOL_LEN);
 const xB = m2x(22.5, W, pad, POOL_LEN);
 ctx.strokeStyle='#000';
 ctx.lineWidth=Math.max(2, (H-2*pad)*0.04);
 ctx.lineCap='square';
 ctx.beginPath(); ctx.moveTo(xA, yMid-halfV); ctx.lineTo(xA, yMid+halfV); ctx.stroke();
 ctx.beginPath(); ctx.moveTo(xB, yMid-halfV); ctx.lineTo(xB, yMid+halfV); ctx.stroke();
 ctx.beginPath(); ctx.moveTo(xA, yMid); ctx.lineTo(xB, yMid); ctx.stroke();
}
function drawLaneTop(){
 const W=cssW(cvTop), H=cssH(cvTop);
 ctxT.clearRect(0,0,W,H);
 ctxT.fillStyle='#1976d2';
 ctxT.fillRect(0,0,W,H);
 const pad=Math.max(10, Math.min(18, W*0.02));
 ctxT.fillStyle='rgba(255,255,255,0.05)';
 ctxT.fillRect(pad,pad,W-2*pad,H-2*pad);

 const yMid=H/2;
 ctxT.strokeStyle='rgba(0,0,0,0.35)';
 ctxT.lineWidth=Math.max(2, (H-2*pad)*0.02);
 ctxT.beginPath();
 ctxT.moveTo(pad + (2.5/POOL_LEN)*(W-2*pad), yMid);
 ctxT.lineTo(pad + ((POOL_LEN-2.5)/POOL_LEN)*(W-2*pad), yMid);
 ctxT.stroke();

 drawBordersTop(ctxT,W,H,pad);
 drawHLineTop(ctxT,W,H,pad);

 ctxT.strokeStyle='rgba(255,255,255,0.35)';
 ctxT.lineWidth=2;
 ctxT.strokeRect(pad,pad,W-2*pad,H-2*pad);

 return {W,H,pad,yMid};
}
function drawAirZone(W,H,pad,surfaceY){
 const grad=ctxS.createLinearGradient(0,pad,0,surfaceY);
 grad.addColorStop(0,'#f5fbff');
 grad.addColorStop(1,'#cfe9ff');
 ctxS.fillStyle=grad;
 ctxS.fillRect(pad,pad,W-2*pad,surfaceY-pad);
 ctxS.strokeStyle='rgba(255,255,255,0.55)';
 ctxS.lineWidth=1;
 for(let x=pad; x<=W-pad; x+=40){
  ctxS.beginPath(); ctxS.moveTo(x, pad); ctxS.lineTo(x+30, surfaceY); ctxS.stroke();
 }
 ctxS.strokeStyle='rgba(0,0,0,0.12)';
 for(let x=pad; x<=W-pad; x+=70){
  ctxS.beginPath(); ctxS.moveTo(x,pad); ctxS.lineTo(x,surfaceY); ctxS.stroke();
 }
}
function drawTilesSide(W,H,pad,surfaceY){
 const yBottom = H-pad;
 const yTileTop = surfaceY + (yBottom-surfaceY)*0.55;
 ctxS.fillStyle='rgba(0,0,0,0.12)';
 ctxS.fillRect(pad,yTileTop,W-2*pad,yBottom-yTileTop);
 const tile=30;
 ctxS.strokeStyle='rgba(0,0,0,0.16)';
 for(let x=pad; x<=W-pad; x+=tile){
  ctxS.beginPath(); ctxS.moveTo(x,yTileTop); ctxS.lineTo(x,yBottom); ctxS.stroke();
 }
 for(let y=yTileTop; y<=yBottom; y+=tile){
  ctxS.beginPath(); ctxS.moveTo(pad,y); ctxS.lineTo(W-pad,y); ctxS.stroke();
 }
}
function drawLaneSide(){
 const W=cssW(cvSide), H=cssH(cvSide);
 ctxS.clearRect(0,0,W,H);
 ctxS.fillStyle='#0f2140';
 ctxS.fillRect(0,0,W,H);
 const pad=Math.max(10, Math.min(18, W*0.02));
 const surfaceY = pad + (H-2*pad)*0.22;

 drawAirZone(W,H,pad,surfaceY);

 const wgrad=ctxS.createLinearGradient(0,surfaceY,0,H-pad);
 wgrad.addColorStop(0,'#1e88e5');
 wgrad.addColorStop(1,'#0d47a1');
 ctxS.fillStyle=wgrad;
 ctxS.fillRect(pad,surfaceY,W-2*pad,(H-pad)-surfaceY);

 ctxS.strokeStyle='rgba(255,255,255,0.65)';
 ctxS.lineWidth=2;
 ctxS.beginPath(); ctxS.moveTo(pad,surfaceY); ctxS.lineTo(W-pad,surfaceY); ctxS.stroke();

 drawTilesSide(W,H,pad,surfaceY);

 ctxS.strokeStyle='rgba(255,255,255,0.35)';
 ctxS.lineWidth=2;
 ctxS.strokeRect(pad,pad,W-2*pad,H-2*pad);

 return {W,H,pad,surfaceY,bottomY:H-pad};
}

/* ========= Obstacles ========= */
function currentPairLengths(lenIndex){
 const phase=Math.floor((lenIndex-1)/2);
 const a=phase*2+1, b=a+1;
 return [a,b].filter(x=>x<=D.nbLongueurs);
}
function bandYmeters(len){ return (len%2===1)?1.9:0.6; } // center of band
function bandRectY(top, len){
 // return {y, h} in px inside lane for tapis (half-lane)
 const yMid=top.yMid;
 const pad=top.pad;
 const hHalf=(top.H-2*pad)/2;
 if(len%2===1){ // aller bottom half
  return {y:yMid, h:(top.H-pad)-yMid};
 }else{ // retour top half
  return {y:pad, h:yMid-pad};
 }
}

function drawObstaclesTop(top){
 const {W,H,pad}=top;
 const lens=currentPairLengths(sim.len);
 lens.forEach(li=>{
  const yM=bandYmeters(li);
  (D.obstacles[li]||[]).forEach(obs=>{
   if((obs.type==='objet' || obs.type==='mannequin') && obs._taken) return;
   const xPool=getXPool(li, obs.dist); // IMPORTANT: dist is progress from start wall
   const x=m2x(xPool,W,pad,POOL_LEN);
   const y=m2y(yM,H,pad,LANE_W);

   if(obs.type==='cerceau'){
    ctxT.strokeStyle='rgba(0,0,0,0.85)'; ctxT.lineWidth=3;
    const r=Math.min(12, (H-2*pad)*0.085); // larger cerceau for readability
    // cerceau légèrement oblique (pas parfaitement perpendiculaire)
    const ang = (sim.len%2===1 ? -0.28 : 0.28); // ~16°
    ctxT.save();
    ctxT.translate(x,y);
    ctxT.rotate(ang);
    ctxT.beginPath();
    ctxT.arc(0,0,r,Math.PI,0,false);
    ctxT.stroke();
    ctxT.restore();
   }else if(obs.type==='apnee'){
    const len=Math.max(18,(obs.depl/POOL_LEN)*(W-2*pad));
    const dir=(li%2===1)?1:-1;
    const headL=16, headW=12;
    const xTip=x+dir*len;
    const xShaftEnd=xTip-dir*headL;
    ctxT.strokeStyle='#00e676'; ctxT.fillStyle='#00e676'; ctxT.lineWidth=5;
    ctxT.lineCap='butt';
    ctxT.beginPath(); ctxT.moveTo(x,y); ctxT.lineTo(xShaftEnd,y); ctxT.stroke();
    ctxT.beginPath();
    ctxT.moveTo(xTip,y);
    ctxT.lineTo(xShaftEnd, y-headW/2);
    ctxT.lineTo(xShaftEnd, y+headW/2);
    ctxT.closePath(); ctxT.fill();
    ctxT.font='14px Arial'; ctxT.fillText('apnée', x-18, y+22);
   }else if(obs.type==='mannequin'){
    ctxT.fillStyle='#ffeb3b';
    const bw=7,bh=10;
    ctxT.fillRect(x-bw/2,y-bh/2,bw,bh);
    ctxT.beginPath(); ctxT.arc(x,y-bh/2-5,5,0,Math.PI*2); ctxT.fill();

   }else if(obs.type==='objet'){
    // haltère : plus petit et gris foncé
    ctxT.fillStyle='#424242';
    ctxT.fillRect(x-4,y-1.2,8,2.4);
    ctxT.fillRect(x-6.8,y-4.2,2.6,8.4);
    ctxT.fillRect(x+4.2,y-4.2,2.6,8.4);
   }else if(obs.type==='tapis'){
    // tapis : rose foncé + bords arrondis (forme douce)
    const lenPx=(3/POOL_LEN)*(W-2*pad);
    const r=bandRectY(top, li);
    const px = x-lenPx/2;
    const py = r.y+2;
    const pw = lenPx;
    const ph = Math.max(6, r.h-4);
    const rad = Math.min(14, ph/2);
    roundRectPath(ctxT, px, py, pw, ph, rad);
    ctxT.fillStyle='#c2185b';
    ctxT.fill();
    ctxT.strokeStyle='rgba(255,255,255,0.20)';
    ctxT.lineWidth=2;
    ctxT.stroke();
   }
  });
 });
}

function drawObstaclesSide(side){
 const {W,H,pad,surfaceY,bottomY}=side;
 const yAt=(m)=> surfaceY + (m/DEPTH)*(bottomY-surfaceY);
 const li=sim.len;
  (D.obstacles[li]||[]).forEach(obs=>{
   if((obs.type==='objet' || obs.type==='mannequin') && obs._taken) return;
   const xPool=getXPool(li, obs.dist);
   const x=m2x(xPool,W,pad,POOL_LEN);
   if(obs.type==='cerceau'){
    ctxS.strokeStyle='rgba(0,0,0,0.85)'; ctxS.lineWidth=3;
    const r=(0.40/POOL_LEN)*(W-2*pad); // 0.4m radius
    const y=yAt(DEPTH)-2;
    ctxS.beginPath(); ctxS.arc(x,y,r,Math.PI,0,false); ctxS.stroke();
   }else if(obs.type==='apnee'){
    ctxS.strokeStyle='#00e676'; ctxS.fillStyle='#00e676'; ctxS.lineWidth=5;
    const y=yAt(0.8);
    const lenPx=Math.max(20,(obs.depl/POOL_LEN)*(W-2*pad));
    const dir=(li%2===1)?1:-1;
    const headL=16, headW=12;
    const xTip=x+dir*lenPx;
    const xShaftEnd=xTip-dir*headL;
    ctxS.lineCap='butt';
    ctxS.beginPath(); ctxS.moveTo(x,y); ctxS.lineTo(xShaftEnd,y); ctxS.stroke();
    ctxS.beginPath();
    ctxS.moveTo(xTip,y);
    ctxS.lineTo(xShaftEnd, y-headW/2);
    ctxS.lineTo(xShaftEnd, y+headW/2);
    ctxS.closePath(); ctxS.fill();
    ctxS.font='14px Arial'; ctxS.fillText('apnée', x-18, y+22);
   }else if(obs.type==='mannequin'){
    const y=yAt(DEPTH)-4;
    ctxS.fillStyle='#ffeb3b';
    const bw=22,bh=8;
    ctxS.fillRect(x-bw/2,y-bh/2,bw,bh);
    ctxS.beginPath(); ctxS.arc(x+bw/2+5, y-bh/2, 4, 0, Math.PI*2); ctxS.fill();
    ctxS.strokeRect(x-bw/2,y-bh/2,bw,bh);
   }else if(obs.type==='objet'){
    const y=yAt(DEPTH)-10;
    // haltère : plus petit et gris foncé
    ctxS.fillStyle='#424242';
    ctxS.fillRect(x-5,y+1,10,3);
    ctxS.fillRect(x-8,y-3,3,11);
    ctxS.fillRect(x+5,y-3,3,11);
   }else if(obs.type==='tapis'){
    const lenPx=(3/POOL_LEN)*(W-2*pad);
    const px = x-lenPx/2;
    const py = surfaceY-8;
    const pw = lenPx;
    const ph = 16;
    roundRectPath(ctxS, px, py, pw, ph, ph/2);
    ctxS.fillStyle='#c2185b';
    ctxS.fill();
    ctxS.strokeStyle='rgba(255,255,255,0.20)';
    ctxS.lineWidth=2;
    ctxS.stroke();
   }
 });
}

/* ========= Simulation ========= */
const sim={running:false,paused:false,finished:false,time:0,last:0,len:1,s:0,action:null,carry:null,turnT:0};

function initStatuses(){
 for(let i=1;i<=D.nbLongueurs;i++){
  (D.obstacles[i]||[]).forEach(o=>{ o._done=false; o._taken=false; });
 }
}

function obstacleNearCurrent(){
 const list=D.obstacles[sim.len]||[];
 for(const o of list){
  if(o._done) continue;
  let pos = o.dist; // pos is progress from start wall (0..25)
  if(o.type==='tapis'){ pos = Math.max(0, o.dist-1.5); }
  const ahead = pos - sim.s;
  if(ahead < -0.2){ o._done=true; continue; }
  if(ahead >= -0.2 && ahead <= 0.35) return o;
 }
 return null;
}


function maxPassedDist(len){
 const list=D.obstacles[len]||[];
 let m=-1;
 for(const o of list){ if(o && (o._done || o._taken)) m=Math.max(m, o.dist); }
 return m;
}

function beginAction(o){
 const pos=o.dist;
 if(o.type==='apnee'){
  sim.action={type:'apnee', o, pos, t:0, total:Math.max(1,o.depl)};
 }else if(o.type==='cerceau'){
  sim.action={type:'cerceau', o, pos, t:0, phase:'down'};
 }else if(o.type==='objet'){
  sim.action={type:'objet', o, pos, t:0, phase:'down', xPool:getXPool(sim.len,pos)};
 }else if(o.type==='mannequin'){
  sim.action={type:'mannequin', o, pos, t:0, phase:'down', rem:Math.max(0,o.remorque||0), xPool:getXPool(sim.len,pos)};
 }else if(o.type==='tapis'){
  const start=Math.max(0, o.dist-1.5);
  const end=Math.min(POOL_LEN, o.dist+1.5);
  sim.action={type:'tapis', o, pos:o.dist, t:0, start, end};
 }
}

function finishLength(){
 const prevLen=sim.len;

 // ne pas "effacer" le mannequin/objet à la bordure : si porté, le lâcher et le laisser retomber
 if(sim.carry && sim.carry.held){
  sim.carry.held=false;
  sim.carry.fallT=0;
  sim.carry.depthM=0.0;
  sim.carry.anchorX = sim.carry.xPool;
 }

 sim.len += 1;
 sim.s = 0;
 sim.action=null;
 sim.turnT=0;
 if(sim.len>D.nbLongueurs){
  sim.running=false; sim.finished=true;
  onState();
 }
}

function baseDepthRule(distanceFromStart){
 if(distanceFromStart < 3) return 0.7;
 if(distanceFromStart < 5) return 0.7 * (1 - (distanceFromStart-3)/2);
 return 0.0;
}


function swimmerState(dt){
 const v=2.5;
 if(sim.action){
  const a=sim.action;
  a.t += dt;

  if(a.type==='apnee'){
   const seg=a.total;
   const segV=2.0;
   sim.s += Math.min(v, segV) * dt;
   const start=a.pos, end=a.pos + seg;
   if(sim.s < start) sim.s = start;
   if(sim.s > end) sim.s = end;
   if(sim.s >= end-0.01){ a.o._done=true; sim.action=null; }
  }else if(a.type==='tapis'){
   const crawlV=1.2;
   if(sim.s < a.start) sim.s = a.start;
   sim.s += crawlV*dt;
   if(sim.s > a.end) sim.s = a.end;
   if(sim.s >= a.end-0.01){ a.o._done=true; sim.action=null; }
  }else{
   // lock x at obstacle during vertical work / pickup (no teleport)
   if(!(a.type==='mannequin' && a.phase==='tow')){
    const p=Math.min(1, a.t/1.0);
    let off=0;
    if(a.phase==='down') off = -0.45*(1-p);
    else if(a.phase==='up') off = 0.15*p;
    sim.s = a.pos + off;
   }

   if(a.type==='cerceau'){
    if(a.phase==='down' && a.t>=1){ a.phase='up'; a.t=0; }
    else if(a.phase==='up' && a.t>=1){ a.o._done=true; sim.action=null; }
   }else if(a.type==='objet'){
    // objet lesté : pris au fond, remonte collé au nageur, puis relâché en surface et retombe lentement
    if(a.phase==='down' && a.t>=1){
     a.o._taken=true;
     sim.carry={type:'objet', xPool:a.xPool, yM:a.o.yM, depthM:DEPTH, fallT:0, held:true, anchorX:a.xPool};
     a.phase='up'; a.t=0;
    }else if(a.phase==='up'){
     const p=Math.min(1,a.t/1.0);
     if(sim.carry && sim.carry.type==='objet' && sim.carry.held){
      sim.carry.depthM = DEPTH*(1-p);
     }
     if(a.t>=1){
      if(sim.carry && sim.carry.type==='objet'){ sim.carry.depthM=0.0; }
      a.phase='hold'; a.t=0;
     }
    }else if(a.phase==='hold' && a.t>=0.6){
     if(sim.carry && sim.carry.type==='objet'){
      sim.carry.held=false; sim.carry.fallT=0; sim.carry.depthM=0.0; sim.carry.xPool = sim.carry.anchorX;
     }
     a.o._done=true; sim.action=null;
    }
   }else if(a.type==='mannequin'){
    if(a.phase==='down' && a.t>=1){
     a.o._taken=true;
     sim.carry={type:'mannequin', xPool:a.xPool, yM:a.o.yM, depthM:DEPTH, fallT:0, held:true, anchorX:a.xPool};
     a.phase='up'; a.t=0;
    }else if(a.phase==='up'){
     const p=Math.min(1,a.t/1.0);
     if(sim.carry && sim.carry.type==='mannequin' && sim.carry.held){
      sim.carry.depthM = DEPTH*(1-p);
     }
     if(a.t>=1){
      if(sim.carry && sim.carry.type==='mannequin' && sim.carry.held){ sim.carry.depthM=0.0; }
      a.phase='tow'; a.t=0;
     }
    }else if(a.phase==='tow'){
     const towV=1.7;
     sim.s += towV*dt;
     const swimmerX = getXPool(sim.len, sim.s);
     const behind = (sim.len%2===1) ? -0.6 : 0.6;

     if(sim.carry && sim.carry.type==='mannequin'){
      sim.carry.xPool = swimmerX + behind;
      sim.carry.anchorX = sim.carry.xPool;
     }

     // si le remorquage dépasse la fin de longueur, terminer à la bordure (évite un blocage)
     if(sim.s >= POOL_LEN-0.001){
      if(sim.carry && sim.carry.type==='mannequin'){
       sim.carry.held=false; sim.carry.fallT=0; sim.carry.depthM=0.0; sim.carry.xPool = sim.carry.anchorX;
      }
      a.o._done=true; sim.action=null;
     }else if(sim.s - a.pos >= a.rem){
      if(sim.carry && sim.carry.type==='mannequin'){
       sim.carry.held=false; sim.carry.fallT=0; sim.carry.depthM=0.0; sim.carry.xPool = sim.carry.anchorX;
      }
      a.o._done=true; sim.action=null;
     }
     if(sim.s>POOL_LEN) sim.s=POOL_LEN;
    }
   }
  }
 }else{
  sim.s += v*dt;
 }

 sim.turnT += dt;

 // chute de l'objet/mannequin après lâcher
 if(sim.carry && !sim.carry.held){
  sim.carry.fallT += dt;
  const prog=Math.min(1, sim.carry.fallT/3.0);
  sim.carry.depthM = prog*DEPTH;
  if(sim.carry.type==='objet' || sim.carry.type==='mannequin'){ sim.carry.xPool = sim.carry.anchorX; }
  // une fois retombé au fond, ne plus afficher l'objet/mannequin
  if(prog>=1){ sim.carry=null; }
 }

 // déclenchement d'obstacles
 if(sim.running && !sim.action){
  const o=obstacleNearCurrent();
  if(o) beginAction(o);
 }

 // fin de longueur
 if(sim.s >= POOL_LEN-0.001 && !sim.action){
  finishLength();
 }
}


function swimmerPose(){
 const len=sim.len;
 const goingRight = (len%2===1);
 const xPool = getXPool(len, sim.s);

 const yStart = goingRight ? 1.9 : 0.6;
 const yPrev  = goingRight ? 0.6 : 1.9;
 let yM=yStart;
 if(sim.s < 2.0 && len>1){
  const k=Math.min(1, sim.s/2.0);
  yM = yPrev + (yStart-yPrev)*k;
 }

 let depthM = baseDepthRule(sim.s);
 let mode='swim';

 if(sim.action){
  const a=sim.action;
  if(a.type==='apnee'){
   mode='under';
   const start=a.pos, end=a.pos+a.total;
   const u=(sim.s-start)/(end-start||1);
   const target=1.0;
   let d;
   if(u<0.25) d=target*(u/0.25);
   else if(u<0.75) d=target;
   else d=target*(1-(u-0.75)/0.25);
   depthM = Math.max(depthM, d);
  }else if(a.type==='tapis'){
   mode='walk';
   depthM = -0.25;
  }else if(a.type==='cerceau'){
   mode='under';
   depthM = (a.phase==='down') ? DEPTH*Math.min(1,a.t/1.0) : DEPTH*(1-Math.min(1,a.t/1.0));
  }else if(a.type==='objet'){
   mode='under';
   if(a.phase==='down') depthM = DEPTH*Math.min(1,a.t/1.0);
   else if(a.phase==='up') depthM = DEPTH*(1-Math.min(1,a.t/1.0));
   else depthM = 0.0;
  }else if(a.type==='mannequin'){
   if(a.phase==='down') {mode='under'; depthM=DEPTH*Math.min(1,a.t/1.0);}
   else if(a.phase==='up'){mode='under'; depthM=DEPTH*(1-Math.min(1,a.t/1.0));}
   else {mode='tow'; depthM=0.0;}
  }
 }

 let ethAlpha=1.0;
const mp=maxPassedDist(len);
if(mp>=0 && sim.s > mp + 0.2 && mode==='under'){ ethAlpha = 0.25; }
const fadeStart=24.0;
if(sim.s>fadeStart){ ethAlpha *= Math.max(0, 1 - (sim.s-fadeStart)/(POOL_LEN-fadeStart)); }
return {xPool,yM,depthM,goingRight,mode,ethAlpha};
}

/* ========= Stick swimmer drawing with CRAWL circles ========= */
function drawStick(ctx, x, y, dir, alpha, params){
 const {scale, under, tow, t} = params;

 // proportions (swimmer ≈ 1.70m)
 const trunk=0.48*scale;     // slightly longer torso
 const armL=0.32*scale*0.90;
 const legL=0.34*scale;
 const headR=0.12*scale;

 const hipX = x - dir*trunk*0.18;
 const hipY = y + trunk*0.08;
 const shX  = x + dir*trunk*0.10;
 const shY  = y - trunk*0.06;

 const cyc = (t*2.0) % (Math.PI*2);
 const walk = params.walk===true;
 // bigger kick only in normal crawl
 const kickAmp = (!under && !tow && !walk) ? 1.55 : 0.45;
 const kick = Math.sin(cyc*2.0)*kickAmp;
 const snake = params.snake===true;
 const tilt = params.tilt || 0;

 let hand1=null, hand2=null, foot1=null, foot2=null;

 ctx.save();
 ctx.globalAlpha = alpha;

 // tilt whole body around its center (used for head-down dive)
 if(tilt){
  ctx.translate(x,y);
  ctx.rotate(tilt);
  ctx.translate(-x,-y);
 }

 ctx.lineCap='round';
 ctx.lineWidth=Math.max(2, scale*0.06);
 ctx.strokeStyle='rgba(25,25,25,0.98)';

 // trunk
 ctx.beginPath();
 if(snake){
  const midX=(hipX+shX)/2;
  const midY=(hipY+shY)/2 + Math.sin(cyc*2.2)*0.12*scale;
  ctx.moveTo(hipX,hipY);
  ctx.quadraticCurveTo(midX,midY,shX,shY);
 }else{
  ctx.moveTo(hipX,hipY);
  ctx.lineTo(shX,shY);
 }
 ctx.stroke();

 // green swim briefs
 ctx.fillStyle='rgba(40,180,80,0.95)';
 ctx.beginPath();
 const bx1 = hipX - dir*trunk*0.08, by1 = hipY - trunk*0.02;
 const bx2 = hipX + dir*trunk*0.20, by2 = hipY - trunk*0.11;
 const bx3 = hipX + dir*trunk*0.18, by3 = hipY + trunk*0.18;
 const bx4 = hipX - dir*trunk*0.10, by4 = hipY + trunk*0.12;
 ctx.moveTo(bx1,by1); ctx.lineTo(bx2,by2); ctx.lineTo(bx3,by3); ctx.lineTo(bx4,by4);
 ctx.closePath(); ctx.fill();



 // head
 ctx.fillStyle='rgba(220,60,60,0.95)';
 ctx.beginPath();
 ctx.arc(x + dir*(trunk*0.35), y - trunk*0.10, headR, 0, Math.PI*2);
 ctx.fill();

 // arms
 ctx.strokeStyle='rgba(25,25,25,0.98)';
 if(under){
  // arms forward fixed (underwater / dive)
  const armLen = armL*1.15;
  const a1x = shX + dir*armLen, a1y = shY;
  const a2x = shX + dir*armLen, a2y = shY + armL*0.15;
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a1x,a1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a2x,a2y); ctx.stroke();
  hand1={x:a1x,y:a1y}; hand2={x:a2x,y:a2y};

 }else if(walk){
  // marcher sur le tapis : bras et jambes alternés
  const step = Math.sin(cyc*2.0);
  const armSwing = step*0.35*armL;
  const legSwing = -step*0.30*legL;

  const a1x = shX + dir*armL*0.90, a1y = shY + armSwing;
  const a2x = shX + dir*armL*0.90, a2y = shY - armSwing;
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a1x,a1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a2x,a2y); ctx.stroke();
  hand1={x:a1x,y:a1y}; hand2={x:a2x,y:a2y};

  const f1x = hipX - dir*legL*0.45, f1y = hipY + legL + legSwing;
  const f2x = hipX - dir*legL*0.45, f2y = hipY + legL - legSwing;
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f1x,f1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f2x,f2y); ctx.stroke();
  foot1={x:f1x,y:f1y}; foot2={x:f2x,y:f2y};

 }else if(tow){
  // forward holding (towing mannequin)
  const armLen = armL*1.15;
  const a1x = shX + dir*armLen, a1y = shY - armL*0.10;
  const a2x = shX + dir*armLen, a2y = shY + armL*0.10;
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a1x,a1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a2x,a2y); ctx.stroke();
  hand1={x:a1x,y:a1y}; hand2={x:a2x,y:a2y};

 }else if(snake){
  // tapis: ramper (ondulations)
  const und = Math.sin(cyc*2.6)*0.22*armL;
  const armLen = armL*1.15;
  const a1x = shX + dir*armLen, a1y = shY + und;
  const a2x = shX + dir*armLen, a2y = shY - und;
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a1x,a1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(a2x,a2y); ctx.stroke();
  hand1={x:a1x,y:a1y}; hand2={x:a2x,y:a2y};

  const f1x = hipX - dir*legL*1.00, f1y = hipY + und;
  const f2x = hipX - dir*legL*1.00, f2y = hipY - und;
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f1x,f1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f2x,f2y); ctx.stroke();
  foot1={x:f1x,y:f1y}; foot2={x:f2x,y:f2y};

 }else{
  // crawl: circular path but fixed arm length (underwater arm = overwater arm)
  const p1 = (cyc + Math.PI*0.00)%(Math.PI*2);
  const p2 = (cyc + Math.PI)%(Math.PI*2);
  const cx = shX + dir*armL*0.10;
  const cy = shY - armL*0.35;
  const r  = armL*0.95;

  const target1 = {hx: cx + dir*(r*Math.cos(p1)), hy: cy + r*Math.sin(p1)};
  const target2 = {hx: cx + dir*(r*Math.cos(p2)), hy: cy + r*Math.sin(p2)};

  const armLen = armL*1.15;
  function fixedHand(target){
   const vx = target.hx - shX;
   const vy = target.hy - shY;
   const d = Math.hypot(vx,vy) || 1;
   return {hx: shX + vx/d*armLen, hy: shY + vy/d*armLen};
  }
  const h1 = fixedHand(target1);
  const h2 = fixedHand(target2);

  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(h1.hx,h1.hy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(h2.hx,h2.hy); ctx.stroke();
  hand1={x:h1.hx,y:h1.hy}; hand2={x:h2.hx,y:h2.hy};
 }

 // legs
 if(under && !tow){
  // legs more streamlined underwater
  const und = Math.sin(cyc*2.6)*0.20*armL;
  const f1x = hipX - dir*legL*1.00, f1y = hipY + und;
  const f2x = hipX - dir*legL*1.00, f2y = hipY - und;
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f1x,f1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f2x,f2y); ctx.stroke();
  foot1={x:f1x,y:f1y}; foot2={x:f2x,y:f2y};

 }else if(walk){
  // already drawn in walk branch
 }else if(snake){
  // already drawn in snake branch
 }else{
  const f1x = hipX - dir*legL*1.05, f1y = hipY + legL*0.32*kick;
  const f2x = hipX - dir*legL*1.05, f2y = hipY - legL*0.32*kick;
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f1x,f1y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(f2x,f2y); ctx.stroke();
  foot1={x:f1x,y:f1y}; foot2={x:f2x,y:f2y};
 }

 // simple hands / feet
 ctx.fillStyle='rgba(25,25,25,0.98)';
 const rHand = Math.max(2.2, scale*0.045);
 const rFoot = Math.max(2.4, scale*0.050);

 if(hand1){ ctx.beginPath(); ctx.arc(hand1.x,hand1.y,rHand,0,Math.PI*2); ctx.fill(); }
 if(hand2){ ctx.beginPath(); ctx.arc(hand2.x,hand2.y,rHand,0,Math.PI*2); ctx.fill(); }
 if(foot1){ ctx.beginPath(); ctx.arc(foot1.x,foot1.y,rFoot,0,Math.PI*2); ctx.fill(); }
 if(foot2){ ctx.beginPath(); ctx.arc(foot2.x,foot2.y,rFoot,0,Math.PI*2); ctx.fill(); }

 ctx.restore();
}

function drawSwimmerTop(top, st, t){
 const {W,H,pad}=top;
 const x=m2x(st.xPool,W,pad,POOL_LEN);
 const y=m2y(st.yM,H,pad,LANE_W);
 const scale=(W-2*pad)/POOL_LEN;
 const swimScale=scale*1.33;

 const under = st.depthM>0.12 && st.mode!=='tow';
 const tow = (st.mode==='tow');
 
 let tilt = 0;
 if(sim.action && (sim.action.type==='objet' || sim.action.type==='mannequin') && sim.action.phase==='down') tilt = 0.95;
let alpha = under ? 0.25 : 1.0; alpha = Math.min(alpha, st.ethAlpha||1.0);

 drawStick(ctxT, x, y, st.goingRight?1:-1, alpha, {scale:swimScale, under, tow, t, snake: false, walk: (st.mode==='walk'), tilt: tilt});

 // mannequin / objet
 if(sim.carry && sim.carry.type==='mannequin' && sim.carry.held){
  const dir = st.goingRight ? 1 : -1;
  const towMode = (st.mode==='tow');
  const scale=(W-2*pad)/POOL_LEN;
  const bodyL=clamp(0.8*scale, 8, 20);     // ~80cm max
  const bodyH=clamp(0.24*scale, 5, 10);

  // porté sur le nageur (comme la vue de côté) : tête au-dessus du corps, sur le nageur
  const headX = x + dir*6;
  const headY = y - bodyH*1.05;

  ctxT.save();
  ctxT.globalAlpha = 0.95;
  ctxT.translate(headX, headY);
  if(dir < 0) ctxT.scale(-1, 1);
  const ang = towMode ? 0.22 : 0.30;
  ctxT.rotate(ang);

  ctxT.fillStyle='#ffeb3b';
  ctxT.fillRect(-bodyL, -bodyH*0.20, bodyL, bodyH);

  ctxT.beginPath();
  ctxT.arc(0, -bodyH*0.82, Math.max(3.2, bodyH*0.45), 0, Math.PI*2);
  ctxT.fill();

  ctxT.restore();
 }

 if(sim.carry && sim.carry.type==='objet' && sim.carry.held){
  // objet lesté collé au nageur pendant la remontée
  const dir = st.goingRight ? 1 : -1;
  const ox = x + dir*12;
  const oy = y + (st.depthM>0.12 ? 6 : -16);
  ctxT.save();
  ctxT.globalAlpha = sim.carry.held ? 1.0 : 0.7;
  ctxT.fillStyle='#424242';
  ctxT.fillRect(ox-4,oy-1.2,8,2.4);
  ctxT.fillRect(ox-6.8,oy-4.2,2.6,8.4);
  ctxT.fillRect(ox+4.2,oy-4.2,2.6,8.4);
  ctxT.restore();
 }
}

function drawSwimmerSide(side, st, t){
 const {W,H,pad,surfaceY,bottomY}=side;
 const yAt=(m)=> surfaceY + (m/DEPTH)*(bottomY-surfaceY);
 const x=m2x(st.xPool,W,pad,POOL_LEN);
 const y=yAt(st.depthM);
 const scale=(W-2*pad)/POOL_LEN;
 const swimScale=scale*1.33;

 const under = st.depthM>0.12 && st.mode!=='tow';
 const tow = (st.mode==='tow');

 
 let tilt = 0;
 if(sim.action && (sim.action.type==='objet' || sim.action.type==='mannequin') && sim.action.phase==='down') tilt = 0.95;
drawStick(ctxS, x, y, st.goingRight?1:-1, 1.0, {scale:swimScale, under, tow, t, snake: false, walk: (st.mode==='walk'), tilt: tilt});

 if(sim.carry && sim.carry.type==='mannequin' && sim.carry.held){
  const dir = st.goingRight ? 1 : -1;
  const towMode = (st.mode==='tow');
  const scale=(W-2*pad)/POOL_LEN;
  const bodyL=clamp(0.8*scale, 8, 20);     // ~80cm max
  const bodyH=clamp(0.24*scale, 5, 10);

  // porté sur le nageur : tête proche de la tête du nageur, en surface si remorquage
  const headX = x + dir*6;
  const headY = towMode ? (surfaceY + 2) : (y - bodyH*1.05);

  ctxS.save();
  ctxS.globalAlpha = 0.95;
  ctxS.translate(headX, headY);
  if(dir < 0) ctxS.scale(-1, 1);
  const ang = towMode ? 0.22 : 0.30;
  ctxS.rotate(ang);

  ctxS.fillStyle='#ffeb3b';
  // corps sur le nageur (pas dessous)
  ctxS.fillRect(-bodyL, -bodyH*0.20, bodyL, bodyH);

  // tête vers le haut (surface)
  ctxS.beginPath();
  ctxS.arc(0, -bodyH*0.82, Math.max(3.5, bodyH*0.45), 0, Math.PI*2);
  ctxS.fill();

  ctxS.restore();
 }

if(sim.carry && sim.carry.type==='objet' && sim.carry.held){
  const ox = x + (st.goingRight?1:-1)*14;
  const oy = yAt(sim.carry.depthM) - 10;
  ctxS.fillStyle='#424242';
  ctxS.fillRect(ox-4,oy+1,8,3);
  ctxS.fillRect(ox-6.8,oy-3,2.6,11);
  ctxS.fillRect(ox+4.2,oy-3,2.6,11);
 }
}

/* ========= Loop ========= */

function drawDetachedCarryTop(top){
 if(!sim.carry || sim.carry.held) return;
 const {W,H,pad}=top;
 const x=m2x(sim.carry.xPool,W,pad,POOL_LEN);
 const y=m2y(sim.carry.yM,H,pad,LANE_W);

 if(sim.carry.type==='objet'){
  ctxT.save();
  ctxT.globalAlpha=0.85;
  ctxT.fillStyle='#424242';
  ctxT.fillRect(x-4,y-1.2,8,2.4);
  ctxT.fillRect(x-6.8,y-4.2,2.6,8.4);
  ctxT.fillRect(x+4.2,y-4.2,2.6,8.4);
  ctxT.restore();
 }else if(sim.carry.type==='mannequin'){
  const scale=(W-2*pad)/POOL_LEN;
  const bw=clamp(0.8*scale, 8, 20);
  const bh=clamp(0.24*scale, 5, 10);
  ctxT.save();
  ctxT.globalAlpha=0.85;
  ctxT.fillStyle='#ffeb3b';
  ctxT.fillRect(x-bw/2,y-bh/2,bw,bh);
  ctxT.beginPath();
  ctxT.arc(x, y-bh/2- Math.max(4, bh*0.55), Math.max(4, bh*0.55), 0, Math.PI*2);
  ctxT.fill();
  ctxT.restore();
 }
}

function drawDetachedCarrySide(side){
 if(!sim.carry || sim.carry.held) return;
 const {W,H,pad,surfaceY,bottomY}=side;
 const yAt=(m)=> surfaceY + (m/DEPTH)*(bottomY-surfaceY);
 const x=m2x(sim.carry.xPool,W,pad,POOL_LEN);
 const y=yAt(sim.carry.depthM);

 if(sim.carry.type==='objet'){
  ctxS.save();
  ctxS.globalAlpha=0.85;
  ctxS.fillStyle='#424242';
  ctxS.fillRect(x-5,y+1,10,3);
  ctxS.fillRect(x-8,y-3,3,11);
  ctxS.fillRect(x+5,y-3,3,11);
  ctxS.restore();
 }else if(sim.carry.type==='mannequin'){
  const scale=(W-2*pad)/POOL_LEN;
  const bw=clamp(0.8*scale, 8, 20);
  const bh=clamp(0.24*scale, 5, 10);
  ctxS.save();
  ctxS.globalAlpha=0.85;
  ctxS.fillStyle='#ffeb3b';
  ctxS.fillRect(x-bw/2,y-bh/2,bw,bh);
  // tête vers le haut (surface)
  const r = Math.max(4, bh*0.55);
  const headY = Math.max(surfaceY - r - 2, y - bh/2 - r - 2);
  ctxS.beginPath(); ctxS.arc(x, headY, r, 0, Math.PI*2); ctxS.fill();
  ctxS.restore();
 }
}
function drawAll(){
 if(!active || !ctxT) return;
 const top=drawLaneTop();
 const side=drawLaneSide();
 drawObstaclesTop(top);
 drawObstaclesSide(side);
 drawDetachedCarryTop(top);
 drawDetachedCarrySide(side);
 const t=sim.time;
 const st=swimmerPose();
 drawSwimmerTop(top, st, t);
 drawSwimmerSide(side, st, t);
 onFrame();
}

function loop(now){
 if(!sim.running || sim.paused || !active){ rafId=null; return; }
 let dt=Math.min(0.1, (now - sim.last)/1000) * speed;
 sim.last=now;
 // sous-pas pour garder une simulation stable en accéléré
 while(dt>0 && sim.running){
  const step=Math.min(0.05, dt);
  sim.time += step;
  swimmerState(step);
  dt -= step;
 }
 drawAll();
 if(sim.running) rafId=requestAnimationFrame(loop);
 else { rafId=null; onState(); }
}

/* ========= API ========= */
function resizeCanvases(){
 if(!cvTop) return;
 const dpr=window.devicePixelRatio||1;
 [[cvTop,ctxT],[cvSide,ctxS]].forEach(([c,ctx])=>{
  const r=c.getBoundingClientRect();
  c.width=Math.max(320, Math.floor(r.width*dpr));
  c.height=Math.max(140, Math.floor(r.height*dpr));
  c._dpr = c.width / Math.max(1, r.width) || dpr;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(c._dpr, c._dpr);
 });
}
function load(parcours){
 const n=Math.max(1, parcours.n||1);
 const obs={};
 for(let i=1;i<=n;i++){
  obs[i]=(parcours.obstacles[i-1]||[]).map(o=>Object.assign({}, o, {_done:false,_taken:false}))
   .sort((a,b)=>a.dist-b.dist);
 }
 D={nbLongueurs:n, obstacles:obs};
 reset();
}
function reset(){
 if(rafId) cancelAnimationFrame(rafId); rafId=null;
 sim.running=false; sim.paused=false; sim.finished=false; sim.time=0;
 sim.len=1; sim.s=0; sim.action=null; sim.carry=null; sim.turnT=0;
 initStatuses();
 onState();
 drawAll();
}
function play(){
 if(sim.finished) reset();
 if(sim.running && !sim.paused) return;
 if(!sim.running){ sim.running=true; }
 sim.paused=false;
 sim.last=performance.now();
 onState();
 if(!rafId) rafId=requestAnimationFrame(loop);
}
function pause(){
 if(!sim.running) return;
 sim.paused=true;
 onState();
}
function toggle(){ (sim.running && !sim.paused) ? pause() : play(); }
function getStatus(){
 const n=D.nbLongueurs;
 const len=Math.min(sim.len, n);
 const pair=Math.floor((len-1)/2)+1;
 return {
  state: sim.finished ? 'done' : (!sim.running ? 'ready' : (sim.paused ? 'paused' : 'running')),
  len, n, pair, dir: (len%2===1)?'Aller':'Retour',
  meters: sim.finished ? 25 : Math.max(0, Math.min(25, sim.s)),
  action: sim.action ? sim.action.type : null,
  progress: sim.finished ? 1 : ((len-1) + Math.max(0,Math.min(25,sim.s))/25)/n
 };
}
function attach(top, side){
 cvTop=top; cvSide=side; ctxT=top.getContext('2d'); ctxS=side.getContext('2d');
}
function setActive(on){
 active=!!on;
 if(active){ resizeCanvases(); drawAll(); if(sim.running && !sim.paused && !rafId){ sim.last=performance.now(); rafId=requestAnimationFrame(loop);} }
 else if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
}
function setSpeed(v){ speed=Math.max(0.25, Math.min(8, Number(v)||1)); }
function on(evt, fn){ listeners[evt]=fn; }
window.addEventListener('resize', ()=>{ if(active){ resizeCanvases(); drawAll(); } });

return {attach, load, reset, play, pause, toggle, setActive, setSpeed, on, getStatus, redraw:()=>{ if(active){ resizeCanvases(); drawAll(); } }};
})();
