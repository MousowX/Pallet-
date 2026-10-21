/* ================= PALLET DETAILS — plank gaps, spacing, fork openings ================= */
// Members spread evenly with both end members flush to the edge — the same rule the drawing uses.
function spacing(n,w,span){
  const cc = n>1 ? (span-w)/(n-1) : 0;
  return {n, w, span, cc, gap: n>1 ? cc-w : 0, cov: Math.min(1, n*w/span), over: n*w > span+0.01};
}
// longest stretch of [a,b] that none of the intervals covers
function clearRun(a,b,ivs){
  let segs=[[a,b]];
  ivs.forEach(([u,v])=>{
    segs=segs.flatMap(([s,e])=> (v<=s||u>=e) ? [[s,e]]
      : [[s,Math.min(e,u)],[Math.max(s,v),e]].filter(q=>q[1]-q[0]>1e-6));
  });
  return segs.reduce((mx,q)=>Math.max(mx,q[1]-q[0]),0);
}
function palletDetails(m){
  const p=m.p, L=m.L, W=m.W, isBox=p.type==="box", bk=p.base||p.type;
  const groups=[], warn=[];
  const G=t=>{ const g={title:t,items:[]}; groups.push(g); return g; };
  const pct=v=>Math.round(Math.round(v*1e6)/1e4)+"%";
  const lapMax=v=>inch(Math.floor(Math.max(0,v)*16)/16);   // round down — a lap must never reach the opening
  const size=(...a)=>a.map(v=>inch(v).slice(0,-1)).join(" × ")+"″";   // 0.75 × 5.5 × 40″
  const count=(n,one,many)=>`${n} ${n===1?one:many}`;
  const gC=G("CONFIGURATION");                    // filled last: the entry type depends on the openings

  // ---- decks: board sizes, gaps between boards, centre-to-centre, coverage ----
  // read from the real board positions, so wider end boards and grouped bottom boards come out right
  const deckStats=iv=>{
    const widths=iv.map(([a,b])=>b-a), gaps=[];
    for(let i=1;i<iv.length;i++) gaps.push(iv[i][0]-iv[i-1][1]);
    const sum=Math.round(widths.reduce((a,b)=>a+b,0)*1e6)/1e6;
    return {n:iv.length, widths, gaps, sum, cov:Math.min(1,sum/L),
            over: gaps.some(g=>g<-0.01) || sum>L+0.01,
            even: gaps.every(g=>Math.abs(g-gaps[0])<1/32)};
  };
  const deckRows=(g,iv,t,what,notes={})=>{
    const s=deckStats(iv);
    if(s.over) warn.push(`${what}: ${s.n} boards need ${inch(s.sum)}, the pallet is ${inch(L)}`);
    const wE=s.widths[0], wI=s.n>2 ? s.widths[1] : wE, mixed=Math.abs(wE-wI)>1e-6;
    if(mixed){
      g.items.push({k:"2 end boards", v:size(t,wE,W)});
      g.items.push({k:count(s.n-2,"inner board","inner boards"), v:size(t,wI,W), note:notes.inner});
    } else g.items.push({k:count(s.n,"board","boards"), v:size(t,wE,W), note:notes.all||notes.inner});
    if(s.n>1){
      if(s.over) g.items.push({k:"Gap between boards", v:"overlap", bad:true});
      else if(s.even){
        g.items.push({k:"Gap between boards", v:inch(s.gaps[0])});
        if(!mixed) g.items.push({k:"Center to center", v:inch(s.gaps[0]+wE)});
        else if(s.n>3) g.items.push({k:"C-C, inner boards", v:inch(s.gaps[0]+wI)});
      } else g.items.push({k:"Gaps, end to end", v:s.gaps.map(inch).join(" · ")});
    }
    g.items.push({k:"Coverage", v:pct(s.cov)});
    return s;
  };
  const gT=G(isBox?"BOX FLOOR":"TOP DECK");
  let top=null, bot=null;
  if(!isBox || p.hasB) top=deckRows(gT,p.topIv,p.dT,isBox?"floor deck":"top deck");
  if(isBox && p.hasP) gT.items.push({k:"Plywood floor", v:inch(p.fPT)+" sheet",
    note:p.hasB?"over the deckboards — no gaps":"continuous — no gaps"});
  const gB=G("BOTTOM DECK");
  if(p.bC>0) bot=deckRows(gB,p.botIv,p.bT,"bottom deck",
      p.botMode==="columns" ? {all:"one under each block column", inner:"centered under the inner block columns"}
    : p.botMode==="columns-even" ? {all:"one per block column, equal gaps", inner:"equal gaps — too wide to center under the blocks"}
    : p.botMode==="notch"   ? {inner:"grouped between the notches"} : {});
  else gB.items.push({k:"Boards", v:"None", note:"single-face"});
  if(p.botNoFit) warn.push(`bottom deck: ${p.botNoFit.k} inner boards need ${inch(p.botNoFit.need)} between the notches, only ${inch(p.botNoFit.room)} there — spaced evenly instead`);
  const botIv = p.botIv;

  // ---- structure under the deck, and the fork openings it leaves ----
  // an opening is n × width, from `bottom` to `top` (inches above the floor). On a skirted box the
  // panel lap can cut into it: the ends use the end-panel lap, the sides the side-panel lap.
  const skirt = isBox && p.attach==="skirt";
  const open=(n,width,bottom,top,lap)=>{
    const t=Math.min(top, skirt ? p.baseH-lap : Infinity);
    return {n,width,bottom,top,h:Math.max(0,t-bottom),hBase:top-bottom,skirt:t<top-1e-6};
  };
  let f40, f48=null;
  if(bk==="stringer"){
    const s=spacing(p.sC,p.sB,W), g=G("STRINGERS");
    if(s.over) warn.push(`stringers: ${s.n}×${inch(s.w)} exceeds ${inch(W)}`);
    g.items.push({k:count(s.n,"stringer","stringers"), v:size(p.sB,p.sH,L)});
    g.items.push({k:"Center to center", v:inch(s.cc)});
    g.items.push({k:"Clear between", v:s.over?"overlap":inch(s.gap), bad:s.over});
    f40=open(p.sC-1, s.gap, p.y0, p.y0+p.sH, p.lapE);
    if(p.notch){
      const nx=p.notchX;
      if(nx[0]+p.notchL>nx[1]) warn.push(`notches overlap on a ${inch(L)} stringer`);
      else if(p.notchFit===false) warn.push(`notches don't fit: 2 × ${inch(p.notchL)} + ${inch(p.notchGap)} between = ${inch(2*p.notchL+p.notchGap)}, the stringer is ${inch(L)} — notches drawn at the ends`);
      if(p.notchD>=p.sH) warn.push(`notch depth ${inch(p.notchD)} cuts through the ${inch(p.sH)} stringer`);
      g.items.push({k:"2 notches each", v:`${inch(p.notchL)} long × ${inch(p.notchD)} deep`});
      g.items.push({k:"Notch position", v:`${inch(nx[0])} from each end`});
      const btw=nx[1]-(nx[0]+p.notchL);
      g.items.push({k:"Between notches", v: btw>1e-6 ? inch(btw) : btw<-1e-6 ? "overlap" : "0″", bad: btw<=1e-6,
                    note: btw>1e-6 ? `${inch(nx[1]-nx[0])} center to center` : btw<-1e-6 ? undefined : "the notches meet"});
      if(Math.abs(btw)<=1e-6) warn.push("the two notches meet in the middle — no full-height wood between them");
      g.items.push({k:"Wood left at notch", v:inch(Math.max(0,p.sH-p.notchD)), bad:p.notchD>=p.sH});
      // a bottom deckboard inside the notch leaves the forks only the notch depth above it
      const clr=Math.min(...nx.map(x=>clearRun(x,x+p.notchL,botIv)));
      const under=clr<p.notchL-1e-6;
      f48=open(2, p.notchL, under?p.y0:0, p.y0+p.notchD, p.lapS);
      Object.assign(f48,{notch:true, under, floorClear:clr});
      if(under) warn.push(`bottom board under a notch — side fork entry only ${inch(f48.hBase)} high over the board`);
    }
  }else{
    const sL=spacing(p.nBL,p.k,L), sW=spacing(p.nBW,p.k,W), g=G("BLOCKS");
    if(sL.over) warn.push(`blocks along length: ${sL.n}×${inch(p.k)} exceeds ${inch(L)}`);
    if(sW.over) warn.push(`blocks along width: ${sW.n}×${inch(p.k)} exceeds ${inch(W)}`);
    g.items.push({k:count(p.nBL*p.nBW,"block","blocks"), v:size(p.k,p.k,p.kH),
      note:`${p.nBL} along length × ${p.nBW} along width`});
    g.items.push({k:"Clear along length", v:sL.over?"overlap":inch(sL.gap), bad:sL.over});
    g.items.push({k:"C-C along length",   v:inch(sL.cc)});
    g.items.push({k:"Clear along width",  v:sW.over?"overlap":inch(sW.gap), bad:sW.over});
    g.items.push({k:"C-C along width",    v:inch(sW.cc)});
    let wEnd=sW.gap;
    if(p.sbC>0){
      g.items.push({k:count(p.sbC,"stringer board","stringer boards"), v:size(p.sbT,p.sbW,L), note:"one on each block row"});
      wEnd=Math.min(wEnd, spacing(p.sbC,p.sbW,W).gap);
    } else g.items.push({k:"Stringer boards", v:"None", note:"deck nailed straight to the blocks"});
    f40=open(p.nBW-1, wEnd, p.y0, p.y0+p.kH+p.sbT, p.lapE);
    f48=open(p.nBL-1, sL.gap, 0, p.y0+p.kH, p.lapS);
    if(bot){          // bottom boards are wider than the blocks, so the slot is narrower right at the floor
      const xs=spread(p.nBL,L,p.k), fw=clearRun(xs[0]+p.k/2, xs[1]-p.k/2, botIv);
      if(fw<sL.gap-1e-6) f48.floorW=fw;
    }
  }

  // ---- fork entry, per face ----
  const gF=G("FORK ENTRY");
  const face=(k,f,panel)=>{
    if(!f){ gF.items.push({k, v:"None", note:"stringers are not notched"}); return; }
    if(f.h<=0.01){ gF.items.push({k, v:"Blocked", bad:true, note:`${panel} lap covers the openings`}); return; }
    let note = f.notch ? (f.under ? `bottom board under the notch — only ${inch(f.floorClear)} of ${inch(f.width)} clear at the floor`
                                  : "through the notches, from the floor")
                       : (f.bottom>0 ? "over the bottom deck" : "from the floor");
    if(f.floorW!=null) note+=` · ${inch(f.floorW)} wide between the bottom boards`;
    if(f.skirt) note=`${panel} lap cuts it from ${inch(f.hBase)} high · `+note;
    gF.items.push({k, v:`${f.n} × ${inch(f.width)} W × ${inch(f.h)} H`, bad:!!(f.skirt||f.under), note});
  };
  face(`Ends · ${inch(W)} face`, f40, "End-panel");
  face(`Sides · ${inch(L)} face`, f48, "Side-panel");
  if(skirt){
    // "covers" only when nothing is left; otherwise say how much opening the lap leaves
    const lapWarn=(f,face)=>`${face}-panel lap ${f.h<=0.01 ? "covers" : "lowers"} the ${face} fork openings`+
      (f.h<=0.01 ? "" : ` to ${inch(f.h)}`)+` — a${face==="end"?"n":""} ${face} lap ≤ ${lapMax(p.baseH-f.top)} keeps them clear`;
    if(f40.skirt) warn.push(lapWarn(f40,"end"));
    if(f48 && f48.skirt) warn.push(lapWarn(f48,"side"));
  }

  // ---- configuration ----
  // a face counts only with its full opening; one that a panel lap merely lowers is called that, not
  // "covered" (the face rows give the height left, the warnings the lap that keeps it clear)
  const use40 = f40.h>0.01 && !f40.skirt;
  const use48 = !!f48 && f48.h>0.01 && !f48.skirt && !f48.under;
  const low40 = f40.h>0.01 && f40.skirt, low48 = !!f48 && f48.h>0.01 && f48.skirt && !f48.under;
  let entry = use40&&use48 ? (bk==="block"?"4-way":"Partial 4-way (notched)")
            : use40 ? (f48?"2-way — side entry restricted":"2-way")
            : use48 ? "2-way — sides only"
            : low40||low48 ? "Restricted — the panel laps lower the openings" : "None — openings covered";
  if(use40 && low48) entry+=" · side openings lowered by the panel lap";
  if(use48 && low40) entry+=" · end openings lowered by the panel lap";
  gC.items.push({k:"Class", v: isBox?`Pallet box · ${bk} base`:(bk==="stringer"?"Stringer pallet":"Block pallet")});
  gC.items.push({k:"Fork entry", v:entry, bad:!(use40||use48) || (!!f48 && !use48)});
  if(!isBox) gC.items.push({k:"Faces", v: !bot ? "Single-face"
      : (p.bT===p.dT && p.botIv.length===p.topIv.length && p.botIv.every((b,i)=>{ const t=p.topIv[i];
            return Math.abs((b[1]-b[0])-(t[1]-t[0]))<1e-6 && Math.abs(b[0]-t[0])<0.5; })
          ? "Double-face, reversible" : "Double-face, non-reversible")});
  return {title:isBox?"BASE & FLOOR DETAILS":"PALLET DETAILS", groups, warn, top, bot, f40, f48, entry};
}

