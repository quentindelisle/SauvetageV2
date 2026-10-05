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

/* ========= Simulation =========
   s     : position du centre du nageur le long de la longueur (0 → 25 m)
   depth : profondeur du centre du corps (m, + vers le fond, − hors de l'eau)
   Toutes les transitions sont continues (pas de téléportation) ;
   l'inclinaison du corps est déduite de la trajectoire. */
const sim={running:false,paused:false,finished:false,time:0,last:0,len:1,s:0,action:null,carry:null,turnT:0,
  depth:0, turn:null, vs:0, vd:0, pitch:0, roll:1, flip:0, stroke:0, kick:0, yM:1.9, yaw:0, mode:'block', _jump:false, _drawT:0};

const SPEED={swim:2.3, under:1.7, tow:1.35, mat:1.0};
const WALL=POOL_LEN-0.9;        // centre du corps quand la tête/main touche le mur
const ease=(u)=>{ u=clamp(u,0,1); return u*u*(3-2*u); };
const lerp=(a,b,u)=>a+(b-a)*u;
const laneY=(len)=>(len%2===1)?1.9:0.6;
const HOOP_D=DEPTH-0.42;         // passage au centre du cerceau lesté
const FLOOR_D=DEPTH-0.22;        // nageur au fond (ramassage)

function initStatuses(){
 for(let i=1;i<=D.nbLongueurs;i++) (D.obstacles[i]||[]).forEach(o=>{ o._done=false; o._taken=false; });
 Object.assign(sim,{s:-0.55, depth:-0.5, turn:null, vs:0, vd:0, pitch:0.35, roll:1, flip:0, stroke:0, kick:0,
   yM:laneY(1), yaw:0, mode:'block', _jump:false});
}

/* profondeur « naturelle » : plongeon au départ, coulée après chaque virage */
function pushDepth(s, first){
 if(first){
  if(s<2.4) return lerp(-0.5, 0.6, ease((s+0.55)/2.95));
  return 0.6*(1-ease((s-2.4)/4));
 }
 return 0.55*(1-ease((s-0.9)/4.5));
}

function leadFor(o){
 if(o.type==='cerceau') return 3.0;
 if(o.type==='objet' || o.type==='mannequin') return 2.6;
 if(o.type==='tapis') return 1.5+0.5;
 return 0;
}
function obstacleNearCurrent(){
 const list=D.obstacles[sim.len]||[];
 for(const o of list){
  if(o._done) continue;
  return (sim.s >= o.dist - leadFor(o) - 1e-3) ? o : null;
 }
 return null;
}

function beginAction(o){
 const a={type:o.type, o, pos:o.dist, t:0, s0:sim.s, d0:sim.depth};
 if(o.type==='cerceau'){ a.end=Math.min(WALL, Math.max(o.dist+2.6, sim.s+1.2)); }
 else if(o.type==='apnee'){ a.start=Math.max(o.dist, sim.s); a.end=Math.min(WALL, o.dist+Math.max(1,o.depl||10)); if(a.end<=a.start+0.3){ o._done=true; return; } }
 else if(o.type==='objet' || o.type==='mannequin'){
  a.phase='down'; a.target=Math.min(WALL-1, Math.max(o.dist, sim.s+0.6)); a.xPool=getXPool(sim.len, o.dist);
  a.rem=Math.max(0, o.remorque||0);
 }
 else if(o.type==='tapis'){ a.start=Math.max(0,o.dist-1.5); a.end=Math.min(POOL_LEN-0.3, o.dist+1.5); if(sim.s>=a.end){ o._done=true; return; } }
 sim.action=a;
}

function endAction(){ if(sim.action){ sim.action.o._done=true; } sim.action=null; }
function releaseCarry(){
 if(sim.carry && sim.carry.held){
  sim.carry.held=false; sim.carry.fallT=0;
  sim.carry.xPool=getXPool(sim.len, sim.s+0.5); sim.carry.anchorX=sim.carry.xPool;
  sim.carry.yM=sim.yM; sim.carry.depthM=Math.max(0, sim.depth);
 }
}

