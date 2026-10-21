/* ================= UPDATE PIPELINE ================= */
let toastT;
function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),Math.min(5000,Math.max(1400,55*msg.length)));
}
// the print sheet (with its 2× paper drawing) is rebuilt shortly after the last edit rather than on
// every keystroke; every way of printing flushes it first
let specNext=null, specLast=null, specT=0, specDay="";
function queueSpec(m,a,gov){ specNext=[m,a,gov]; clearTimeout(specT); specT=setTimeout(flushSpec,350); }
function flushSpec(){
  clearTimeout(specT); specT=0;
  const day=new Date().toLocaleDateString();
  if(specNext){ specLast=specNext; specNext=null; }
  else if(day===specDay) return;           // sheet already current (only the date can go stale)
  if(specLast){ specDay=day; buildSpec(...specLast); }
}
window.addEventListener("beforeprint", flushSpec);
// the design as last shown: a resize redraws it instead of working the whole design out again
let lastModel=null;
function update(msg){
  const m=buildModel();
  lastModel=m;
  const a=analyze(m);
  const gov=renderResults(m,a);
  renderDetails(m.det);
  renderBOM(m);
  renderCut(m);
  queueSpec(m,a,gov);
  let extra="";
  if(m.p.type==="box"){
    const {iL,iW,oL,oW}=m.p;
    const vol=iL*iW*m.p.wH/1728;
    extra=` · int ${iL.toFixed(1)}″×${iW.toFixed(1)}″×${m.p.wH}″ · ${vol.toFixed(1)} ft³`;
    if(m.p.edgeCl==="out") extra+=` · ext ${oL.toFixed(1)}″×${oW.toFixed(1)}″`;
  }
  // geometry and fork-entry checks come from the details; box-only checks are added here
  const warn=[...m.det.warn];
  if(m.p.type==="box"){
    const over=[["side",m.p.nHS,m.p.pHS],["end",m.p.nHE,m.p.pHE]].filter(([w,n,h])=>n>1 && n*m.p.cw>h+0.01);
    if(over.length===2 && over[0][1]===over[1][1] && Math.abs(over[0][2]-over[1][2])<1e-9)
      warn.push(`horizontal cleats: ${over[0][1]}×${m.p.cw}″ exceeds the ${over[0][2].toFixed(1)}″ side and end panels`);
    else over.forEach(([w,n,h])=>warn.push(`horizontal cleats: ${n}×${m.p.cw}″ exceeds the ${h.toFixed(1)}″ ${w} panel`));
    if(m.p.iL<=0||m.p.iW<=0) warn.push("interior clear is zero or negative");
  }
  setHTML("warn", warn.map(w=>"⚠ "+w).join("<br>"));
  setHTML("vpDims",
    `<b>${m.L}″ × ${m.W}″ × ${m.H.toFixed(2)}″</b> · ${m.totBF.toFixed(1)} BF · ${m.weight.toFixed(0)} lb tare${extra}<br>`+
    `governing: <b>${gov.t}</b> ≈ <b>${fmtLb(gov.cap)} lb</b>`);
  drawScreen(m);               // last: the footer text above sets how much height the drawing gets
  if(msg) toast(msg);
}

