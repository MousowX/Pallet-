// Sheet-layout checks over random crates: every part on the sheet, no overlaps, a saw kerf between
// neighbours, cleat strips never turned, quantities exact, layouts cuttable with straight through-cuts.
const {load}=require('./harness');
const path=require('path'), args=process.argv.slice(2);
const FILE=args.find(a=>/\.html?$/i.test(a))||path.join(__dirname,'..','pallet-lab.html'), N=+(args.find(a=>/^\d+$/.test(a))||300);
const T=load(FILE);
let seed=99; const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
const pick=a=>a[Math.floor(rnd()*a.length)];
const num=(lo,hi,st)=>+(lo+Math.floor(rnd()*((hi-lo)/st+1))*st).toFixed(4);
function guillotine(rects,x0,y0,x1,y1,depth=0){
  if(rects.length<=1 || depth>200) return rects.length<=1;
  const tryCut=(axis)=>{
    const cands=new Set(rects.map(r=>axis==='x'?r.x+r.w:r.y+r.h));
    for(const c of cands){
      const A=[],B=[]; let ok=true;
      for(const r of rects){
        const s=axis==='x'?r.x:r.y, e=axis==='x'?r.x+r.w:r.y+r.h;
        if(e<=c+1e-6) A.push(r); else if(s>=c-1e-6) B.push(r); else { ok=false; break; }
      }
      if(ok && A.length && B.length) return guillotine(A,x0,y0,x1,y1,depth+1) && guillotine(B,x0,y0,x1,y1,depth+1);
    }
    return null;
  };
  const r=tryCut('x'); if(r!==null) return r;
  const r2=tryCut('y'); if(r2!==null) return r2;
  return false;
}
setTimeout(()=>{
  const w=T.w; const fails=[]; let runs=0, sheetsAll=0, worse=0, areaRuns=0, nestedVsArea={more:0,same:0,less:0}, splices=0, tmax=0;
  for(let i=0;i<N;i++){
    const big=rnd()<0.25;
    const f={L:big?num(60,144,1):num(24,96,1), W:big?num(48,72,1):num(24,60,1), wH:big?num(40,72,1):num(12,48,1),
      dCount:num(3,12,1), dWidth:pick([3.5,5.5]), dLead:'', dThk:0.75, bCount:pick([0,3,5]), bWidth:3.5, bLead:'', bThk:0.75, bLay:'notch',
      sCount:3, sThk:1.5, sHgt:3.5, sNotch:'1', nLen:9, nDep:1.5, nGap:13,
      boxBase:pick(['stringer','block']), kNL:3,kNW:3,kSize:3.5,kHgt:3.5,kSBon:'1',kSBt:0.75,kSBw:3.5,
      floorType:pick(['boards','ply','plyboards']), floorPlyT:pick(['0.375','0.5','0.75']),
      plyT:pick(['0.25','0.375','0.5','0.75']), cleatT:pick([0.5,0.625,0.75]), cleatW:pick([2.5,3.5,5.5]), clSp:num(12,36,1),
      edgeCl:pick(['in','out']), clOrient:pick(['v','h']), attach:pick(['skirt','surface']), sideOv:2.5, endOv:0.75, boxLid:pick(['1','0']),
      cleatMat:pick(['ply','ply','lumber']), sheetW:pick([48,48,48,60,30]), sheetL:pick([96,96,96,120,72]), kerf:pick([0.125,0.125,0,0.25,0.0625]),
      orderQty:pick([1,1,2,7,50,333,2500]), species:'0'};
    const st={fmt:'pallet-lab/1',type:'box',f:Object.fromEntries(Object.entries(f).map(([k,v])=>[k,String(v)]))};
    try{
      const t0=Date.now();
      w.eval('applyState('+JSON.stringify(st)+',"")');
      const m=w.eval('buildModel()');
      tmax=Math.max(tmax,Date.now()-t0);
      runs++;
      const c=m.cut, SW=c.SW, SL=c.SL, k=c.kerf, bad=[];
      splices+=c.splices.length;
      const check=(list,n,tag)=>{
        list.forEach(s=>{
          if(s.uncut) bad.push(`${tag} ${s.th}: ${s.uncut} uncut`);
          const used=s.types.map(()=>0);
          s.patterns.forEach((pt,pi)=>{
            pt.placed.forEach(q=>{
              const t=s.types[q.i];
              if(q.x<-1e-6||q.y<-1e-6||q.x+q.w>SW+1e-6||q.y+q.h>SL+1e-6) bad.push(`${tag} part off the sheet ${JSON.stringify(q)}`);
              const same=Math.abs(q.w-t.w)<1e-6&&Math.abs(q.h-t.h)<1e-6, turned=Math.abs(q.w-t.h)<1e-6&&Math.abs(q.h-t.w)<1e-6;
              if(!same && !(t.rot&&turned)) bad.push(`${tag} wrong size/turned strip`);
              used[q.i]+=pt.rep;
            });
            const P=pt.placed;
            for(let a=0;a<P.length;a++) for(let b=a+1;b<P.length;b++){
              const A=P[a],B=P[b];
              const sep = A.x+A.w+k<=B.x+1e-6 || B.x+B.w+k<=A.x+1e-6 || A.y+A.h+k<=B.y+1e-6 || B.y+B.h+k<=A.y+1e-6;
              if(!sep){ bad.push(`${tag} parts ${a},${b} overlap or closer than the kerf`); a=P.length; break; }
            }
            // guillotine: cuts run through the kerf, so grow each part by the kerf before checking
            const G=P.map(q=>({x:q.x,y:q.y,w:q.w+k,h:q.h+k}));
            if(!guillotine(G,0,0,SW+k,SL+k)) bad.push(`${tag} layout ${pi} not cuttable with straight through-cuts`);
          });
          s.types.forEach((t,i)=>{ if(used[i]!==t.q) bad.push(`${tag} ${s.th} type ${i}: cut ${used[i]} of ${t.q}`); });
          const lb=Math.ceil(s.types.reduce((a,t)=>a+t.w*t.h*t.q,0)/(SW*SL)-1e-9);
          if(s.sheets<lb) bad.push(`${tag} ${s.sheets} sheets below the area bound ${lb}`);
        });
      };
      check(c.plyUnit,1,'unit'); if(c.N>1) check(c.ply,c.N,'order');
      const unitSheets=c.plyUnit.reduce((a,s)=>a+s.sheets,0), orderSheets=c.ply.reduce((a,s)=>a+s.sheets,0);
      sheetsAll+=orderSheets;
      if(c.N>1 && orderSheets>unitSheets*c.N) worse++;
      // compare with the old estimate: ceil(area × 1.1 / 32 ft²) per thickness
      const byTh={}; m.bom.forEach(b=>{ if(b.sf) byTh[b.th]=(byTh[b.th]||0)+b.sf; });
      const old=Object.values(byTh).reduce((a,sf)=>a+Math.ceil(sf*1.1/32),0);
      if(SW===48&&SL===96){ areaRuns++; nestedVsArea[unitSheets>old?'more':unitSheets===old?'same':'less']++; }
      // lumber cut list adds up to the BOM
      const bfCut=c.lumber.reduce((a,o)=>a+o.bfN,0);
      if(Math.abs(bfCut-m.totBF*c.N)>1e-6*Math.max(1,bfCut)) bad.push(`lumber BF ${bfCut} vs ${m.totBF*c.N}`);
      const pcs=c.lumber.reduce((a,o)=>a+o.q,0), pcsB=m.bom.filter(b=>b.bf!=null).reduce((a,b)=>a+b.q,0);
      if(pcs!==pcsB) bad.push(`lumber pieces ${pcs} vs BOM ${pcsB}`);
      const t=w.document.getElementById('cutList').textContent;
      ['NaN','undefined','Infinity','null'].forEach(x=>{ if(t.includes(x)) bad.push('cut list text has '+x); });
      if(bad.length) fails.push(`#${i} ${JSON.stringify(f)}\n   → ${[...new Set(bad)].slice(0,5).join(' | ')}`);
    }catch(e){ fails.push(`#${i} EXCEPTION ${e.message}\n${(e.stack||'').split('\n').slice(0,3).join('\n')}`); }
  }
  console.log(`crates checked: ${runs} · sheets laid out: ${sheetsAll.toLocaleString()} · panels/strips split to fit: ${splices}`);
  console.log(`order layouts worse than cutting units one by one: ${worse}`);
  console.log(`one unit on 48×96, vs the old area estimate (+10%): more sheets ${nestedVsArea.more} · same ${nestedVsArea.same} · fewer ${nestedVsArea.less}  (of ${areaRuns})`);
  console.log(`slowest design: ${tmax} ms · page errors: ${T.errors.length?T.errors.slice(0,3):'none'}`);
  console.log(`failed checks: ${fails.length}`); fails.slice(0,8).forEach(x=>console.log(' - '+x));
  process.exitCode = (fails.length || T.errors.length) ? 1 : 0;
},500);
