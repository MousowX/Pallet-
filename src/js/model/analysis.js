/* ================= STRUCTURAL ANALYSIS (simplified beam theory) ================= */
/* Uniformly loaded, simply supported: Wcap_strength = 8·Fb·S / Lspan ; δ = 5·W·L³ /(384·E·I) */
// approx. sheathing-grade plywood: face-grain bending; Fc = compression along the face grain on the
// gross section — APA axial capacity FcA 5,000 lbf/ft for 48/24 (23/32″) ≈ 580 psi
const PLY={Fb:1400,E:1100000,Fc:580};
function comboBeam(parts,span,defLim,SF){
  // parallel members estimate: capacities add, non-composite
  if(!parts.length) return {cap:0,gov:"no floor",defl:0};
  let cap=0,defl=0,gov="strength",best=0;
  for(const q of parts){
    const r=beamCap(q.Fb,q.E,SF,q.S,q.I,span,defLim);
    cap+=r.cap; defl=Math.max(defl,r.defl);
    if(r.cap>best){best=r.cap;gov=r.gov;}
  }
  return {cap,gov,defl};
}
function beamCap(Fb,E,SF,S,I,span,defLim){
  if(S<=0||I<=0) return {cap:0,gov:"no member spans this way",defl:0};
  if(span<=1) return {cap:1e9,gov:"-",defl:0};
  const Wstr = 8*Fb*S/span/SF;
  const Wdef = defLim*384*E*I/(5*Math.pow(span,3));
  const cap = Math.min(Wstr,Wdef);
  const defl = 5*cap*Math.pow(span,3)/(384*E*I);
  return {cap, gov: Wstr<Wdef?"strength":"deflection", defl};
}

