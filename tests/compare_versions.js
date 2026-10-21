// Same designs, two versions of the tool: everything a person reads must come out the same.
// Use it when restructuring or refactoring: the baseline is the approved version in ../history,
// the candidate is your working file. Any difference is listed with the first example of it.
//
// Usage: node compare_versions.js [baseline.html] [candidate.html] [N]
//   defaults: the newest approved version in ../history (highest number, not REVERTED or SUPERSEDED)
//   vs ../pallet-lab.html, 600 designs. After each approved release, copy the file into ../history with
//   the next number (11_YYYY-MM-DD_master.html) and it becomes the baseline.
//
// It compares: capacities, bill of materials, details panel, warnings, size line, cut list panel,
// printed spec sheet and printed cut list (dates ignored), and what a saved design file contains.
// It relies on these element ids and page functions; if a restructure renames them, update this list:
//   ids: cards, bom, det, warn, vpDims, cutList, spec, cutSheet
//   functions: applyState, collectState, buildModel, flushSpec, buildCutSheet
// Drawings are compared in the browser: browser/compare_drawings.py.
const path=require('path');
const {load}=require('./harness');
const args=process.argv.slice(2), files=args.filter(a=>/\.html?$/i.test(a));
const fs=require('fs'), HIST=path.join(__dirname,'..','history');
const newest=()=>{ const f=fs.readdirSync(HIST).filter(n=>/^\d+_.*\.html?$/i.test(n) && !/REVERTED|SUPERSEDED/i.test(n))
  .sort((a,b)=>parseInt(a)-parseInt(b)); return f.length ? path.join(HIST,f[f.length-1]) : null; };
const BASE=files[0]||newest();
const CAND=files[1]||path.join(__dirname,'..','pallet-lab.html');
const N=+(args.find(a=>/^\d+$/.test(a))||600);
const A=load(BASE), B=load(CAND);

let seed=20261017; const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
const pick=a=>a[Math.floor(rnd()*a.length)], num=(lo,hi,st)=>+(lo+Math.floor(rnd()*((hi-lo)/st+1))*st).toFixed(4);
const design=()=>({
  L:num(24,96,1),W:num(24,60,1),dCount:num(2,12,1),dWidth:num(2.5,7.25,0.25),dLead:pick(['',num(3.5,7.25,0.25)]),dThk:pick([0.5,0.625,0.75,1]),
  bCount:num(0,9,1),bWidth:num(2.5,7.25,0.25),bLead:pick(['',num(3.5,7.25,0.25)]),bThk:pick([0.5,0.75]),bLay:pick(['notch','even']),
  sCount:num(2,5,1),sThk:pick([1.25,1.5,2,3.5]),sHgt:pick([2.5,3.5,4,5.5]),sNotch:pick(['1','1','0']),nLen:num(6,12,0.5),nDep:pick([1,1.25,1.5,2]),nGap:num(0,40,0.5),
  kNL:num(2,5,1),kNW:num(2,5,1),kSize:pick([3,3.5,4,5.5]),kHgt:pick([3,3.5,4]),kSBon:pick(['1','0']),kSBt:pick([0.75,1]),kSBw:pick([3.5,4,5.5]),
  boxBase:pick(['stringer','block']),floorType:pick(['boards','ply','plyboards']),floorPlyT:pick(['0.375','0.5','0.625','0.75']),
  wH:num(12,60,1),plyT:pick(['0.25','0.375','0.5','0.625','0.75']),cleatT:pick([0.75,1]),cleatW:pick([2.5,3.5,5.5]),clSp:num(12,36,1),
  edgeCl:pick(['in','out']),clOrient:pick(['v','h']),attach:pick(['skirt','surface']),sideOv:num(0,6,0.25),endOv:num(0,6,0.25),boxLid:pick(['1','0']),
  cleatMat:pick(['lumber','ply']),orderQty:pick([1,1,3,25,500]),sheetW:pick([48,48,60]),sheetL:pick([96,96,120]),kerf:pick([0.125,0.125,0,0.25]),
  species:pick(['0','1']),Fb:pick([850,1000,1200]),E:pick([1100000,1300000]),Fc:pick([1310,1400]),SF:pick([1.5,2]),defPct:pick([1,0.5]),
  bearing:pick([2,3]),forkSp:pick([24,30]),client:pick(['','ACME / Foxconn','Peñoles']),partNo:pick(['','CR-4840','Caja #3'])});
const undate=s=>s.replace(/Generated [^·]*·/g,'Generated ·');
const snap=T=>{ const g=i=>{ const e=T.d.getElementById(i); return e?e.textContent.replace(/\s+/g,' ').trim():'(missing #'+i+')'; };
  T.w.eval('flushSpec()'); T.w.eval('buildCutSheet(buildModel())');
  return {capacities:g('cards'), 'bill of materials':g('bom'), details:g('det'), warnings:g('warn'), 'size line':g('vpDims'),
          'cut list':g('cutList'), 'printed spec sheet':undate(g('spec')), 'printed cut list':undate(g('cutSheet'))}; };

setTimeout(()=>{
  let same=0; const diff={}, ex={};
  for(let i=0;i<N;i++){
    const type=pick(['stringer','block','box','box']);
    const st={fmt:'pallet-lab/1', type, f:Object.fromEntries(Object.entries(design()).map(([k,v])=>[k,String(v)]))};
    const keys=[];
    let a, b;
    try{ A.w.eval('applyState('+JSON.stringify(st)+',"")'); a=snap(A); }catch(e){ console.log('baseline could not open design #'+i+': '+e.message); continue; }
    try{ B.w.eval('applyState('+JSON.stringify(st)+',"")'); b=snap(B); }catch(e){ keys.push('candidate error'); b={}; ex['candidate error']=ex['candidate error']||{i,type,a:'',b:e.message}; }
    for(const k in a) if(a[k]!==b[k]) keys.push(k);
    // a saved file must hold the same values (new fields in the candidate are fine)
    const sa=A.w.eval('collectState()'), sb=(()=>{ try{ return B.w.eval('collectState()'); }catch(e){ return {f:{}}; } })();
    if(sb.fmt!==sa.fmt || sb.type!==sa.type || Object.keys(sa.f).some(k=>sb.f[k]!==sa.f[k])) keys.push('saved design file');
    if(!keys.length){ same++; continue; }
    keys.forEach(k=>{ diff[k]=(diff[k]||0)+1;
      if(!ex[k]){ const x=String(a[k]||''), y=String(b[k]||''); let j=0; while(j<x.length && x[j]===y[j]) j++;
        ex[k]={design:i, type, baseline:x.slice(Math.max(0,j-60),j+120), candidate:y.slice(Math.max(0,j-60),j+120)}; } });
  }
  console.log(`baseline:  ${path.basename(BASE)}\ncandidate: ${path.basename(CAND)}`);
  console.log(`designs compared: ${N} · identical: ${same} · with differences: ${N-same}`);
  for(const k in diff){ console.log(` - ${k}: ${diff[k]} designs`); if(ex[k]) console.log(`     first: design #${ex[k].design} (${ex[k].type})\n     baseline:  …${ex[k].baseline}…\n     candidate: …${ex[k].candidate}…`); }
  const errs=[...A.errors, ...B.errors];
  console.log(`page errors: ${errs.length?errs.slice(0,3):'none'}`);
  console.log(`failed checks: ${Object.keys(diff).length}`);
  process.exitCode = (Object.keys(diff).length || B.errors.length) ? 1 : 0;
},700);
