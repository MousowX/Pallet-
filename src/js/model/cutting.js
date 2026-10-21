/* ================= CUTTING — plywood sheet layouts and lumber cut list ================= */
// size text for a piece: 0.75 × 5.5 × 40″
const sizeTxt=(...a)=>a.map(v=>inch(v).slice(0,-1)).join(" × ")+"″";
// plywood thickness as a fraction: 0.375 → 3/8″ (anything off the 1/16 grid stays decimal)
function frac(t){
  const s=Math.round(t*16);
  if(Math.abs(s/16-t)>1e-6) return inch(t);
  const whole=Math.floor(s/16); let n=s%16, d=16;
  if(!n) return whole+"″";
  while(n%2===0){ n/=2; d/=2; }
  return (whole?whole+"-":"")+n+"/"+d+"″";
}
// A part bigger than the sheet is made of pieces. Candidates: the fewest equal pieces that fit, and
// full-sheet pieces plus the remainder (either way round). The one that needs the least sheet wins,
// fewer pieces breaking a tie. No piece is left narrower than 12″ — a remainder that small is shared
// with its neighbour, or (strip12) also tried as a 12″ strip. Panels may turn 90°; cleat strips may
// not (they run along the face grain, the sheet's length). Returns null when the part fits as it is.
function splitToFit(w,h,SW,SL,rot,k,strip12){
  const fits=(a,b)=> (a<=SW+1e-9 && b<=SL+1e-9) || (rot && a<=SL+1e-9 && b<=SW+1e-9);
  if(fits(w,h)) return null;
  // ways to cut one dimension: full pieces + the remainder; a remainder under 12″ is either shared
  // with its neighbour (two equal pieces) or brought up to 12″ (a full-width strip packs well)
  const segs=(D,S)=>{
    if(D<=S+1e-9) return [[D]];
    const n=Math.floor(D/S+1e-9), r=D-n*S, full=c=>Array(c).fill(S);
    if(r<=1e-9) return [full(n)];
    if(r>=12-1e-9) return [[...full(n), r]];
    const shared=[...full(n-1), (S+r)/2, (S+r)/2];
    return strip12 ? [shared, [...full(n-1), S+r-12, 12]] : [shared];
  };
  const group=list=>{ const g=new Map(); list.forEach(([a,b])=>{ const key=a.toFixed(4)+"x"+b.toFixed(4);
    const o=g.get(key)||{w:a,h:b,n:0}; o.n++; g.set(key,o); }); return [...g.values()]; };
  const cands=[];
  let eq=null;
  for(let nx=1;nx<=24;nx++) for(let ny=1;ny<=24;ny++){
    if(eq && nx*ny>=eq.nx*eq.ny) continue;
    if(fits(w/nx,h/ny)) eq={nx,ny};
  }
  if(eq) cands.push([{w:w/eq.nx,h:h/eq.ny,n:eq.nx*eq.ny}]);
  const grid=(sw,sh)=>segs(w,sw).forEach(xs=>segs(h,sh).forEach(ys=>{ const out=[];
    xs.forEach(a=>ys.forEach(b=>out.push([a,b]))); cands.push(group(out)); }));
  grid(SW,SL); if(rot) grid(SL,SW);
  const per=(a,b)=>{ const f=(x,y)=>Math.floor((SW+k)/(x+k)+1e-9)*Math.floor((SL+k)/(y+k)+1e-9);
    return Math.max(f(a,b), rot?f(b,a):0); };
  let best=null;
  cands.forEach(pc=>{
    if(pc.some(q=>!fits(q.w,q.h))) return;
    const score=pc.reduce((a,q)=>a+q.n/per(q.w,q.h),0), n=pc.reduce((a,q)=>a+q.n,0);
    if(!best || score<best.score-1e-9 || (Math.abs(score-best.score)<=1e-9 && n<best.n)) best={pc,score,n};
  });
  return best ? best.pc : null;
}
// One sheet, filled with straight through-cuts (guillotine cuts, as on a panel or table saw).
// Every part takes its size plus one saw kerf; the sheet gets one kerf of credit, because the last
// part along an edge needs no cut after it. The first part (in priority order) that fits anywhere
// goes into the leftover where it fits tightest; the leftover is then cut so the bigger offcut stays
// as large as possible. A seed (parts already placed + the leftover pieces) can start the sheet.
function fillSheet(types,left,SW,SL,k,order,seed){
  const rem=left.slice(), placed=seed?seed.placed.slice():[];
  placed.forEach(q=>rem[q.i]--);
  let free=seed?seed.free.slice():[{x:0,y:0,w:SW+k,h:SL+k}];
  for(;;){
    let best=null;
    for(const i of order){
      if(rem[i]<=0) continue;
      const t=types[i];
      const opts = t.rot && Math.abs(t.w-t.h)>1e-9 ? [[t.w,t.h,0],[t.h,t.w,1]] : [[t.w,t.h,0]];
      for(let f=0;f<free.length;f++){ const F=free[f];
        for(const [w,h,r] of opts){
          const a=w+k, b=h+k;
          if(a<=F.w+1e-9 && b<=F.h+1e-9){
            const s1=Math.min(F.w-a,F.h-b), s2=Math.max(F.w-a,F.h-b);
            if(!best || s1<best.s1-1e-9 || (Math.abs(s1-best.s1)<=1e-9 && s2<best.s2-1e-9)) best={i,f,w,h,r,s1,s2};
          }
        }
      }
      if(best) break;
    }
    if(!best) break;
    const F=free[best.f], a=best.w+k, b=best.h+k;
    placed.push({i:best.i, x:F.x, y:F.y, w:best.w, h:best.h, r:best.r});
    rem[best.i]--;
    const A1={x:F.x+a,y:F.y,w:F.w-a,h:F.h}, B1={x:F.x,y:F.y+b,w:a,h:F.h-b};     // rip along the length first
    const A2={x:F.x+a,y:F.y,w:F.w-a,h:b},   B2={x:F.x,y:F.y+b,w:F.w,h:F.h-b};   // cross-cut first
    const ar=q=>q.w*q.h;
    const keep = Math.max(ar(A1),ar(B1)) >= Math.max(ar(A2),ar(B2)) ? [A1,B1] : [A2,B2];
    free.splice(best.f,1,...keep.filter(q=>q.w>1e-9 && q.h>1e-9));
  }
  return placed;
}
// A plain grid of one part type from the corner of a sheet (turned 90° if asked), with the
// leftover pieces: the strip beside the grid (full length), the part above the rows, and the rest
// of a short last row — the cuts that free them are straight through-cuts.
function gridSeed(t,i,n,SW,SL,k,turn){
  const w=turn?t.h:t.w, h=turn?t.w:t.h, a=w+k, b=h+k;
  const cols=Math.floor((SW+k)/a+1e-9), rows=Math.floor((SL+k)/b+1e-9);
  if(cols<1 || rows<1 || n<1) return null;
  const cnt=Math.min(n,cols*rows), placed=[], free=[];
  for(let j=0;j<cnt;j++) placed.push({i, x:(j%cols)*a, y:Math.floor(j/cols)*b, w, h, r:turn?1:0});
  const rowsUsed=Math.ceil(cnt/cols), last=cnt-(rowsUsed-1)*cols;
  const add=(x,y,fw,fh)=>{ if(fw>1e-9 && fh>1e-9) free.push({x,y,w:fw,h:fh}); };
  add(cols*a, 0, SW+k-cols*a, SL+k);
  add(0, rowsUsed*b, cols*a, SL+k-rowsUsed*b);
  if(last<cols) add(last*a, (rowsUsed-1)*b, (cols-last)*a, b);
  return {placed, free, full:cols*rows};
}
const canTurn=t=>t.rot && Math.abs(t.w-t.h)>1e-9;
// All parts of one thickness. Each sheet pattern is the fullest of several tries — a few part
// orders and (in the second run) plain grids of the bigger parts with the leftover filled — then
// repeated as many times as the parts still to cut allow, so 500 crates cost no more to work out
// than one. The run that needs the fewest sheets wins, and the result is never worse than cutting
// each part type on sheets of its own.
function nestRun(types,SW,SL,k,grids){
  const left=types.map(t=>t.q), idx=types.map((t,i)=>i);
  const orders=[
    idx.slice().sort((a,b)=>types[b].w*types[b].h-types[a].w*types[a].h),
    idx.slice().sort((a,b)=>Math.max(types[b].w,types[b].h)-Math.max(types[a].w,types[a].h)),
    idx.slice().sort((a,b)=>Math.min(types[b].w,types[b].h)-Math.min(types[a].w,types[a].h)),
  ];
  const patterns=[]; let sheets=0, guard=0;
  while(left.some(v=>v>0) && guard++<400){
    let best=null;
    const consider=pl=>{ const area=pl.reduce((a,q)=>a+q.w*q.h,0); if(pl.length && (!best || area>best.area+1e-9)) best={pl,area}; };
    for(const o of orders) consider(fillSheet(types,left,SW,SL,k,o));
    if(grids) orders[0].filter(i=>left[i]>0).slice(0,4).forEach(i=>[false,true].forEach(turn=>{
      if(turn && !canTurn(types[i])) return;
      const sd=gridSeed(types[i],i,left[i],SW,SL,k,turn);
      if(sd) consider(fillSheet(types,left,SW,SL,k,orders[0],sd));
    }));
    if(!best) break;                         // nothing fits a fresh sheet (parts are split beforehand)
    const cnt=types.map(()=>0); best.pl.forEach(q=>cnt[q.i]++);
    let rep=Infinity; cnt.forEach((c,i)=>{ if(c>0) rep=Math.min(rep,Math.floor(left[i]/c)); });
    cnt.forEach((c,i)=>{ left[i]-=c*rep; });
    patterns.push({rep, placed:best.pl, area:best.area});
    sheets+=rep;
  }
  return {sheets, patterns, uncut:left.reduce((a,b)=>a+b,0)};
}
function nestAlone(types,SW,SL,k){
  const patterns=[]; let sheets=0;
  const area=pl=>pl.reduce((a,q)=>a+q.w*q.h,0);
  for(let i=0;i<types.length;i++){
    const t=types[i];
    const g=[gridSeed(t,i,Infinity,SW,SL,k,false), canTurn(t)?gridSeed(t,i,Infinity,SW,SL,k,true):null]
      .filter(Boolean).sort((x,y)=>y.placed.length-x.placed.length)[0];
    if(!g) return null;                      // a part bigger than the sheet
    const per=g.placed.length, full=Math.floor(t.q/per), rest=t.q-full*per, turn=g.placed[0].r===1;
    if(full) patterns.push({rep:full, placed:g.placed, area:area(g.placed)});
    if(rest){ const r=gridSeed(t,i,rest,SW,SL,k,turn); patterns.push({rep:1, placed:r.placed, area:area(r.placed)}); }
    sheets+=full+(rest?1:0);
  }
  return {sheets, patterns, uncut:0};
}
function nestParts(types,SW,SL,k){
  const runs=[nestRun(types,SW,SL,k,false), nestRun(types,SW,SL,k,true), nestAlone(types,SW,SL,k)]
    .filter(r=>r && !r.uncut).sort((x,y)=>x.sheets-y.sheets || x.patterns.length-y.patterns.length);
  const r = runs[0] || nestRun(types,SW,SL,k,false);       // all runs left parts uncut: report it
  const area=types.reduce((a,t)=>a+t.w*t.h*t.q,0);
  return {sheets:r.sheets, patterns:r.patterns, used: r.sheets? area/(r.sheets*SW*SL) : 0, uncut:r.uncut};
}
// plywood parts of one unit → sheet layouts per thickness, for one unit and for n units.
// An order is never laid out worse than cutting the units one at a time.
const plyMemo=new Map();
function cutPlywood(parts,n,SW,SL,k){
  const key=JSON.stringify([parts,n,SW,SL,k]);
  if(plyMemo.has(key)) return plyMemo.get(key);       // unchanged since the last keystroke
  const byTh=new Map();
  parts.forEach(q=>{ if(!byTh.has(q.th)) byTh.set(q.th,[]); byTh.get(q.th).push(q); });
  const unit=[], order=[];
  [...byTh.entries()].sort((a,b)=>a[0]-b[0]).forEach(([th,list])=>{
    const types=[];                          // identical pieces become one type
    list.forEach(q=>{
      const key=[Math.round(q.w*1e4),Math.round(q.h*1e4),q.rot?1:0].join("|");
      let t=types.find(x=>x.key===key);
      if(!t){ t={key,w:q.w,h:q.h,rot:q.rot,q:0,labels:{}}; types.push(t); }
      t.q+=q.q; t.labels[q.label]=(t.labels[q.label]||0)+q.q;
    });
    const u={th, types, ...nestParts(types,SW,SL,k)};
    unit.push(u);
    if(n===1){ order.push(u); return; }
    const typesN=types.map(t=>({...t,q:t.q*n}));
    let r=nestParts(typesN,SW,SL,k);
    if(r.uncut || r.sheets>u.sheets*n)
      r={sheets:u.sheets*n, patterns:u.patterns.map(pt=>({...pt,rep:pt.rep*n})), used:u.used, uncut:u.uncut*n};
    order.push({th, types:typesN, ...r});
  });
  if(plyMemo.size>=8) plyMemo.clear();
  plyMemo.set(key,{unit, order});
  return plyMemo.get(key);
}
// lumber pieces for n units, one line per size — what to cut, or to order cut to length
function lumberCuts(bom,n){
  const g=new Map();
  bom.forEach(b=>{ if(!b.cut) return;
    const c=b.cut, key=[c.t,c.w,c.len].map(v=>Math.round(v*1e4)).join("x")+"|"+(c.op||"");
    let o=g.get(key);
    if(!o){ o={t:c.t,w:c.w,len:c.len,op:c.op||"",q:0,uses:new Map()}; g.set(key,o); }
    o.q+=b.q; o.uses.set(b.use,(o.uses.get(b.use)||0)+b.q);
  });
  return [...g.values()].sort((a,b)=>b.t-a.t||b.w-a.w||b.len-a.len)
    .map(o=>({...o, qN:o.q*n, bfN:o.q*n*o.t*o.w*o.len/144}));
}
