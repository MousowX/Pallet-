function buildModel(){
  const L=V("L"), W=V("W");
  const dC=Math.max(2,Math.round(V("dCount"))), dW=V("dWidth"), dT=V("dThk");
  const bC=Math.max(0,Math.round(V("bCount"))), bW=V("bWidth"), bT=V("bThk");
  const dLead=V("dLead")>0 ? V("dLead") : dW;          // end boards: blank = same as the others
  const bLead=V("bLead")>0 ? V("bLead") : bW;
  const bLay=$("bLay").value;
  const topIv=deckBoards(dC,dLead,dW,L);
  const dSum=Math.round(topIv.reduce((a,[s,e])=>a+(e-s),0)*1e6)/1e6;   // total deck width, for the deck's bending strength
  const bom=[];
  let H;
  const N=Math.round(V("orderQty"));          // units in the order — sizes the cut list
  // what comes off plywood sheets for one unit: {label, w (across the sheet), h (along it), th, q, rot}
  // A part bigger than the sheet is split two ways (remainders shared, or cut as 12″ strips); both are
  // laid out and the one needing fewer sheets is used.
  const plyParts=[], splices=[], plyParts12=[], splices12=[];
  let SW=48, SL=96, kerf=0.125;
  const plyPart=(label,w,h,th,q,rot=true)=>{
    [[plyParts,splices,false],[plyParts12,splices12,true]].forEach(([list,sp,s12])=>{
      const pcs=splitToFit(w,h,SW,SL,rot,kerf,s12);
      if(!pcs){ list.push({label,w,h,th,q,rot}); return; }
      sp.push({label,w,h,th,strip:!rot,pieces:pcs});
      pcs.forEach(pc=>list.push({label,w:pc.w,h:pc.h,th,q:q*pc.n,rot}));
    });
  };
  // deck lines grouped by board width, so 5.5″ end boards and 3.5″ inner boards list separately
  const deckBom=(label,iv,t,len)=>{
    const g=new Map();
    iv.forEach(([a,b])=>{ const w=Math.round((b-a)*1e4)/1e4; g.set(w,(g.get(w)||0)+1); });
    [...g.entries()].sort((x,y)=>y[0]-x[0])
      .forEach(([w,q])=>bom.push({q, d:`${label} ${t}×${w}×${len}"`, bf:q*t*w*len/144, cut:{t,w,len}, use:label}));
  };
  // identical pieces merge into one line (side and end cleats of the same length)
  const n2=v=>String(Math.round(v*100)/100);     // BOM sizes: 40 · 25.5 · 39.25 (no trailing zeros)
  const piece=(q,d,o)=>{ const b=bom.find(x=>x.d===d);
    if(b){ b.q+=q; if(o.bf!=null) b.bf+=o.bf; if(o.sf!=null) b.sf+=o.sf; } else bom.push({q,d,...o}); };

  let p;
  if(palletType==="box"){
    const bk=$("boxBase").value;
    const y0 = bC>0 ? bT : 0;
    // --- base structure ---
    let baseTop, bp;
    if(bk==="stringer"){
      const sC=Math.max(2,Math.round(V("sCount"))), sB=V("sThk"), sH=V("sHgt");
      const notch = $("sNotch").value==="1";
      baseTop = y0+sH;
      bp={sC,sB,sH,notch,...notchGeom(L,sH,notch)};
    }else{
      const k=V("kSize"), kH=V("kHgt");
      const sbOn=$("kSBon").value==="1";
      const nBL=Math.max(2,Math.round(V("kNL"))), nBW=Math.max(2,Math.round(V("kNW")));
      const sbC=sbOn?nBW:0, sbT=sbOn?V("kSBt"):0, sbW=V("kSBw");   // one stringer board per block row
      baseTop = y0+kH+sbT;
      bp={k,kH,sbC,sbT,sbW,sbOn,nBL,nBW,nBlk:nBL*nBW};
    }
    // block base: one bottom deckboard under each block column, same as the block pallet
    const bCe = (bk==="block" && bC>0) ? bp.nBL : bC;
    const bot = bottomBoards(bCe, bLead, bW, L, {kind:bk,...bp}, bLay);
    const ft=$("floorType").value, fPT=parseFloat($("floorPlyT").value);
    const hasB = ft!=="ply", hasP = ft!=="boards";
    const baseH = baseTop+(hasB?dT:0)+(hasP?fPT:0);
    const wH=V("wH"), pT=parseFloat($("plyT").value);
    const ct=V("cleatT"), cw=V("cleatW"), clSp=Math.max(8,V("clSp"));
    const lid=$("boxLid").value==="1";
    const attach=$("attach").value;
    const cleatMat=$("cleatMat").value, plyCl=cleatMat==="ply";
    SW=Math.min(V("sheetW"),V("sheetL")); SL=Math.max(V("sheetW"),V("sheetL")); kerf=V("kerf");
    // skirt laps are set per face: side panels (long faces) and end panels (short faces), so the
    // ends can stop at the deck and leave the fork openings between the stringers clear
    const lapS = attach==="skirt" ? Math.min(Math.max(0,V("sideOv")), baseH) : 0;
    const lapE = attach==="skirt" ? Math.min(Math.max(0,V("endOv")),  baseH) : 0;
    const pHS = wH+lapS, pHE = wH+lapE;   // panel heights including the lap
    const eW=W-2*pT;                       // end panels fit between side panels
    const orient=$("clOrient").value, edgeCl=$("edgeCl").value;
    // vertical mode: verticals at the edges + intermediates along the panel
    // horizontal mode: 2 edge verticals per panel + rails top/bottom + horizontal intermediates up the height
    const nVL = orient==="v" ? 2+Math.max(0,Math.ceil(L/clSp)-1) : 2;
    const nVW = orient==="v" ? 2+Math.max(0,Math.ceil(eW/clSp)-1) : 2;
    const nHS = orient==="h" ? 2+Math.max(0,Math.ceil(pHS/clSp)-1) : 2;   // horizontals per side panel, incl. rails
    const nHE = orient==="h" ? 2+Math.max(0,Math.ceil(pHE/clSp)-1) : 2;   // horizontals per end panel
    H = baseH + wH + (lid?pT:0);
    const inset = edgeCl==="in" ? ct : 0;
    const iL = L-2*pT-2*inset, iW = W-2*pT-2*inset;         // interior clear
    const oL = L+(edgeCl==="out"?2*ct:0), oW = W+(edgeCl==="out"?2*ct:0);  // exterior overall
    p={type:"box",base:bk,edgeCl,iL,iW,oL,oW,dC,dW,dLead,dT,dSum,topIv,
       bC:bCe,bW,bLead,bT,botIv:bot.iv,botMode:bot.mode,botNoFit:bot.noFit,
       ...bp,y0,baseTop,baseH,wH,sT:pT,pT,ct,cw,nVL,nVW,nHS,nHE,orient,lid,lidT:pT,
       attach,lapS,lapE,pHS,pHE,floorType:ft,fPT,hasB,hasP,cleatMat};
    if(hasB) deckBom("Floor deck",topIv,dT,W);
    if(hasP){ bom.push({q:1, d:`Floor panel ${fPT}" ply · ${L}×${W}"`, sf:L*W/144, th:fPT}); plyPart("Floor panel",W,L,fPT,1); }
    // bottom deckboards run across the width, like the top deck
    deckBom("Bottom deck",bot.iv,bT,W);
    if(bk==="stringer"){
      bom.push({q:bp.sC, d:`Stringer ${bp.sB}×${bp.sH}×${L}"${bp.notch?` · notched 2× ${bp.notchL}×${bp.notchD}"`:""}`, bf:bp.sC*bp.sB*bp.sH*L/144,
                cut:{t:bp.sB,w:bp.sH,len:L,op:bp.notch?`notched 2× ${sizeTxt(bp.notchL,bp.notchD)}`:""}, use:"Stringer"});
    }else{
      if(bp.sbOn) bom.push({q:bp.sbC, d:`Stringer board ${bp.sbT}×${bp.sbW}×${L}"`, bf:bp.sbC*bp.sbT*bp.sbW*L/144,
                            cut:{t:bp.sbT,w:bp.sbW,len:L}, use:"Stringer board"});
      bom.push({q:bp.nBlk, d:`Block ${bp.k}×${bp.k}×${bp.kH}"`, bf:bp.nBlk*bp.k*bp.k*bp.kH/144, cut:{t:bp.k,w:bp.k,len:bp.kH}, use:"Block"});
    }
    // plywood (ft², not BF)
    bom.push({q:2, d:`Side panel ${pT}" ply · ${L}×${n2(pHS)}"`, sf:2*L*pHS/144, th:pT});
    bom.push({q:2, d:`End panel ${pT}" ply · ${n2(eW)}×${n2(pHE)}"`, sf:2*eW*pHE/144, th:pT});
    plyPart("Side panel",L,pHS,pT,2); plyPart("End panel",eW,pHE,pT,2);
    // cleat frame: 1×4-type lumber (board feet), or strips ripped from plywood along the face grain,
    // which are cut from sheets with the panels (area; ISPM-15 exempt like the panels)
    const cl=(q,len,what,lenTxt,{merge=false,tail=""}={})=>{
      if(!(len>1e-9)) return;      // no room left between the rails (the panel warning says so) — nothing to cut
      const d = plyCl ? `${what} ${ct}" ply · ${cw}×${lenTxt}"${tail}` : `${what} ${ct}×${cw}×${lenTxt}"${tail}`;
      const o = plyCl ? {sf:q*cw*len/144, th:ct} : {bf:q*ct*cw*len/144, cut:{t:ct,w:cw,len}, use:what};
      if(merge) piece(q,d,o); else bom.push({q,d,...o});
      if(plyCl) plyPart(what,cw,len,ct,q,false);
    };
    if(orient==="v"){
      cl(4, L,  "Rail cleat", n2(L));
      cl(4, eW, "Rail cleat", n2(eW));
      cl(2*nVL, pHS-2*cw, "Vertical cleat", n2(pHS-2*cw), {merge:true});   // verticals fit between the rails
      cl(2*nVW, pHE-2*cw, "Vertical cleat", n2(pHE-2*cw), {merge:true});
    }else{
      cl(4, pHS, "Edge cleat", n2(pHS), {merge:true, tail:" vert"});       // 2 upright edge cleats on each of the 4 panels
      cl(4, pHE, "Edge cleat", n2(pHE), {merge:true, tail:" vert"});
      const hL=L-2*cw, hW=eW-2*cw;                        // horizontals fit between the edge cleats
      cl(2*nHS, hL, "Horizontal cleat", n2(hL));
      cl(2*nHE, hW, "Horizontal cleat", n2(hW));
    }
    if(lid){
      bom.push({q:1, d:`Lid panel ${pT}" ply · ${L}×${W}"`, sf:L*W/144, th:pT}); plyPart("Lid panel",L,W,pT,1);
      cl(2, W, "Lid cleat", n2(W));
    }
    const baseNails = bk==="stringer"
      ? dC*bp.sC*2 + bCe*bp.sC*2
      : (bp.sbOn ? dC*bp.sbC*2 + bp.sbC*bp.nBlk : dC*bp.nBlk*2) + bCe*bp.nBlk + bp.nBlk*2;
    var nails = baseNails + Math.round((2*(L+pHS)*2 + 2*(eW+pHE)*2)/6) + (lid?Math.round(2*(L+W)/6):0);
    if(attach==="skirt"){
      nails += Math.round(((lapS>0?2*L:0)+(lapE>0?2*eW:0))/4);   // horizontal skirt nailing @ ~4″ o.c. on each face that laps
    }else{
      var lags = (bk==="stringer" ? 2*bp.sC : 2*bp.nBL) + 4;   // lags down into stringers / block columns
    }
  } else if(palletType==="stringer"){
    const sC=Math.max(2,Math.round(V("sCount"))), sB=V("sThk"), sH=V("sHgt");
    const notch = $("sNotch").value==="1";
    const y0 = bC>0 ? bT : 0;
    H = y0+sH+dT;
    const ng=notchGeom(L,sH,notch);
    const bot=bottomBoards(bC,bLead,bW,L,{kind:"stringer",notch,...ng},bLay);
    p={type:"stringer",dC,dW,dLead,dT,dSum,topIv,bC,bW,bLead,bT,botIv:bot.iv,botMode:bot.mode,botNoFit:bot.noFit,
       sC,sB,sH,notch,y0,...ng};
    deckBom("Top deck",topIv,dT,W);
    // bottom deckboards run across the width, like the top deck
    deckBom("Bottom deck",bot.iv,bT,W);
    bom.push({q:sC, d:`Stringer ${sB}×${sH}×${L}"${notch?` · notched 2× ${p.notchL}×${p.notchD}"`:""}`, bf:sC*sB*sH*L/144,
              cut:{t:sB,w:sH,len:L,op:notch?`notched 2× ${sizeTxt(p.notchL,p.notchD)}`:""}, use:"Stringer"});
    var nails = dC*sC*2 + bC*sC*2;
  } else {
    // BLOCK pallet
    const k=V("kSize"), kH=V("kHgt");
    const sbOn=$("kSBon").value==="1";
    const nBL=Math.max(2,Math.round(V("kNL"))), nBW=Math.max(2,Math.round(V("kNW")));
    const sbC=sbOn?nBW:0, sbT=sbOn?V("kSBt"):0, sbW=V("kSBw");   // one stringer board per block row
    const nBlk=nBL*nBW;
    const bCb = bC>0 ? nBL : 0;          // bottom boards sit under the block columns
    const y0 = bCb>0 ? bT : 0;
    H = y0+kH+sbT+dT;
    const bot=bottomBoards(bCb,bLead,bW,L,{kind:"block",nBL,k},bLay);
    p={type:"block",dC,dW,dLead,dT,dSum,topIv,bC:bCb,bW,bLead,bT,botIv:bot.iv,botMode:bot.mode,
       k,kH,sbC,sbT,sbW,sbOn,nBL,nBW,y0};
    deckBom("Top deck",topIv,dT,W);
    deckBom("Bottom deck",bot.iv,bT,W);
    if(sbOn) bom.push({q:sbC, d:`Stringer board ${sbT}×${sbW}×${L}"`, bf:sbC*sbT*sbW*L/144, cut:{t:sbT,w:sbW,len:L}, use:"Stringer board"});
    bom.push({q:nBlk, d:`Block ${k}×${k}×${kH}"`, bf:nBlk*k*k*kH/144, cut:{t:k,w:k,len:kH}, use:"Block"});
    var nails = sbOn ? dC*sbC*2 + sbC*nBlk + bCb*nBlk + nBlk*2
                     : dC*nBlk*2 + bCb*nBlk + nBlk*2;
  }
  const totBF = bom.reduce((a,b)=>a+(b.bf||0),0);
  const totSF = bom.reduce((a,b)=>a+(b.sf||0),0);
  // sheets and plywood weight are per thickness — mixing 3/8" walls with a 1/2" floor
  // in one total would misprice the sheets and understate the weight
  const byTh={};
  bom.forEach(b=>{ if(b.sf) byTh[b.th]=(byTh[b.th]||0)+b.sf; });
  // plywood sheets: every part laid out on the sheet with the saw kerf, per thickness —
  // for one unit (BOM, spec sheet) and for the whole order (cut list)
  const cA=cutPlywood(plyParts,N,SW,SL,kerf);
  const cB=JSON.stringify(plyParts)===JSON.stringify(plyParts12) ? cA : cutPlywood(plyParts12,N,SW,SL,kerf);
  const tot=l=>l.reduce((a,x)=>a+x.sheets,0), orderB=tot(cB.order)<tot(cA.order);
  const plyUnit  = tot(cB.unit)<tot(cA.unit) ? cB.unit : cA.unit;
  const plyOrder = orderB ? cB.order : cA.order;
  const sheets = plyUnit.reduce((a,s)=>a+s.sheets,0);
  const sheetTxt = plyUnit.map(s=>`${s.sheets} ${s.sheets===1?"sheet":"sheets"} ${frac(s.th)}`).join(" + ");
  const plyWt = Object.entries(byTh).reduce((a,[th,sf])=>a+sf*(+th)/12*36,0);  // ply ≈ 36 lb/ft³
  const den = SPECIES[spSel.value]?SPECIES[spSel.value].den:30;
  const weight = totBF/12*den + plyWt;
  const m={bom,totBF,totSF,sheets,sheetTxt,nails,lags:(typeof lags!=="undefined"?lags:0),weight,H,L,W,p};
  m.cut={N, lumber:lumberCuts(bom,N), ply:plyOrder, plyUnit, SW, SL, kerf, splices:orderB?splices12:splices};
  m.cut.bfN=m.cut.lumber.reduce((a,o)=>a+o.bfN,0);
  m.det=palletDetails(m);      // gaps, spacing and fork openings — shared by the panel, the drawing and the print
  return m;
}