function stepSwim(dt){
 const first=(sim.len===1);
 let v=SPEED.swim + (sim.s<5 ? 0.9*(1-Math.max(0,sim.s)/5) : 0);
 if(first && sim.s<2.4) v=3.6;
 sim.s=Math.min(WALL, sim.s+v*dt);
 const target=pushDepth(sim.s, first);
 sim.depth = (first && sim.s<2.4) ? target : lerp(sim.depth, target, 1-Math.exp(-dt*7));
 sim.mode = sim.depth>0.18 ? 'glide' : (sim.depth<-0.1 ? 'dive' : 'crawl');
}

function stepAction(dt){
 const a=sim.action; a.t+=dt;
 if(a.type==='cerceau'){
  sim.s += SPEED.under*dt;
  const L=Math.max(0.5, a.end-a.s0), u=clamp((sim.s-a.s0)/L,0,1);
  const uh=clamp((a.pos-a.s0)/L, 0.3, 0.75);
  sim.depth = u<uh ? lerp(a.d0, HOOP_D, ease(u/uh)) : lerp(HOOP_D, 0.05, ease((u-uh)/(1-uh)));
  sim.mode='under';
  if(u>=1) endAction();
 }else if(a.type==='apnee'){
  sim.s += SPEED.under*dt;
  const L=a.end-a.start, x=sim.s-a.start, r=Math.min(1.6, L/3), deep=1.0;
  sim.depth = x<r ? lerp(a.d0, deep, ease(x/r)) : (x>L-r ? lerp(deep, 0.05, ease((x-(L-r))/r)) : deep);
  sim.mode='under';
  if(sim.s>=a.end){ sim.s=a.end; endAction(); }
 }else if(a.type==='objet' || a.type==='mannequin'){
  if(a.phase==='down'){
   const p=clamp(a.t/1.8,0,1);
   sim.s=lerp(a.s0, a.target, ease(p)); sim.depth=lerp(a.d0, FLOOR_D, ease(p)); sim.mode='under';
   if(p>=1){
    a.phase='grab'; a.t=0; a.o._taken=true;
    sim.carry={type:a.type, xPool:a.xPool, yM:sim.yM, depthM:DEPTH-0.1, fallT:0, held:true, anchorX:a.xPool};
   }
  }else if(a.phase==='grab'){
   sim.mode='grab';
   if(a.t>=0.4){ a.phase='up'; a.t=0; }
  }else if(a.phase==='up'){
   const p=clamp(a.t/1.8,0,1);
   sim.s=lerp(a.target, a.target+1.8, ease(p)); sim.depth=lerp(FLOOR_D, a.type==='mannequin'?0.08:0.0, ease(p)); sim.mode='carryUp';
   if(p>=1){ a.phase = (a.type==='objet') ? 'hold' : 'tow'; a.t=0; a.towFrom=sim.s; }
  }else if(a.phase==='hold'){
   sim.s=Math.min(WALL, sim.s+0.4*dt); sim.mode='hold';
   if(a.t>=0.9){ releaseCarry(); endAction(); }
  }else if(a.phase==='tow'){
   sim.s=Math.min(WALL, sim.s+SPEED.tow*dt); sim.depth=lerp(sim.depth,0.08,1-Math.exp(-dt*5)); sim.mode='tow';
   if(sim.s - a.towFrom >= Math.max(0.5, a.rem - (a.towFrom-a.pos)) || sim.s>=WALL){ releaseCarry(); endAction(); }
  }
  if(sim.carry && sim.carry.held){ sim.carry.xPool=getXPool(sim.len, sim.s); sim.carry.depthM=sim.depth; sim.carry.yM=sim.yM; }
 }else if(a.type==='tapis'){
  if(sim.s < a.start){ stepSwim(dt); return; }
  sim.s += SPEED.mat*dt;
  const x=sim.s-a.start;
  sim.depth = lerp(sim.depth, -0.2, 1-Math.exp(-dt*9)); sim.mode = x<0.4 ? 'climb' : 'mat';
  if(sim.s>=a.end){ endAction(); }
 }
}

