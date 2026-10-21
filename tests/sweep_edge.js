// Random-design sweep: drives the real page through hundreds of designs and checks every output
// for runtime errors, non-finite numbers, and internal contradictions.
const {load}=require('./harness');
const path=require('path'), args=process.argv.slice(2);
const FILE=args.find(a=>/\.html?$/i.test(a))||path.join(__dirname,'..','pallet-lab.html');
const N=+(args.find(a=>/^\d+$/.test(a))||800);
const T=load(FILE);

let seed=424242; const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
const pick=a=>a[Math.floor(rnd()*a.length)];
const EDGE=["","0","-2","0.1","1","2","300","abc"]; const num=(lo,hi,step)=> rnd()<0.25 ? pick(EDGE) : +(lo+Math.floor(rnd()*((hi-lo)/step+1))*step).toFixed(4);

setTimeout(()=>{
  const fails=[]; const stats={designs:0, withWarn:0, byType:{}};
  const w=T.w;
  for(let i=0;i<N;i++){
    const type=pick(['stringer','block','box']);
    const st={
      L:num(24,96,1), W:num(24,60,1),
      dCount:num(2,12,1), dWidth:num(2.5,7.25,0.25), dLead:pick(['', num(3.5,7.25,0.25)]), dThk:pick([0.5,0.625,0.75,1]),
      bCount:num(0,9,1), bWidth:num(2.5,7.25,0.25), bLead:pick(['', num(3.5,7.25,0.25)]), bThk:pick([0.5,0.75]),
      bLay:pick(['notch','even']),
      sCount:num(2,5,1), sThk:pick([1.25,1.5,2,3.5]), sHgt:pick([2.5,3.5,4,5.5]), sNotch:pick(['1','0']),
      nLen:num(6,12,0.5), nDep:pick([1,1.25,1.5,2]), nGap:num(0,40,0.5),
      kNL:num(2,5,1), kNW:num(2,5,1), kSize:pick([3,3.5,4,5.5]), kHgt:pick([3,3.5,4]), kSBon:pick(['1','0']),
      kSBt:pick([0.75,1]), kSBw:pick([3.5,4,5.5]),
      boxBase:pick(['stringer','block']), floorType:pick(['boards','ply','plyboards']), floorPlyT:pick(['0.375','0.5','0.75']),
      wH:num(12,48,1), plyT:pick(['0.25','0.375','0.5','0.75']), cleatT:pick([0.75,1]), cleatW:pick([2.5,3.5,5.5]),
      clSp:num(12,36,1), edgeCl:pick(['in','out']), clOrient:pick(['v','h']), attach:pick(['skirt','surface']),
      sideOv:num(0,6,0.25), endOv:num(0,6,0.25), boxLid:pick(['1','0']),
      species:pick(['0','1']),
      cleatMat:pick(['lumber','ply']), orderQty:num(1,500,1), sheetW:num(24,60,1), sheetL:num(48,144,1), kerf:num(0,0.5,0.0625),
    };
    const state={fmt:'pallet-lab/1', type, f:Object.fromEntries(Object.entries(st).map(([k,v])=>[k,String(v)]))};
    let label=`#${i} ${type} ${JSON.stringify(st)}`;
    try{
      w.eval('applyState('+JSON.stringify(state)+',"sweep")');
      const m=w.eval('buildModel()'), a=w.eval('analyze(buildModel())');
      const p=m.p, det=m.det;
      stats.designs++; stats.byType[type]=(stats.byType[type]||0)+1;
      const bad=[];
      // 1. every number finite
      ['totBF','totSF','weight','H','nails'].forEach(k=>{ if(!Number.isFinite(m[k])) bad.push(`${k}=${m[k]}`); });
      a.modes.forEach(x=>{ if(!Number.isFinite(x.cap)||x.cap<0) bad.push(`cap ${x.t}=${x.cap}`); if(!Number.isFinite(x.defl)) bad.push(`defl ${x.t}=${x.defl}`); });
      m.bom.forEach(b=>{ if(!(Number.isInteger(b.q)&&b.q>=0)) bad.push(`bom q ${b.d}=${b.q}`);
                         if(b.bf!=null && !Number.isFinite(b.bf)) bad.push(`bom bf ${b.d}`);
                         if((b.bf!=null && b.bf<0) || (b.sf!=null && b.sf<0)) bad.push(`negative amount ${b.d}`);
                         if(/NaN|undefined|Infinity/.test(b.d)) bad.push(`bom text ${b.d}`); });
      // 2. no NaN/undefined/Infinity anywhere a person reads
      w.eval('flushSpec()'); w.eval('buildCutSheet(buildModel())');
      const text=[T.d.getElementById('det').textContent, T.d.getElementById('bom').textContent,
                  T.d.getElementById('cards').textContent, T.d.getElementById('vpDims').textContent,
                  T.d.getElementById('warn').textContent, T.d.getElementById('spec').textContent,
                  T.d.getElementById('cutList').textContent, T.d.getElementById('cutSheet').textContent].join(' ');
      ['NaN','undefined','Infinity','null'].forEach(s=>{ if(text.includes(s)) bad.push(`text contains ${s}`); });
      // 2b. cut list: every plywood part placed, sheet counts sane, lumber adds up to the BOM
      m.cut.ply.forEach(sh=>{ if(sh.uncut) bad.push(`${sh.uncut} plywood parts not placed`);
        sh.types.forEach(t=>{ if(!(t.w>0&&t.h>0)) bad.push(`plywood part ${t.w}×${t.h}`); });
        if(!(Number.isInteger(sh.sheets)&&sh.sheets>=1)) bad.push(`sheets ${sh.sheets}`); });
      if(Math.abs(m.cut.bfN-m.totBF*m.cut.N)>1e-6*Math.max(1,m.cut.bfN)) bad.push(`cut list BF ${m.cut.bfN} vs ${m.totBF*m.cut.N}`);
      if(!(Number.isInteger(m.cut.N)&&m.cut.N>=1)) bad.push(`order qty ${m.cut.N}`);
      if((m.totSF>0) !== (m.cut.ply.length>0)) bad.push('plywood in BOM but no sheets (or the reverse)');
      // 3. board counts and widths agree between the model and the BOM
      const sumQ=re=>m.bom.filter(b=>re.test(b.d)).reduce((s,b)=>s+b.q,0);
      const topLabel = type==='box' ? /^Floor deck/ : /^Top deck/;
      const expTop = (type==='box' && p.floorType==='ply') ? 0 : p.topIv.length;
      if(sumQ(topLabel)!==expTop) bad.push(`top boards BOM ${sumQ(topLabel)} vs model ${expTop}`);
      if(sumQ(/^Bottom deck/)!==p.botIv.length) bad.push(`bottom boards BOM ${sumQ(/^Bottom deck/)} vs model ${p.botIv.length}`);
      if(p.botIv.length!==p.bC) bad.push(`bottom count ${p.botIv.length} vs bC ${p.bC}`);
      // 4. boards stay inside the pallet; overlaps must raise a warning
      const warnTxt=w.document.getElementById('warn').textContent;
      [['top deck',p.topIv],['bottom deck',p.botIv]].forEach(([nm,iv])=>{
        iv.forEach(([s,e])=>{ if(e-s<=0) bad.push(`${nm} zero-width board`); });
        const overlap=iv.some((b,j)=>j>0 && b[0]<iv[j-1][1]-0.01) || iv.some(([s,e])=>s<-0.01||e>m.L+0.01);
        const needWarn = overlap && (nm!=='top deck' || type!=='box' || p.hasB);
        if(needWarn && !/deck/.test(warnTxt)) bad.push(`${nm} overlaps but no warning`);
      });
      // 5. fork openings never taller than the structure that makes them
      [det.f40, det.f48].forEach((f,j)=>{ if(!f) return;
        if(!(f.h>=0 && f.h<=f.hBase+1e-9)) bad.push(`opening ${j} h=${f.h} hBase=${f.hBase}`);
        if(!Number.isFinite(f.width)) bad.push(`opening ${j} width ${f.width}`); });
      // 5b. notches: centred, the chosen space apart; too long for the stringer → warned
      if(p.notch && p.notchX && p.notchX.length){
        const e0=p.notchX[0], e1=m.L-p.notchX[1]-p.notchL, gapNow=p.notchX[1]-p.notchX[0]-p.notchL;
        if(Math.abs(e0-e1)>1e-6) bad.push(`notches not centred ${e0} vs ${e1}`);
        if(p.notchFit && Math.abs(gapNow-p.notchGap)>1e-6) bad.push(`space between ${gapNow} vs input ${p.notchGap}`);
        if(!p.notchFit && !/don't fit|overlap/.test(warnTxt)) bad.push('notches too long for the stringer, no warning');
        if(e0<-1e-9) bad.push(`notch off the end ${e0}`);
      }
      // 6. a notched base with a board under a notch must say so
      if(det.f48 && det.f48.under && !/under a notch/.test(warnTxt)) bad.push('board under notch without warning');
      // 7. a skirt that cuts an opening must say so
      if(det.f40 && det.f40.skirt && !/end-panel lap/.test(warnTxt)) bad.push('end lap cuts opening without warning');
      if(det.f48 && det.f48.skirt && !/side-panel lap/.test(warnTxt)) bad.push('side lap cuts opening without warning');
      // 8. box: cleat counts agree with the panels (2 edge cleats per panel in horizontal mode)
      if(type==='box'){
        const vert=sumQ(/^Vertical cleat|^Edge cleat/);
        const exp = p.orient==='v' ? (p.pHS-2*p.cw>1e-9?2*p.nVL:0)+(p.pHE-2*p.cw>1e-9?2*p.nVW:0) : 8;
        if(vert!==exp) bad.push(`upright cleats BOM ${vert} vs ${exp}`);
        if(p.attach==='surface' && (p.lapS!==0||p.lapE!==0)) bad.push('on-deck box has a lap');
        if(Math.abs(p.pHS-(p.wH+p.lapS))>1e-9 || Math.abs(p.pHE-(p.wH+p.lapE))>1e-9) bad.push('panel height mismatch');
      }
      // 9. the drawing runs on screen size and paper size without throwing
      w.eval('drawSpec2D(document.getElementById("cv").getContext("2d"),900,700,buildModel(),PAL_SCREEN,18)');
      w.eval('printDrawingPNG(buildModel())');
      if(warnTxt.trim()) stats.withWarn++;
      if(bad.length) fails.push(label+'\n     → '+bad.join(' | '));
    }catch(e){ fails.push(label+'\n     → EXCEPTION '+e.message+'\n'+(e.stack||'').split('\n').slice(0,3).join('\n')); }
  }
  console.log(`designs run: ${stats.designs}  by type: ${JSON.stringify(stats.byType)}  with warnings: ${stats.withWarn}`);
  console.log(`runtime errors (page): ${T.errors.length?T.errors.slice(0,5):'none'}`);
  console.log(`failed checks: ${fails.length}`);
  fails.slice(0,12).forEach(f=>console.log(' - '+f));
  process.exitCode = (fails.length || T.errors.length) ? 1 : 0;
},500);
