/* =========================================================
   Sim — animation du parcours (vue de dessus + vue de côté)
   Moteur repris de la V4c, nettoyé et encapsulé.
   ========================================================= */
const Sim = (function(){
'use strict';
let cvTop=null, cvSide=null, ctxT=null, ctxS=null, offS=null, offCtx=null;
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

const DECK=1.0;                       // plage (bord du bassin) dessinée à chaque extrémité, en m
function deckPx(W,pad){ return (W-2*pad)*DECK/(POOL_LEN+2*DECK); }
function PW(W,pad){ return W-2*pad-2*deckPx(W,pad); }          // largeur du bassin (px)
function m2x(m, W, pad, lenM){ return pad + deckPx(W,pad) + (m/lenM)*PW(W,pad); }
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
 const dash = PW(W,pad) * (0.10/POOL_LEN);
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
function drawDeckTop(W,H,pad){
 const d=deckPx(W,pad), x0=pad+d, x1=W-pad-d;
 ctxT.fillStyle='#cfc6b8';
 ctxT.fillRect(0,0,x0,H); ctxT.fillRect(x1,0,W-x1,H);
 // carrelage de la plage
 ctxT.strokeStyle='rgba(0,0,0,0.10)'; ctxT.lineWidth=1;
 const t=Math.max(6,d/3);
 for(let y=0;y<=H;y+=t){ ctxT.beginPath(); ctxT.moveTo(0,y); ctxT.lineTo(x0,y); ctxT.moveTo(x1,y); ctxT.lineTo(W,y); ctxT.stroke(); }
 for(let x=x0;x>=0;x-=t){ ctxT.beginPath(); ctxT.moveTo(x,0); ctxT.lineTo(x,H); ctxT.stroke(); }
 for(let x=x1;x<=W;x+=t){ ctxT.beginPath(); ctxT.moveTo(x,0); ctxT.lineTo(x,H); ctxT.stroke(); }
 // margelle
 ctxT.fillStyle='#efe9df';
 const m=Math.max(3,d*0.16);
 ctxT.fillRect(x0-m,0,m,H); ctxT.fillRect(x1,0,m,H);
 return {x0,x1};
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
 ctxT.moveTo(m2x(2.5,W,pad,POOL_LEN), yMid);
 ctxT.lineTo(m2x(POOL_LEN-2.5,W,pad,POOL_LEN), yMid);
 ctxT.stroke();

 drawBordersTop(ctxT,W,H,pad);
 drawHLineTop(ctxT,W,H,pad);
 drawDeckTop(W,H,pad);

 return {W,H,pad,yMid};
}
function drawAirZone(W,H,pad,surfaceY){
 const grad=ctxS.createLinearGradient(0,pad,0,surfaceY);
 grad.addColorStop(0,'#f5fbff');
 grad.addColorStop(1,'#cfe9ff');
 ctxS.fillStyle=grad;
 ctxS.fillRect(pad,pad,W-2*pad,surfaceY-pad);
 ctxS.save(); ctxS.beginPath(); ctxS.rect(pad,pad,W-2*pad,surfaceY-pad); ctxS.clip();
 ctxS.strokeStyle='rgba(255,255,255,0.55)';
 ctxS.lineWidth=1;
 for(let x=pad; x<=W-pad; x+=40){
  ctxS.beginPath(); ctxS.moveTo(x, pad); ctxS.lineTo(x+30, surfaceY); ctxS.stroke();
 }
 ctxS.strokeStyle='rgba(0,0,0,0.12)';
 for(let x=pad; x<=W-pad; x+=70){
  ctxS.beginPath(); ctxS.moveTo(x,pad); ctxS.lineTo(x,surfaceY); ctxS.stroke();
 }
 ctxS.restore();
}
function drawTilesSide(x0,x1,H,pad,surfaceY){
 const yBottom = H-pad;
 const yTileTop = surfaceY + (yBottom-surfaceY)*0.55;
 ctxS.fillStyle='rgba(0,0,0,0.12)';
 ctxS.fillRect(x0,yTileTop,x1-x0,yBottom-yTileTop);
 const tile=30;
 ctxS.strokeStyle='rgba(0,0,0,0.16)';
 for(let x=x0; x<=x1; x+=tile){
  ctxS.beginPath(); ctxS.moveTo(x,yTileTop); ctxS.lineTo(x,yBottom); ctxS.stroke();
 }
 for(let y=yTileTop; y<=yBottom; y+=tile){
  ctxS.beginPath(); ctxS.moveTo(x0,y); ctxS.lineTo(x1,y); ctxS.stroke();
 }
}
function drawDeckSide(W,H,pad,surfaceY,k){
 const d=deckPx(W,pad), x0=pad+d, x1=W-pad-d;
 const yTop=surfaceY-EDGE*k, yB=H-pad;
 [[pad,x0],[x1,W-pad]].forEach(([a,b])=>{
  ctxS.fillStyle='#bdb3a4'; ctxS.fillRect(a,yTop,b-a,yB-yTop);
  ctxS.fillStyle='#efe9df'; ctxS.fillRect(a,yTop,b-a,Math.max(3,0.08*k));
  ctxS.strokeStyle='rgba(0,0,0,0.12)'; ctxS.lineWidth=1;
  for(let y=yTop+12;y<yB;y+=14){ ctxS.beginPath(); ctxS.moveTo(a,y); ctxS.lineTo(b,y); ctxS.stroke(); }
 });
 // goulotte (rebord intérieur du mur)
 ctxS.fillStyle='rgba(0,0,0,0.25)';
 ctxS.fillRect(x0-2,surfaceY-2,2,yB-surfaceY+2); ctxS.fillRect(x1,surfaceY-2,2,yB-surfaceY+2);
 return {x0,x1};
}
function drawLaneSide(){
 const W=cssW(cvSide), H=cssH(cvSide);
 ctxS.clearRect(0,0,W,H);
 ctxS.fillStyle='#0f2140';
 ctxS.fillRect(0,0,W,H);
 const pad=Math.max(10, Math.min(18, W*0.02));
 const k=PW(W,pad)/POOL_LEN*BODY;
 // zone d'air agrandie si le départ se fait hors de l'eau (nageur debout sur la plage)
 const need = (startMode==='water' ? 0 : AIR_NEED*k + 6);
 const air = Math.max((H-2*pad)*0.22, Math.min((H-2*pad)*0.45, need));
 const surfaceY = pad + air;
 const ky=(H-pad-surfaceY)/DEPTH;
 sim.kr = k/ky;

 drawAirZone(W,H,pad,surfaceY);
 const d=deckPx(W,pad), x0=pad+d, x1=W-pad-d;

 const wgrad=ctxS.createLinearGradient(0,surfaceY,0,H-pad);
 wgrad.addColorStop(0,'#1e88e5');
 wgrad.addColorStop(1,'#0d47a1');
 ctxS.fillStyle=wgrad;
 ctxS.fillRect(x0,surfaceY,x1-x0,(H-pad)-surfaceY);

 ctxS.strokeStyle='rgba(255,255,255,0.65)';
 ctxS.lineWidth=2;
 ctxS.beginPath(); ctxS.moveTo(x0,surfaceY); ctxS.lineTo(x1,surfaceY); ctxS.stroke();

 drawTilesSide(x0,x1,H,pad,surfaceY);
 drawDeckSide(W,H,pad,surfaceY,k);

 ctxS.strokeStyle='rgba(255,255,255,0.35)';
 ctxS.lineWidth=2;
 ctxS.strokeRect(pad,pad,W-2*pad,H-2*pad);

 return {W,H,pad,surfaceY,bottomY:H-pad,k,ky};
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
    const len=Math.max(18,(obs.depl/POOL_LEN)*PW(W,pad));
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
    const lenPx=(3/POOL_LEN)*PW(W,pad);
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
    const r=(0.40/POOL_LEN)*PW(W,pad); // 0.4m radius
    const y=yAt(DEPTH)-2;
    ctxS.beginPath(); ctxS.arc(x,y,r,Math.PI,0,false); ctxS.stroke();
   }else if(obs.type==='apnee'){
    ctxS.strokeStyle='#00e676'; ctxS.fillStyle='#00e676'; ctxS.lineWidth=5;
    const y=yAt(0.8);
    const lenPx=Math.max(20,(obs.depl/POOL_LEN)*PW(W,pad));
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
    const lenPx=(3/POOL_LEN)*PW(W,pad);
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
   Les phases « scriptées » (départ, virage) pilotent directement la posture
   (sim.pose) ; ensuite la nage reprend avec une coulée (sim.out).
   Toutes les transitions sont continues (pas de téléportation). */
const sim={running:false,paused:false,finished:false,time:0,last:0,len:1,s:0,action:null,carry:null,
  depth:0, vs:0, vd:0, pitch:0, roll:1, stroke:0, kick:0, yM:1.9, yaw:0, mode:'block', _jump:false, _drawT:0,
  script:null, pose:null, out:null, splash:null, kr:0.56};

const START_MODES=['dive','jump','water'];
let startMode='dive';

const SPEED={swim:2.3, under:1.7, tow:1.35, mat:1.0};
const WALL=POOL_LEN-0.9;        // centre du corps quand la tête/main touche le mur
const TURN_AT=POOL_LEN-2.35;    // début du virage culbute (hanches à ~2,3 m du mur)
const BODY=1.15;                // le nageur est dessiné 15 % plus grand que l'échelle du bassin
const EDGE=0.30;                // hauteur de la plage au-dessus de l'eau (unités « corps »)
const AIR_NEED=2.45;            // hauteur d'air à prévoir quand le départ se fait de la plage
const PI=Math.PI;
const ease=(u)=>{ u=clamp(u,0,1); return u*u*(3-2*u); };
const easeOut=(u)=>{ u=clamp(u,0,1); return 1-(1-u)*(1-u); };
const easeIn=(u)=>{ u=clamp(u,0,1); return u*u; };
const lerp=(a,b,u)=>a+(b-a)*u;
const laneY=(len)=>(len%2===1)?1.9:0.6;
const HOOP_D=DEPTH-0.42;         // passage au centre du cerceau lesté
const FLOOR_D=DEPTH-0.22;        // nageur au fond (ramassage)

/* hauteur « corps » (hb, + vers le bas, relative à la surface) ↔ profondeur en m.
   Hors de l'eau on garde l'échelle du corps (pas d'exagération verticale). */
const hb2d=(hb)=> hb>0 ? hb*sim.kr : hb;
const d2hb=(d)=> d>0 ? d/sim.kr : d;

/* ---------- Postures ----------
   p : inclinaison du corps (0 = horizontal tête devant, +π/2 = tête en bas, −π/2 = debout)
   aN/aF : bras proche/éloigné [angle épaule, flexion coude]
   lN/lF : jambes [angle hanche, flexion genou (négatif = genou plié)]
   foot  : 'flat' (pied à plat sur la plage), 'point' (pointe tendue), 'wall' (plante au mur) */
function P(o){ return Object.assign({s:0,hb:0,p:0,aN:[0,0],aF:[0,0],lN:[0,0],lF:[0,0],foot:'',kick:0,roll:1}, o); }
function blend(A,B,u){
 const r={};
 for(const key in A){
  const a=A[key], b=B[key];
  if(Array.isArray(a)) r[key]=[lerp(a[0],b[0],u), lerp(a[1],b[1],u)];
  else if(typeof a==='number' && typeof b==='number') r[key]=lerp(a,b,u);
  else r[key]= u<0.5 ? a : b;
 }
 return r;
}
function ankleLocal(l){
 const phi=l[0], p2=l[0]+l[1];
 const kx=-0.1-0.43*Math.cos(phi), ky=0.02+0.43*Math.sin(phi);
 return [kx-0.42*Math.cos(p2), ky+0.42*Math.sin(p2)];
}
function toWorld(pt, p, roll){ const x=pt[0], y=pt[1]*(roll<0?-1:1); return [x*Math.cos(p)-y*Math.sin(p), x*Math.sin(p)+y*Math.cos(p)]; }
/* place le corps pour que la cheville soit au point (sF, hF) — hF null : ancrage horizontal seul */
function anchorFeet(pose, sF, hF){
 const w=toWorld(ankleLocal(pose.lN), pose.p, pose.roll);
 pose.s=sF-w[0]*BODY;
 if(hF!=null) pose.hb=hF-w[1];
 return pose;
}
function handsWorldY(pose){ return pose.hb + toWorld([1.25,0], pose.p, pose.roll)[1]; }
function applyPose(pose){
 sim.pose=pose; sim.s=pose.s; sim.depth=hb2d(pose.hb); sim.pitch=pose.p; sim.roll=pose.roll; sim.mode='script';
}
function splashAt(s, power){ sim.splash={xPool:getXPool(sim.len, s), t:0, power}; }
function glideOut(v0, dist){ sim.out={s0:sim.s, d0:Math.max(0,sim.depth), sEnd:sim.s+dist, v0}; }
function endScript(){ sim.script=null; sim.pose=null; sim.mode = sim.depth>0.18 ? 'glide' : 'crawl'; }

/* ---------- Départ 1 : plongeon depuis le bord ---------- */
const DIVE={
 ready: P({p:0.55, aN:[0.95,0.10], aF:[0.90,0.12], lN:[2.69,-1.00], lF:[2.66,-0.96], foot:'flat'}),
 load:  P({p:0.68, aN:[1.25,0.15], aF:[1.20,0.15], lN:[2.97,-1.32], lF:[2.94,-1.28], foot:'flat'}),
 push:  P({p:-0.08, aN:[0.04,0], aF:[-0.04,0], lN:[0.10,-0.05], lF:[0.06,-0.03], foot:'point'}),
 dive:  P({p:0.55, aN:[0.02,0], aF:[-0.02,0], lN:[0.04,0], lF:[0.0,0], foot:'point'})
};
const DIVE_FEET=[-0.13, -(EDGE+0.05)];
function stepDive(sc, dt){
 sc.t+=dt; const t=sc.t;
 if(sc.ph==='ready'){
  if(t<0.55){ applyPose(anchorFeet(P(DIVE.ready), ...DIVE_FEET)); return; }
  sc.ph='load'; sc.t0=t;
 }
 if(sc.ph==='load'){
  const u=(t-sc.t0)/0.3;
  applyPose(anchorFeet(blend(DIVE.ready, DIVE.load, ease(u)), ...DIVE_FEET));
  if(u<1) return; sc.ph='push'; sc.t0=t;
 }
 if(sc.ph==='push'){
  const u=(t-sc.t0)/0.28;
  const ps=blend(DIVE.load, DIVE.push, easeIn(u));
  applyPose(anchorFeet(ps, lerp(DIVE_FEET[0], -0.05, u), lerp(DIVE_FEET[1], -(EDGE+0.12), u)));
  if(u<1) return;
  sc.ph='flight'; sc.t0=t; sc.vs=3.8; sc.vh=-1.15; sc.cur=P(Object.assign({}, sim.pose)); sc.splash=false;
 }
 if(sc.ph==='flight'){
  const c=sc.cur, tf=t-sc.t0;
  c.s+=sc.vs*dt; sc.vh+=9.0*dt; c.hb+=sc.vh*dt;
  const ps=blend(DIVE.push, DIVE.dive, ease(tf/0.35));
  ps.s=c.s; ps.hb=c.hb; ps.p=lerp(DIVE.push.p, 0.78, ease(tf/0.42));
  applyPose(ps);
  if(!sc.splash && handsWorldY(ps)>=0){ sc.splash=true; splashAt(ps.s+toWorld([1.25,0],ps.p)[0]*BODY, 1); }
  if(c.hb<0) return;
  sc.ph='enter'; sc.t0=t; sc.pIn=ps.p; sc.cur=ps;
 }
 if(sc.ph==='enter'){
  const u=(t-sc.t0)/0.55, c=sc.cur;
  const v=lerp(sc.vs, 2.9, u);
  const bot=Math.min(1.3, (DEPTH*0.45)/sim.kr);
  const ps=Object.assign(P(DIVE.dive), {s:c.s+v*dt, hb:lerp(0, bot, easeOut(u)), p:lerp(sc.pIn, 0.04, ease(u))});
  sc.cur=ps; applyPose(ps);
  if(u<1) return;
  glideOut(2.9, 4.6); endScript();
 }
}

/* ---------- Départ 2 : saut droit (entrée pieds en premier) ---------- */
const JUMP={
 stand: P({p:-PI/2, aN:[2.95,0.05], aF:[3.02,0.05], lN:[0,0], lF:[0,0], foot:'flat'}),
 prep:  P({p:-1.30, aN:[2.05,0.35], aF:[2.15,0.35], lN:[0.75,-1.30], lF:[0.72,-1.26], foot:'flat'}),
 push:  P({p:-1.50, aN:[2.70,0.10], aF:[2.80,0.10], lN:[0.03,0], lF:[0.02,0], foot:'point'}),
 air:   P({p:-1.57, aN:[3.05,0.02], aF:[3.10,0.02], lN:[0,0], lF:[0,0], foot:'point'}),
 brake: P({p:-1.45, aN:[0.35,0.30], aF:[0.25,0.30], lN:[0.35,-0.50], lF:[-0.15,0.10], foot:'point'}),
 glide: P({p:0.06, aN:[0.03,0], aF:[-0.03,0], lN:[0.05,0], lF:[0.05,0], foot:'point'})
};
const JUMP_FEET=[-0.16, -(EDGE+0.06)];
function stepJump(sc, dt){
 sc.t+=dt; const t=sc.t;
 if(sc.ph==='stand'){
  if(t<0.55){ applyPose(anchorFeet(P(JUMP.stand), ...JUMP_FEET)); return; }
  sc.ph='prep'; sc.t0=t;
 }
 if(sc.ph==='prep'){
  const u=(t-sc.t0)/0.35;
  applyPose(anchorFeet(blend(JUMP.stand, JUMP.prep, ease(u)), ...JUMP_FEET));
  if(u<1) return; sc.ph='push'; sc.t0=t;
 }
 if(sc.ph==='push'){
  const u=(t-sc.t0)/0.22;
  applyPose(anchorFeet(blend(JUMP.prep, JUMP.push, easeIn(u)), lerp(JUMP_FEET[0],-0.1,u), lerp(JUMP_FEET[1], -(EDGE+0.13), u)));
  if(u<1) return;
  sc.ph='flight'; sc.t0=t; sc.vs=1.6; sc.vh=-1.7; sc.cur=P(Object.assign({}, sim.pose)); sc.splash=false;
 }
 if(sc.ph==='flight' || sc.ph==='sink'){
  const c=sc.cur, tf=t-sc.t0;
  if(sc.ph==='flight'){ sc.vh+=9.8*dt; c.s+=sc.vs*dt; }
  else { // freinage dans l'eau
   sc.vh*=Math.exp(-dt*1.25); sc.vs*=Math.exp(-dt*2.5);
   c.s+=sc.vs*dt;
  }
  c.hb+=sc.vh*dt;
  const ps = sc.ph==='flight' ? blend(JUMP.push, JUMP.air, ease(tf/0.2)) : blend(JUMP.air, JUMP.brake, ease((t-sc.tIn)/0.7));
  ps.s=c.s; ps.hb=c.hb; applyPose(ps);
  const ankY=c.hb+toWorld(ankleLocal(ps.lN), ps.p, 1)[1];
  if(sc.ph==='flight' && ankY>=0){ sc.ph='sink'; sc.tIn=t; splashAt(c.s, 0.85); }
  // arrêt de l'enfoncement (et jamais les pieds au fond)
  const maxHb=Math.min(1.85, (DEPTH-0.2)/sim.kr - 1.1);
  if(sc.ph==='sink' && (sc.vh<0.7 || c.hb>=maxHb)){ c.hb=Math.min(c.hb,maxHb); sc.ph='turn'; sc.t0=t; sc.from=P(Object.assign({}, sim.pose)); }
  return;
 }
 if(sc.ph==='turn'){ // bascule vers l'horizontale, bras devant, battements
  const u=(t-sc.t0)/1.0;
  const ps=blend(sc.from, JUMP.glide, ease(u));
  sc.vs=lerp(0.15, 1.7, easeIn(u));
  ps.s=sim.s+sc.vs*dt;
  ps.hb=lerp(sc.from.hb, Math.min(1.15, sc.from.hb), ease(u));
  ps.kick=0.22*ease(u);
  applyPose(ps);
  if(u<1) return;
  glideOut(1.7, 3.2); endScript();
 }
}

/* ---------- Départ 3 : dans l'eau, main au bord, pieds au mur ---------- */
const WATER={
 hold: P({p:-1.25, aN:[1.15,0.35], aF:[-1.92,0.05], lN:[0.14,-1.75], lF:[0.10,-1.70], foot:'wall'}),
 sink: P({p:0.06, aN:[0.04,0], aF:[-0.04,0], lN:[1.09,-1.45], lF:[1.05,-1.40], foot:'wall'}),
 push: P({p:0.03, aN:[0.03,0], aF:[-0.03,0], lN:[0.04,0], lF:[0.03,0], foot:'point'})
};
const WALL_FOOT=0.08;
function stepWater(sc, dt){
 sc.t+=dt; const t=sc.t;
 if(sc.ph==='hold'){
  const ps=anchorFeet(P(WATER.hold), WALL_FOOT, null);
  ps.hb=0.42+0.03*Math.sin(t*4);
  applyPose(ps);
  if(t<0.7) return; sc.ph='sink'; sc.t0=t; sc.hb0=ps.hb;
 }
 if(sc.ph==='sink'){
  const u=(t-sc.t0)/0.6;
  const ps=anchorFeet(blend(WATER.hold, WATER.sink, ease(u)), WALL_FOOT, null);
  ps.hb=lerp(sc.hb0, Math.min(1.05, (DEPTH*0.4)/sim.kr), ease(u));
  applyPose(ps);
  if(u<1) return; sc.ph='push'; sc.t0=t; sc.hb0=ps.hb;
 }
 if(sc.ph==='push'){
  const u=(t-sc.t0)/0.32;
  const ps=anchorFeet(blend(WATER.sink, WATER.push, easeIn(u)), WALL_FOOT, null);
  ps.hb=sc.hb0;
  applyPose(ps);
  if(u<1) return;
  glideOut(2.7, 4.2); endScript();
 }
}

/* ---------- Virage culbute ---------- */
const TURN={
 reach: P({p:0.32, aN:[2.95,0.10], aF:[2.88,0.12], lN:[0.20,-0.25], lF:[0.05,-0.05], foot:'point'}),
 tuck:  P({p:PI*0.58, aN:[2.30,0.70], aF:[2.20,0.70], lN:[2.35,-2.45], lF:[2.30,-2.40], foot:'point'}),
 plant: P({p:PI, aN:[0.55,0.55], aF:[0.45,0.55], lN:[1.00,-1.60], lF:[0.95,-1.55], foot:'wall'}),
 push:  P({p:0, roll:-1, aN:[0.03,0], aF:[-0.03,0], lN:[0.04,0], lF:[0.03,0], foot:'point'})
};
function crawlLimbs(){
 const norm=(th)=>{ th=((th%(2*PI))+2*PI)%(2*PI); return th>3.6 ? th-2*PI : th; };
 const bendOf=(t)=>{ t=((t%(PI*2))+PI*2)%(PI*2); return t>PI ? -0.9*Math.sin(t-PI) : 0.45*Math.sin(t); };
 const th=sim.stroke, kk=sim.kick;
 return {aN:[norm(th), bendOf(th)], aF:[norm(th+PI), bendOf(th+PI)],
   lN:[0.2*Math.sin(kk),0.18+0.12*Math.sin(kk+0.8)], lF:[0.2*Math.sin(kk+PI),0.18+0.12*Math.sin(kk+PI+0.8)]};
}
function startTurn(){
 const from=P(Object.assign({s:sim.s, hb:d2hb(sim.depth), p:sim.pitch, roll:1}, crawlLimbs()));
 from.foot='point';
 sim.out=null;
 sim.script={type:'turn', t:0, ph:'reach', from};
 applyPose(from);
}
function stepTurn(sc, dt){
 sc.t+=dt; const t=sc.t;
 if(sc.ph==='reach'){ // dernier mouvement de bras, bras le long du corps, tête rentrée
  const u=t/0.3;
  const ps=blend(sc.from, TURN.reach, ease(u));
  ps.s=sim.s+lerp(2.0,1.6,u)*dt; ps.hb=lerp(sc.from.hb, 0.28, ease(u));
  applyPose(ps);
  if(u<1) return; sc.ph='flip'; sc.t0=t; sc.s0=ps.s; sc.hb0=ps.hb;
 }
 if(sc.ph==='flip'){ // salto avant groupé
  const u=clamp((t-sc.t0)/0.62,0,1);
  const ps = u<0.5 ? blend(TURN.reach, TURN.tuck, ease(u/0.5)) : blend(TURN.tuck, TURN.plant, ease((u-0.5)/0.5));
  ps.p=lerp(TURN.reach.p, PI, ease(u));
  const end=anchorFeet(P(TURN.plant), POOL_LEN-WALL_FOOT, null).s;
  ps.s=lerp(sc.s0, end, ease(u));
  ps.hb = u<0.45 ? lerp(sc.hb0, 0.22, ease(u/0.45)) : lerp(0.22, Math.min(1.0,(DEPTH*0.32)/sim.kr), ease((u-0.45)/0.55));
  applyPose(ps);
  if(u<1) return;
  // changement de longueur : même image, repère retourné (sur le dos, tête vers le large)
  sim.len++; sim._jump=true;
  const np=Object.assign(P(ps), {p:ps.p-PI, roll:-1, s:POOL_LEN-ps.s});
  sc.plant=np; sc.ph='push'; sc.t0=t; applyPose(np);
  return;
 }
 if(sc.ph==='push'){ // extension des jambes, bras en flèche
  const u=(t-sc.t0)/0.34;
  const ps=anchorFeet(blend(sc.plant, TURN.push, easeIn(u)), WALL_FOOT, null);
  ps.hb=sc.plant.hb; ps.roll=-1;
  applyPose(ps);
  if(u<1) return;
  glideOut(2.9, 4.6); endScript();
 }
}

function makeStart(){
 const sc={type:startMode, t:0, ph: startMode==='jump'?'stand':(startMode==='water'?'hold':'ready')};
 sim.script=sc; sim.out=null;
 stepScript(0);
}
function stepScript(dt){
 const sc=sim.script; if(!sc) return;
 if(sc.type==='dive') stepDive(sc,dt);
 else if(sc.type==='jump') stepJump(sc,dt);
 else if(sc.type==='water') stepWater(sc,dt);
 else if(sc.type==='turn') stepTurn(sc,dt);
}

function initStatuses(){
 for(let i=1;i<=D.nbLongueurs;i++) (D.obstacles[i]||[]).forEach(o=>{ o._done=false; o._taken=false; });
 Object.assign(sim,{s:0, depth:0, vs:0, vd:0, pitch:0, roll:1, stroke:0, kick:0, splash:null,
   yM:laneY(1), yaw:0, mode:'script', _jump:true, script:null, pose:null, out:null});
 makeStart();
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
 sim.out=null;
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
 const o=sim.out;
 if(o){ // coulée après départ / virage : vitesse qui décroît, maintien puis remontée
  const L=Math.max(0.5,o.sEnd-o.s0);
  const v=lerp(o.v0, SPEED.swim, ease((sim.s-o.s0)/L));
  sim.s=Math.min(WALL, sim.s+v*dt);
  const u=clamp((sim.s-o.s0)/L,0,1), hold=0.22;
  sim.depth = u<hold ? o.d0 : o.d0*(1-ease((u-hold)/(1-hold)));
  if(u>=1) sim.out=null;
 }else{
  sim.s=Math.min(WALL, sim.s+SPEED.swim*dt);
  sim.depth=lerp(sim.depth, 0, 1-Math.exp(-dt*5));
 }
 sim.mode = sim.depth>0.18 ? 'glide' : 'crawl';
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

function finish(){ sim.s=WALL; sim.running=false; sim.finished=true; sim.mode='crawl'; sim.out=null; }

function swimmerState(dt){
 const s0=sim.s, d0=sim.depth;
 if(sim.script) stepScript(dt);
 else if(sim.action) stepAction(dt);
 else stepSwim(dt);

 // objet/mannequin relâché : il redescend au fond puis disparaît
 if(sim.carry && !sim.carry.held){
  sim.carry.fallT += dt;
  const prog=Math.min(1, sim.carry.fallT/3.0);
  sim.carry.depthM = lerp(sim.carry.depthM, DEPTH-0.1, Math.min(1, dt*1.2));
  if(prog>=1) sim.carry=null;
 }
 if(sim.splash){ sim.splash.t+=dt; if(sim.splash.t>1.1) sim.splash=null; }

 if(sim.running && !sim.action && !sim.script){ const o=obstacleNearCurrent(); if(o) beginAction(o); }
 if(sim.running && !sim.action && !sim.script){
  const last = sim.len>=D.nbLongueurs;
  const pending = (D.obstacles[sim.len]||[]).some(o=>!o._done);
  if(last){ if(sim.s>=WALL-1e-3) finish(); }
  else if(sim.s>=WALL-1e-3 || (!pending && sim.s>=TURN_AT)) startTurn();
 }

 // couloir : changement de côté progressif après le virage
 const ty=laneY(sim.len);
 sim.yM = lerp(sim.yM, ty, 1-Math.exp(-dt*(sim.s<4?1.6:3)));

 // vitesses lissées (inclinaison du corps)
 if(dt>0 && !sim._jump){
  const k=1-Math.exp(-dt*9);
  sim.vs=lerp(sim.vs,(sim.s-s0)/dt,k); sim.vd=lerp(sim.vd,(sim.depth-d0)/dt,k);
 }
 sim._jump=false;

 // retour progressif sur le ventre après la poussée du virage ; sur le dos pour le remorquage
 if(!sim.script){
  const rollT = sim.mode==='tow' ? -1 : 1;
  const rate = (sim.len>1 && sim.s<3 && sim.mode!=='tow') ? 2.0 : 4;
  sim.roll = lerp(sim.roll, rollT, 1-Math.exp(-dt*rate));
 }

 // rythmes de nage
 const strokeHz = {crawl:0.8, mat:0.9, climb:0.9, hold:0.6, carryUp:0.6, grab:0.5, tow:0.55, glide:0, under:0, script:0, block:0}[sim.mode] ?? 0.8;
 sim.stroke += dt*Math.PI*2*strokeHz;
 const kickHz = {crawl:2.4, glide:1.3, under:1.3, carryUp:1.6, hold:1.8, tow:1.8, mat:1.0, climb:1.0, grab:0.6, script:1.6, block:0}[sim.mode] ?? 2;
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
function legSide(ctx, H, phi, bend, col, q){
 const k=[H[0]-0.43*Math.cos(phi), H[1]+0.43*Math.sin(phi)];
 const p2=phi+bend;
 const f=[k[0]-0.42*Math.cos(p2), k[1]+0.42*Math.sin(p2)];
 limb(ctx,[H,k,f],0.13,col);
 // pied (q : orientation du pied ; par défaut légèrement fléchi)
 const qa = (q==null) ? p2+0.5 : q;
 limb(ctx,[f,[f[0]-0.12*Math.cos(qa), f[1]+0.12*Math.sin(qa)]],0.08,col);
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

/* orientation du pied pour une posture : à plat (vers l'avant), tendu, ou plante contre le mur */
function footAngle(pose, leg){
 const r = pose.roll<0 ? -1 : 1, p2=leg[0]+leg[1];
 if(pose.foot==='flat') return r>0 ? PI+pose.p : PI-pose.p;
 if(pose.foot==='wall') return r>0 ? PI+pose.p+PI/2 : PI/2-pose.p;
 if(pose.foot==='point') return p2+0.12;
 return null;
}
function drawBodySide(ctx, mode, stroke, kick, held, pose){
 const S=[0.5,-0.02], H=[-0.1,0.02];
 const under = (mode==='under'||mode==='glide'||mode==='dive'||mode==='block');
 // ----- membres éloignés (plus sombres) puis proches
 const arms=[], legs=[], feet=[null,null];
 if(pose){
  const kA=pose.kick||0;
  arms.push(pose.aN, pose.aF);
  legs.push([pose.lN[0]+kA*Math.sin(kick), pose.lN[1]-kA*0.6*Math.max(0,Math.sin(kick))],
            [pose.lF[0]+kA*Math.sin(kick+PI), pose.lF[1]-kA*0.6*Math.max(0,Math.sin(kick+PI))]);
  feet[0]=footAngle(pose, legs[0]); feet[1]=footAngle(pose, legs[1]);
 }else if(under){
  arms.push([-0.06,0.08],[0.04,0.1]);
  const d=0.16*Math.sin(kick);
  legs.push([d,0.12],[d+0.05,0.12]);
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
 legSide(ctx,H,legs[1][0],legs[1][1],COL.skinFar,feet[1]);
 // tronc
 limb(ctx,[H,S],0.27,COL.skin);
 limb(ctx,[[-0.2,0.03],[0.07,0.01]],0.29,COL.suit);
 // tête + bonnet
 dot(ctx,0.76,-0.03,0.115,COL.skin);
 ctx.fillStyle=COL.cap; ctx.beginPath(); ctx.arc(0.76,-0.03,0.122,Math.PI*0.62,Math.PI*1.9); ctx.closePath(); ctx.fill();
 legSide(ctx,H,legs[0][0],legs[0][1],COL.skin,feet[0]);
 const hand=armSide(ctx,S,arms[0][0],arms[0][1],COL.skin);
 // objet tenu
 if(held==='objet'){ ctx.save(); ctx.translate(hand[0],hand[1]+0.04); drawObj(ctx); ctx.restore(); }
}

function drawBodyTop(ctx, mode, stroke, kick, held, pose){
 const under = (mode==='under'||mode==='glide'||mode==='dive'||mode==='block');
 const sh=0.21;
 const hands=[];
 let legX=null;
 if(pose){ // projection au sol des angles de la vue de côté
  [[pose.aN,-1],[pose.aF,1]].forEach(([a,sg])=>{
   const ex=0.5+0.31*Math.cos(a[0]), hx=ex+0.3*Math.cos(a[0]+a[1]);
   const spread=Math.abs(Math.sin(a[0]));
   hands.push({e:[ex, sg*(0.25+0.05*spread)], h:[hx, sg*(0.14+0.12*spread)], top:true});
  });
  legX=[pose.lN, pose.lF].map(l=>{ const kx=-0.1-0.43*Math.cos(l[0]); return [kx, kx-0.42*Math.cos(l[0]+l[1])]; });
 }else if(under){
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
 [-1,1].forEach((sg,i)=>{
  if(legX){
   const [kx,fx]=legX[i];
   limb(ctx,[[-0.12,sg*0.09],[kx,sg*0.11],[fx,sg*0.09]],0.13,COL.skin);
   dot(ctx,fx-0.04*Math.sign(fx-kx||1),sg*0.09,0.06,COL.skin);
   return;
  }
  const k=Math.sin(kick+(i?Math.PI:0));
  const fx=-0.98+0.05*k, fy=sg*(0.08+(mode==='tow'||mode==='hold'?0.12*Math.abs(k):0));
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

function sideY(side, depthM){ return side.surfaceY + (depthM>=0 ? depthM*side.ky : depthM*side.k); }
function drawSwimmerSide(side, st){
 const {W,H,pad,surfaceY,bottomY}=side;
 const kx=PW(W,pad)/POOL_LEN, ky=(bottomY-surfaceY)/DEPTH;
 const x=m2x(st.xPool,W,pad,POOL_LEN);
 const pose=sim.pose;
 const k=kx*BODY;
 const y = pose ? surfaceY+pose.hb*k : sideY(side, st.depthM);
 const dir=st.goingRight?1:-1;
 let pitch;
 if(pose){ pitch=pose.p; sim.pitch=pose.p; sim._drawT=sim.time; }
 else pitch=smoothPitch(kx,ky);
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

 // le nageur est dessiné à part pour teinter en bleu la partie immergée
 const c = offCtx || ctxS;
 if(offCtx){ c.save(); c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,offS.width,offS.height); c.restore(); }
 c.save();
 c.translate(x,y); c.scale(dir*k, k); c.rotate(pitch);
 // mannequin sous le bras (remontée) — derrière le nageur
 if(held==='mannequin' && sim.mode!=='tow'){ c.save(); c.translate(0.55,0.3); c.rotate(0.15); drawManikin(c,0.9); c.restore(); }
 c.save(); c.scale(1, sim.roll>=0 ? Math.max(0.5,sim.roll) : Math.min(-0.5,sim.roll));
 c.lineWidth=0.02;
 drawBodySide(c, st.mode, sim.stroke, sim.kick, held, pose);
 c.restore();
 // remorquage : mannequin sur la poitrine, tête hors de l'eau
 if(held==='mannequin' && sim.mode==='tow'){ c.save(); c.translate(0.25,-0.22); c.rotate(-0.08); drawManikin(c,0.95); c.restore(); }
 c.restore();
 if(offCtx){
  c.save(); c.globalCompositeOperation='source-atop';
  c.fillStyle='rgba(13,71,161,0.34)'; c.fillRect(0,surfaceY,W,H-surfaceY);
  c.restore();
  ctxS.drawImage(offS,0,0,W,H);
 }

 // ligne d'eau par-dessus quand le corps traverse la surface
 if(y-1.25*k<surfaceY && y+1.25*k>surfaceY){
  ctxS.strokeStyle='rgba(255,255,255,.8)'; ctxS.lineWidth=2;
  const d=deckPx(W,pad), xa=Math.max(pad+d, x-1.4*k), xb=Math.min(W-pad-d, x+1.4*k);
  if(xb>xa){ ctxS.beginPath(); ctxS.moveTo(xa, surfaceY); ctxS.lineTo(xb, surfaceY); ctxS.stroke(); }
 }
}

function drawSplashSide(side){
 const sp=sim.splash; if(!sp) return;
 const {W,pad,surfaceY}=side;
 const k=PW(W,pad)/POOL_LEN*BODY;
 const x=m2x(sp.xPool,W,pad,POOL_LEN), t=sp.t;
 ctxS.save();
 for(let i=0;i<16;i++){
  const a=-PI/2+((i/15)-0.5)*1.9, v=(1.3+0.6*((i*7)%5)/4)*sp.power;
  const px=x+Math.cos(a)*v*t*k*0.9, py=surfaceY+(Math.sin(a)*v*1.5*t + 4.5*t*t)*k;
  if(py>surfaceY) continue;
  ctxS.globalAlpha=Math.max(0,1-t/1.0);
  dot(ctxS,px,py,Math.max(1.2,k*0.035),'#ffffff');
 }
 // écume
 ctxS.globalAlpha=Math.max(0,0.8*(1-t/1.1));
 ctxS.fillStyle='#ffffff';
 ctxS.beginPath(); ctxS.ellipse(x, surfaceY, (0.25+0.9*easeOut(t))*k*sp.power, Math.max(2,0.06*k), 0, 0, PI*2); ctxS.fill();
 ctxS.restore();
}
function drawSplashTop(top){
 const sp=sim.splash; if(!sp) return;
 const {W,H,pad}=top;
 const k=PW(W,pad)/POOL_LEN*BODY;
 const x=m2x(sp.xPool,W,pad,POOL_LEN), y=m2y(sim.yM,H,pad,LANE_W), t=sp.t;
 ctxT.save();
 for(let i=0;i<2;i++){
  const u=clamp((t-i*0.18)/0.9,0,1); if(u<=0||u>=1) continue;
  ctxT.globalAlpha=0.7*(1-u); ctxT.strokeStyle='#ffffff'; ctxT.lineWidth=2;
  ctxT.beginPath(); ctxT.ellipse(x,y,(0.25+1.0*u)*k*sp.power,(0.2+0.6*u)*k*sp.power,0,0,PI*2); ctxT.stroke();
 }
 ctxT.globalAlpha=Math.max(0,0.6*(1-t/0.8)); ctxT.fillStyle='#ffffff';
 ctxT.beginPath(); ctxT.ellipse(x,y,0.35*k*sp.power,0.25*k*sp.power,0,0,PI*2); ctxT.fill();
 ctxT.restore();
}

function drawSwimmerTop(top, st){
 const {W,H,pad}=top;
 const kx=PW(W,pad)/POOL_LEN, kyLane=(H-2*pad)/LANE_W;
 const x=m2x(st.xPool,W,pad,POOL_LEN), y=m2y(st.yM,H,pad,LANE_W);
 const dir=st.goingRight?1:-1;
 const depthF=clamp(st.depthM/DEPTH,0,1);
 const k=kx*BODY*(1-0.12*depthF);
 const held = sim.carry && sim.carry.held ? sim.carry.type : null;
 const pose=sim.pose;
 // lacet : changement de côté de couloir
 const targetYaw = clamp(Math.atan2((laneY(sim.len)-sim.yM)*kyLane*0.9, 2.2*kx), -0.35, 0.35)*dir;
 sim.yaw = lerp(sim.yaw, targetYaw, 0.2);

 ctxT.save();
 ctxT.translate(x,y); ctxT.scale(dir,1); ctxT.rotate(sim.yaw*dir); ctxT.scale(k,k);
 // raccourci perspectif : corps incliné (debout, plongeon, culbute) vu d'en haut
 if(pose){ const c=Math.cos(pose.p); ctxT.scale((c<0?-1:1)*Math.max(0.3,Math.abs(c)),1); }
 const surf = st.depthM<0.2 && (st.mode==='crawl'||st.mode==='tow'||st.mode==='hold');
 if(surf) wake(ctxT,k,sim.time,st.mode==='crawl');
 // ombre portée au fond quand immergé
 ctxT.globalAlpha = 1 - 0.55*depthF;
 if(held==='mannequin'){
  ctxT.save();
  if(sim.mode==='tow'){ ctxT.translate(0.25,0.32); } else { ctxT.translate(0.6,0.34); }
  drawManikin(ctxT,0.95); ctxT.restore();
 }
 drawBodyTop(ctxT, st.mode, sim.stroke, sim.kick, held, pose);
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
 const k=PW(W,pad)/POOL_LEN*1.15;
 const x=m2x(sim.carry.xPool,W,pad,POOL_LEN), y=m2y(sim.carry.yM,H,pad,LANE_W);
 ctxT.save(); ctxT.globalAlpha=0.85-0.4*clamp(sim.carry.depthM/DEPTH,0,1);
 ctxT.translate(x,y); ctxT.scale(k,k);
 if(sim.carry.type==='objet') drawObj(ctxT); else drawManikin(ctxT,0.95);
 ctxT.restore();
}
function drawDetachedCarrySide(side){
 if(!sim.carry || sim.carry.held) return;
 const {W,pad,surfaceY,bottomY}=side;
 const k=PW(W,pad)/POOL_LEN*1.15;
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
 const st=swimmerPose();
 drawSwimmerTop(top, st);
 drawSplashTop(top);
 drawSwimmerSide(side, st);
 drawSplashSide(side);
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
 try{
  if(!offS){ offS=document.createElement('canvas'); offCtx=offS.getContext('2d'); }
  offS.width=cvSide.width; offS.height=cvSide.height;
  offCtx.setTransform(1,0,0,1,0,0); offCtx.scale(cvSide._dpr, cvSide._dpr);
 }catch(e){ offS=null; offCtx=null; }
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
 sim.len=1; sim.s=0; sim.action=null; sim.carry=null;
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
function setStart(m){
 if(START_MODES.indexOf(m)<0) m='dive';
 startMode=m;
 if(cvTop && active) resizeCanvases();
 reset();
}
function getStart(){ return startMode; }
/* avance la simulation sans animation (tests) */
function _advance(sec){ if(!sim.running){ sim.running=true; } let t=sec; while(t>0 && sim.running){ const st=Math.min(0.02,t); sim.time+=st; swimmerState(st); t-=st; } drawAll(); }
function setSpeed(v){ speed=Math.max(0.25, Math.min(8, Number(v)||1)); }
function on(evt, fn){ listeners[evt]=fn; }
window.addEventListener('resize', ()=>{ if(active){ resizeCanvases(); drawAll(); } });

return {attach, load, reset, play, pause, toggle, setActive, setSpeed, setStart, getStart, _advance, on, getStatus, redraw:()=>{ if(active){ resizeCanvases(); drawAll(); } }};
})();