function startTurn(){
 if(sim.len>=D.nbLongueurs){ // arrivée : touche du mur
  sim.s=WALL; sim.running=false; sim.finished=true; sim.mode='crawl'; return;
 }
 sim.turn={t:0, dur:0.9, s0:sim.s, d0:sim.depth};
}
function stepTurn(dt){
 const T=sim.turn; T.t+=dt;
 const u=clamp(T.t/T.dur,0,1);
 sim.s=lerp(T.s0, WALL+0.2, ease(u)); sim.depth=lerp(T.d0, 0.45, ease(u));
 sim.flip=ease(u); sim.mode='turn';
 if(u>=1){
  sim.turn=null; sim.flip=0; sim.len++; sim.s=0.9; sim.roll=-1; sim.pitch=0; sim._jump=true; sim.mode='glide';
 }
}

function swimmerState(dt){
 const s0=sim.s, d0=sim.depth;
 if(sim.turn) stepTurn(dt);
 else if(sim.action) stepAction(dt);
 else stepSwim(dt);

 // objet/mannequin relâché : il redescend au fond puis disparaît
 if(sim.carry && !sim.carry.held){
  sim.carry.fallT += dt;
  const prog=Math.min(1, sim.carry.fallT/3.0);
  sim.carry.depthM = lerp(sim.carry.depthM, DEPTH-0.1, Math.min(1, dt*1.2));
  if(prog>=1) sim.carry=null;
 }

 if(sim.running && !sim.action && !sim.turn){ const o=obstacleNearCurrent(); if(o) beginAction(o); }
 if(sim.running && !sim.action && !sim.turn && sim.s>=WALL-1e-3) startTurn();

 // couloir : changement de côté progressif après le virage
 const ty=laneY(sim.len);
 sim.yM = lerp(sim.yM, ty, 1-Math.exp(-dt*(sim.s<4?1.6:3)));

 // vitesses lissées (inclinaison du corps)
 if(dt>0 && !sim._jump){
  const k=1-Math.exp(-dt*9);
  sim.vs=lerp(sim.vs,(sim.s-s0)/dt,k); sim.vd=lerp(sim.vd,(sim.depth-d0)/dt,k);
 }
 sim._jump=false;

 // rotation sur le dos après la culbute, puis retour ventral ; sur le dos pour le remorquage
 const rollT = sim.mode==='tow' ? -1 : 1;
 const rate = (sim.len>1 && sim.s<2.6 && sim.mode!=='tow') ? 2.2 : 4;
 sim.roll = lerp(sim.roll, rollT, 1-Math.exp(-dt*rate));

 // rythmes de nage
 const strokeHz = {crawl:0.8, mat:0.9, climb:0.9, hold:0.6, carryUp:0.6, grab:0.5, tow:0.55, glide:0, under:0, dive:0, turn:0, block:0}[sim.mode] ?? 0.8;
 sim.stroke += dt*Math.PI*2*strokeHz;
 const kickHz = {crawl:2.4, glide:1.3, under:1.3, carryUp:1.6, hold:1.8, tow:1.8, mat:1.0, climb:1.0, grab:0.6, turn:0, dive:0, block:0}[sim.mode] ?? 2;
 sim.kick += dt*Math.PI*2*kickHz;
}

function swimmerPose(){
 return {xPool:getXPool(sim.len, sim.s), yM:sim.yM, depthM:sim.depth, goingRight:(sim.len%2===1), mode:sim.mode};
}

/* ========= Dessin du nageur ========= */
const COL={skin:'#f2c29b', skinFar:'#d39a72', cap:'#e53935', capHi:'#ff7b72', suit:'#0d47a1', line:'rgba(40,20,10,.35)',
  manBody:'#ffb300', manDark:'#e08e00', manHead:'#ffd54f', obj:'#37474f'};

function limb(ctx, pts, w, col){
 ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.lineJoin='round';
 ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.stroke();
}
function dot(ctx,x,y,r,col){ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }

/* bras (vue de côté) : angle θ autour de l'épaule — 0 devant, π/2 vers le ventre */
function armSide(ctx, S, th, bend, col){
 const e=[S[0]+0.31*Math.cos(th), S[1]+0.31*Math.sin(th)];
 const th2=th+bend;
 const h=[e[0]+0.3*Math.cos(th2), e[1]+0.3*Math.sin(th2)];
 limb(ctx,[S,e,h],0.095,col); dot(ctx,h[0],h[1],0.055,col);
 return h;
}
function legSide(ctx, H, phi, bend, col){
 const k=[H[0]-0.43*Math.cos(phi), H[1]+0.43*Math.sin(phi)];
 const p2=phi+bend;
 const f=[k[0]-0.42*Math.cos(p2), k[1]+0.42*Math.sin(p2)];
 limb(ctx,[H,k,f],0.13,col);
 // pied
 limb(ctx,[f,[f[0]-0.12*Math.cos(p2+0.5), f[1]+0.12*Math.sin(p2+0.5)]],0.08,col);
}