function analyze(m){
  const Fb=V("Fb"), E=V("E"), SF=Math.max(1,V("SF"));
  const dpc=V("defPct")/100, br=V("bearing"), fs=V("forkSp");
  const L=m.L, W=m.W;
  // deck strength comes from the total width of the boards (end boards may be wider than the rest)
  const dC=m.p.dC, dT=m.p.dT, dSum=m.p.dSum;
  const deckTxt = Math.abs(m.p.dLead-m.p.dW)<1e-9 ? `${dC} deckboards ${dT}×${m.p.dW}`
                : `${dC} deckboards ${dT} thick (2×${m.p.dLead} + ${dC-2}×${m.p.dW})`;

  // base kind: for a box this is whichever base was selected
  const bk = m.p.base || m.p.type;
  const isBox = palletType==="box";
  const hasB = !isBox || m.p.hasB, hasP = isBox && m.p.hasP, fPT = isBox ? m.p.fPT : 0;

  // -- spanning members along L --
  let S_L=0, I_L=0, memberL="";
  if(bk==="stringer"){
    const sC=m.p.sC, b=m.p.sB, h=m.p.sH;
    S_L = sC*b*h*h/6;  I_L = sC*b*h*h*h/12;
    memberL = sC+" stringers "+b+"×"+h;
  }else{
    // Only members that actually RUN along L count here. Deckboards run across W,
    // so they carry nothing in this direction — a plywood floor does (it spans both ways).
    const sbC=m.p.sbC||0, b=m.p.sbW||0, h=m.p.sbT||0;
    const parts=[];
    if(sbC>0){ S_L += sbC*b*h*h/6;  I_L += sbC*b*h*h*h/12;  parts.push(sbC+" stringer boards"); }
    if(hasP) { S_L += W*fPT*fPT/6;  I_L += W*fPT*fPT*fPT/12; parts.push(fPT+'" ply floor'); }
    memberL = parts.length ? parts.join(" + ")+" (non-composite)"
                           : "no lengthwise member — deck bears direct on blocks";
  }

  // 1) RACKED — LONG SPAN (supported on rack rails across width, members span L)
  const spanL = L-2*br;
  let rL = beamCap(Fb,E,SF,S_L,I_L,spanL,dpc*spanL);
  // notched stringers: the notch leaves only (h − notch depth) of wood, and it sits well inside
  // the span — check bending at the net section of the notch point nearest mid-span
  if(bk==="stringer" && m.p.notch && m.p.notchL>0){
    const p=m.p, hn=p.sH-p.notchD;
    const g=X=>Math.max(0,(X-br)*(L-br-X)/2);           // moment per unit of uniform load, X from the pallet end
    const gN=Math.max(0,...p.notchX.map(a=>g(Math.min(Math.max(L/2,a),a+p.notchL))));
    if(hn<=0) rL={cap:0, gov:"notch cuts through the stringer", defl:0};
    else if(gN>0){
      const Sn=p.sC*p.sB*hn*hn/6;
      const Wn=Fb*Sn*spanL/(SF*gN);                        // total load that stresses the notch to Fb/SF
      if(Wn<rL.cap) rL={cap:Wn, gov:"strength at notch", defl:5*Wn*Math.pow(spanL,3)/(384*E*I_L)};
    }
  }

  // 2) RACKED — SHORT SPAN (floor spans W)
  const spanW = W-2*br;
  const partsW=[];
  if(hasB) partsW.push({Fb,E, S:dSum*dT*dT/6, I:dSum*dT*dT*dT/12});
  if(hasP) partsW.push({Fb:PLY.Fb,E:PLY.E, S:L*fPT*fPT/6, I:L*fPT*fPT*fPT/12});
  const rW = comboBeam(partsW,spanW,dpc*spanW,SF);
  const noteW = (hasB? deckTxt : "") + (hasB&&hasP?" + ":"") + (hasP? fPT+'" ply floor':"");

  // 3) FLOOR STACKED — deck bending between supports
  let clearSpan, nSpans;
  if(bk==="stringer"){
    const sC=m.p.sC, b=m.p.sB;
    clearSpan = (W - sC*b)/(sC-1); nSpans=sC-1;
  }else if(m.p.sbC>0){
    clearSpan = (W - m.p.sbC*m.p.sbW)/(m.p.sbC-1); nSpans=m.p.sbC-1;
  }else{
    // deck nailed straight to the blocks — it spans between block rows across W
    clearSpan = (W - m.p.nBW*m.p.k)/(m.p.nBW-1); nSpans=m.p.nBW-1;
  }
  // each span carries its share; total = per-span cap × nSpans
  const parts1=[];
  if(hasB) parts1.push({Fb,E, S:dSum*dT*dT/6, I:dSum*dT*dT*dT/12});
  if(hasP) parts1.push({Fb:PLY.Fb,E:PLY.E, S:L*fPT*fPT/6, I:L*fPT*fPT*fPT/12});
  const fRaw = comboBeam(parts1,Math.max(clearSpan,1),dpc*Math.max(clearSpan,1),SF);
  const fl = {cap:fRaw.cap*nSpans, gov:fRaw.gov, defl:fRaw.defl, span:clearSpan};

  // 4) FORK SUPPORT — members along L spanning fork tines
  const rF = beamCap(Fb,E,SF,S_L,I_L,fs,dpc*fs);

  const modes=[
      {k:"racked-L", t:"RACKED — LONG SPAN "+spanL.toFixed(0)+'"', ...rL, note:memberL},
      {k:"racked-W", t:"RACKED — SHORT SPAN "+spanW.toFixed(0)+'"', ...rW, note:noteW},
      {k:"floor",    t:"FLOOR STACKED", cap:fl.cap, gov:fl.gov, defl:fl.defl, note:"deck between supports, "+fl.span.toFixed(1)+'" clear × '+nSpans+" spans"},
      {k:"fork",     t:"FORK SUPPORT @ "+fs+'"', ...rF, note:memberL},
  ];
  if(palletType==="box"){
    const p=m.p, plyCl=p.cleatMat==="ply", Fc = plyCl ? PLY.Fc : V("Fc");   // plywood rips crush at a lower stress
    // upright cleats that exist: in vertical mode a panel no taller than its two rails has none
    const up=(n,h)=> p.orient==="v" && h-2*p.cw<=1e-9 ? 0 : 2*n;
    const nV=up(p.nVL,p.pHS)+up(p.nVW,p.pHE);
    const A=nV*p.ct*p.cw;
    modes.push({k:"stack", t:"STACKING — VERTICAL CLEATS", cap:Fc*A/SF,
      gov:"compression", defl:0, note:nV+" cleats "+p.ct+"×"+p.cw+'"'+(plyCl?" plywood rips · Fc ≈ "+Fc+" psi":" · Fc "+Fc+" psi")+" · panels not counted"});
  }
  return { memberL, modes };
}