function drawManikin(ctx, len){ // mannequin couché (local : tête vers +x)
 ctx.fillStyle=COL.manBody; ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=0.025;
 roundRectPath(ctx,-len*0.55,-0.14,len*0.75,0.28,0.12); ctx.fill(); ctx.stroke();
 ctx.fillStyle=COL.manDark; roundRectPath(ctx,-len*0.55,-0.14,len*0.2,0.28,0.1); ctx.fill();
 dot(ctx,len*0.3,0,0.12,COL.manHead); ctx.beginPath(); ctx.arc(len*0.3,0,0.12,0,Math.PI*2); ctx.stroke();
}
function drawObj(ctx){ // haltère / objet lesté (local)
 ctx.fillStyle=COL.obj;
 ctx.fillRect(-0.12,-0.025,0.24,0.05); ctx.fillRect(-0.17,-0.08,0.06,0.16); ctx.fillRect(0.11,-0.08,0.06,0.16);
}

function drawBodySide(ctx, mode, stroke, kick, held){
 const S=[0.5,-0.02], H=[-0.1,0.02];
 const under = (mode==='under'||mode==='glide'||mode==='dive'||mode==='block');
 // ----- membres éloignés (plus sombres) puis proches
 const arms=[], legs=[];
 if(under){
  arms.push([-0.06,0.08],[0.04,0.1]);
  const d=0.16*Math.sin(kick);
  legs.push([d,0.12],[d+0.05,0.12]);
 }else if(mode==='turn'){
  arms.push([1.3,0.4],[1.5,0.4]); legs.push([2.0,-2.4],[2.1,-2.4]);
 }else if(mode==='mat' || mode==='climb'){
  const a=0.25+0.5*Math.sin(stroke);
  arms.push([a,0.6],[0.25+0.5*Math.sin(stroke+Math.PI),0.6]);
  legs.push([0.1*Math.sin(kick),0.35],[0.1*Math.sin(kick+Math.PI),0.35]);
 }else if(mode==='carryUp' || mode==='grab'){
  arms.push([1.0,0.5],[0.9+0.4*Math.sin(stroke),0.4]);
  legs.push([0.22*Math.sin(kick),0.25],[0.22*Math.sin(kick+Math.PI),0.25]);
 }else if(mode==='hold'){
  arms.push([-1.25,0.2],[0.8+0.5*Math.sin(stroke),0.5]);
  legs.push([0.3+0.25*Math.sin(kick),0.5],[0.3+0.25*Math.sin(kick+Math.PI),0.5]);
 }else if(mode==='tow'){
  arms.push([0.9,0.7],[1.6+0.5*Math.sin(stroke),0.5]);
  legs.push([0.22*Math.sin(kick),0.35],[0.22*Math.sin(kick+Math.PI),0.35]);
 }else{ // crawl
  const th=stroke%(Math.PI*2);
  const bendOf=(t)=>{ t=((t%(Math.PI*2))+Math.PI*2)%(Math.PI*2); return t>Math.PI ? -0.9*Math.sin(t-Math.PI) : 0.45*Math.sin(t); };
  arms.push([th, bendOf(th)],[th+Math.PI, bendOf(th+Math.PI)]);
  legs.push([0.2*Math.sin(kick),0.18+0.12*Math.sin(kick+0.8)],[0.2*Math.sin(kick+Math.PI),0.18+0.12*Math.sin(kick+Math.PI+0.8)]);
 }
 armSide(ctx,S,arms[1][0],arms[1][1],COL.skinFar);
 legSide(ctx,H,legs[1][0],legs[1][1],COL.skinFar);
 // tronc
 limb(ctx,[H,S],0.27,COL.skin);
 limb(ctx,[[-0.2,0.03],[0.07,0.01]],0.29,COL.suit);
 // tête + bonnet
 dot(ctx,0.76,-0.03,0.115,COL.skin);
 ctx.fillStyle=COL.cap; ctx.beginPath(); ctx.arc(0.76,-0.03,0.122,Math.PI*0.62,Math.PI*1.9); ctx.closePath(); ctx.fill();
 legSide(ctx,H,legs[0][0],legs[0][1],COL.skin);
 const hand=armSide(ctx,S,arms[0][0],arms[0][1],COL.skin);
 // objet tenu
 if(held==='objet'){ ctx.save(); ctx.translate(hand[0],hand[1]+0.04); drawObj(ctx); ctx.restore(); }
}

function drawBodyTop(ctx, mode, stroke, kick, held, alphaUnder){
 const under = (mode==='under'||mode==='glide'||mode==='dive'||mode==='block');
 const sh=0.21;
 const hands=[];
 if(under || mode==='turn'){
  hands.push({h:[1.2,-0.06],e:[0.85,-0.14],top:true},{h:[1.2,0.06],e:[0.85,0.14],top:true});
 }else if(mode==='mat' || mode==='climb'){
  [0,Math.PI].forEach((ph,i)=>{ const sg=i?1:-1; const r=0.75+0.4*Math.sin(stroke+ph);
   hands.push({h:[r,sg*0.3],e:[0.55+r*0.25,sg*0.36],top:true}); });
 }else if(mode==='tow' || mode==='carryUp' || mode==='grab' || mode==='hold'){
  hands.push({h:[0.85,0.28],e:[0.62,0.34],top:true});
  const r=0.4+0.35*Math.sin(stroke); hands.push({h:[r,-0.42],e:[0.4,-0.36],top:true});
 }else{ // crawl vu de dessus
  [0,Math.PI].forEach((ph,i)=>{
   const sg=i?1:-1; let t=((stroke+ph)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
   if(t<Math.PI){ const u=t/Math.PI; // traction sous le corps
    const x=lerp(1.2,-0.05,ease(u)), y=sg*(0.13+0.07*Math.sin(Math.PI*u));
    hands.push({h:[x,y],e:[lerp(0.9,0.25,u), sg*(0.26+0.06*Math.sin(Math.PI*u))],top:false});
   }else{ const u=(t-Math.PI)/Math.PI; // retour aérien, coude haut
    const x=lerp(-0.05,1.2,ease(u)), y=sg*(0.2+0.2*Math.sin(Math.PI*u));
    hands.push({h:[x,y],e:[lerp(0.2,0.75,u), sg*(0.3+0.22*Math.sin(Math.PI*u))],top:true});
   }
  });
 }
 const drawArm=(a,col)=>{ const s=[0.5, a.h[1]>0?sh:-sh]; limb(ctx,[s,a.e,a.h],0.095,col); dot(ctx,a.h[0],a.h[1],0.055,col); };
 // bras sous l'eau (sous le corps)
 hands.filter(a=>!a.top).forEach(a=>{ ctx.save(); ctx.globalAlpha*=0.55; drawArm(a,COL.skinFar); ctx.restore(); });
 // jambes
 const kk=(mode==='turn')?0:1;
 [-1,1].forEach((sg,i)=>{
  const k=Math.sin(kick+(i?Math.PI:0));
  const fx=(mode==='turn'?-0.45:-0.98)+0.05*k*kk, fy=sg*(0.08+(mode==='tow'||mode==='hold'?0.12*Math.abs(k):0));
  limb(ctx,[[-0.12,sg*0.09],[(-0.12+fx)/2,sg*0.1],[fx,fy]],0.13,COL.skin);
  dot(ctx,fx-0.04,fy,0.06,COL.skin);
 });
 // tronc
 ctx.fillStyle=COL.skin; ctx.beginPath();
 ctx.moveTo(0.58,-sh); ctx.quadraticCurveTo(0.66,0,0.58,sh); ctx.lineTo(-0.16,0.16); ctx.quadraticCurveTo(-0.24,0,-0.16,-0.16); ctx.closePath(); ctx.fill();
 ctx.fillStyle=COL.suit; ctx.beginPath();
 ctx.moveTo(0.06,-0.17); ctx.lineTo(0.06,0.17); ctx.lineTo(-0.16,0.16); ctx.quadraticCurveTo(-0.25,0,-0.16,-0.16); ctx.closePath(); ctx.fill();
 dot(ctx,0.52,-sh,0.075,COL.skin); dot(ctx,0.52,sh,0.075,COL.skin);
 // tête (bonnet)
 dot(ctx,0.76,0,0.12,COL.cap);
 ctx.fillStyle=COL.capHi; ctx.beginPath(); ctx.arc(0.74,-0.03,0.05,0,Math.PI*2); ctx.fill();
 // bras aériens / devant
 hands.filter(a=>a.top).forEach(a=>drawArm(a,COL.skin));
 if(held==='objet'){ const a=hands[0]; ctx.save(); ctx.translate(a.h[0]+0.05,a.h[1]); drawObj(ctx); ctx.restore(); }
}

function wake(ctx, k, t, strong){ // remous derrière les pieds (vue de dessus)
 ctx.save(); ctx.fillStyle='rgba(255,255,255,.55)';
 for(let i=0;i<6;i++){
  const ph=t*7+i*1.7;
  const x=-1.05-i*0.13-0.04*Math.sin(ph), y=0.12*Math.sin(ph*1.3+i);
  ctx.globalAlpha=(strong?0.55:0.3)*(1-i/6);
  dot(ctx,x,y,0.07*(1-i/8),'#fff');
 }
 ctx.restore();
}

function smoothPitch(kx, ky){
 const dtv=Math.max(0, sim.time-sim._drawT); sim._drawT=sim.time;
 // la vue de côté exagère la profondeur : on atténue l'inclinaison pour un rendu naturel
 let target = Math.atan2(sim.vd*ky*0.45, Math.max(0.05, sim.vs)*kx);
 if(sim.mode==='grab') target=0;
 if(sim.mode==='hold'||sim.mode==='tow') target=-0.12;
 if(sim.mode==='block') target=0.35;
 target=clamp(target,-0.7,0.75);
 sim.pitch = dtv>0 ? lerp(sim.pitch, target, 1-Math.exp(-dtv*5)) : sim.pitch;
 return sim.pitch;
}

function drawSwimmerSide(side, st){
 const {W,pad,surfaceY,bottomY}=side;
 const kx=(W-2*pad)/POOL_LEN, ky=(bottomY-surfaceY)/DEPTH;
 const x=m2x(st.xPool,W,pad,POOL_LEN), y=surfaceY+st.depthM*ky;
 const dir=st.goingRight?1:-1;
 const k=kx*1.15;
 const pitch = sim.turn ? sim.flip*Math.PI : smoothPitch(kx,ky);
 const held = sim.carry && sim.carry.held ? sim.carry.type : null;

 // bulles quand le nageur est immergé
 if(st.depthM>0.25){
  ctxS.save();
  for(let i=0;i<4;i++){
   const u=((sim.time*0.9+i*0.27)%1);
   const bx=x+dir*(0.75-0.25*i)*k*0.6, by=y-0.25*k-u*(y-surfaceY-0.25*k);
   ctxS.strokeStyle=`rgba(255,255,255,${0.6*(1-u)})`; ctxS.lineWidth=1.2;
   ctxS.beginPath(); ctxS.arc(bx+Math.sin(u*9+i)*3, by, 2+i*0.6, 0, Math.PI*2); ctxS.stroke();
  }
  ctxS.restore();
 }

 ctxS.save();
 ctxS.translate(x,y); ctxS.scale(dir*k, k); ctxS.rotate(pitch);
 // mannequin sous le bras (remontée) — derrière le nageur
 if(held==='mannequin' && sim.mode!=='tow'){ ctxS.save(); ctxS.translate(0.55,0.3); ctxS.rotate(0.15); drawManikin(ctxS,0.9); ctxS.restore(); }
 ctxS.save(); ctxS.scale(1, sim.roll>=0 ? Math.max(0.5,sim.roll) : Math.min(-0.5,sim.roll));
 ctxS.lineWidth=0.02;
 drawBodySide(ctxS, st.mode, sim.stroke, sim.kick, held);
 ctxS.restore();
 // remorquage : mannequin sur la poitrine, tête hors de l'eau
 if(held==='mannequin' && sim.mode==='tow'){ ctxS.save(); ctxS.translate(0.25,-0.22); ctxS.rotate(-0.08); drawManikin(ctxS,0.95); ctxS.restore(); }
 ctxS.restore();

 // ligne d'eau par-dessus si le nageur est en surface (effet d'immersion partielle)
 if(st.depthM>-0.35 && st.depthM<0.3){
  ctxS.save(); ctxS.globalAlpha=0.35; ctxS.fillStyle='#1e88e5';
  ctxS.fillRect(x-1.3*k, surfaceY, 2.6*k, Math.max(0,(0.3-st.depthM))*ky*0.5);
  ctxS.restore();
  ctxS.strokeStyle='rgba(255,255,255,.75)'; ctxS.lineWidth=2;
  ctxS.beginPath(); ctxS.moveTo(x-1.4*k, surfaceY); ctxS.lineTo(x+1.4*k, surfaceY); ctxS.stroke();
 }
}

function drawSwimmerTop(top, st){
 const {W,H,pad}=top;
 const kx=(W-2*pad)/POOL_LEN, kyLane=(H-2*pad)/LANE_W;
 const x=m2x(st.xPool,W,pad,POOL_LEN), y=m2y(st.yM,H,pad,LANE_W);
 const dir=st.goingRight?1:-1;
 const depthF=clamp(st.depthM/DEPTH,0,1);
 const k=kx*1.15*(1-0.12*depthF);
 const held = sim.carry && sim.carry.held ? sim.carry.type : null;
 // lacet : changement de côté de couloir
 const targetYaw = clamp(Math.atan2((laneY(sim.len)-sim.yM)*kyLane*0.9, 2.2*kx), -0.35, 0.35)*dir;
 sim.yaw = lerp(sim.yaw, targetYaw, 0.2);

 ctxT.save();
 ctxT.translate(x,y); ctxT.scale(dir,1); ctxT.rotate(sim.yaw*dir); ctxT.scale(k,k);
 if(sim.turn) ctxT.scale(Math.cos(sim.flip*Math.PI),1);
 const surf = st.depthM<0.2 && (st.mode==='crawl'||st.mode==='tow'||st.mode==='hold');
 if(surf) wake(ctxT,k,sim.time,st.mode==='crawl');
 // ombre portée au fond quand immergé
 ctxT.globalAlpha = 1 - 0.55*depthF;
 if(held==='mannequin'){
  ctxT.save();
  if(sim.mode==='tow'){ ctxT.translate(0.25,0.32); } else { ctxT.translate(0.6,0.34); }
  drawManikin(ctxT,0.95); ctxT.restore();
 }
 drawBodyTop(ctxT, st.mode, sim.stroke, sim.kick, held);
 ctxT.restore();
 // reflet bleu quand immergé
 if(depthF>0.05){
  ctxT.save(); ctxT.globalAlpha=0.35*depthF; ctxT.fillStyle='#1565c0';
  ctxT.beginPath(); ctxT.ellipse(x, y, 1.3*k, 0.45*k, 0, 0, Math.PI*2); ctxT.fill(); ctxT.restore();
 }
}

/* ========= Objets relâchés ========= */
function drawDetachedCarryTop(top){
 if(!sim.carry || sim.carry.held) return;
 const {W,H,pad}=top;
 const k=(W-2*pad)/POOL_LEN*1.15;
 const x=m2x(sim.carry.xPool,W,pad,POOL_LEN), y=m2y(sim.carry.yM,H,pad,LANE_W);
 ctxT.save(); ctxT.globalAlpha=0.85-0.4*clamp(sim.carry.depthM/DEPTH,0,1);
 ctxT.translate(x,y); ctxT.scale(k,k);
 if(sim.carry.type==='objet') drawObj(ctxT); else drawManikin(ctxT,0.95);
 ctxT.restore();
}
function drawDetachedCarrySide(side){
 if(!sim.carry || sim.carry.held) return;
 const {W,pad,surfaceY,bottomY}=side;
 const k=(W-2*pad)/POOL_LEN*1.15;
 const x=m2x(sim.carry.xPool,W,pad,POOL_LEN), y=surfaceY+(sim.carry.depthM/DEPTH)*(bottomY-surfaceY);
 ctxS.save(); ctxS.globalAlpha=0.9; ctxS.translate(x,y); ctxS.scale(k,k);
 if(sim.carry.type==='objet') drawObj(ctxS); else { ctxS.rotate(-0.2); drawManikin(ctxS,0.95); }
 ctxS.restore();
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
