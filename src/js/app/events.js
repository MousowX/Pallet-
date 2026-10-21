/* ================= EVENTS ================= */
ids.forEach(id=>$(id).addEventListener("input",()=>update()));
["client","partNo"].forEach(id=>$(id).addEventListener("input",()=>update()));
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
$("sNotch").addEventListener("change",()=>{ syncNotchRows(); update(); });
function syncNotchRows(){
  const on=$("sNotch").value==="1";
  document.querySelectorAll(".notchRow").forEach(r=>r.style.display = on ? "" : "none");
  // the bottom-deck layout choice only matters on a notched stringer base
  const strBase = palletType==="stringer" || (palletType==="box" && $("boxBase").value==="stringer");
  $("rowBotLay").style.display = on && strBase ? "" : "none";
}
function syncSections(){
  const t=palletType, bb=$("boxBase").value;
  const showStr = t==="stringer" || (t==="box" && bb==="stringer");
  const showBlk = t==="block"    || (t==="box" && bb==="block");
  $("secStringer").style.display = showStr ? "" : "none";
  $("secBlock").style.display    = showBlk ? "" : "none";
  $("secBox").style.display      = t==="box" ? "" : "none";
  syncNotchRows();
}
function setType(t,msg){
  palletType=t;
  const map={stringer:"tStr",block:"tBlk",box:"tBox"};
  ["tStr","tBlk","tBox"].forEach(id=>$(id).classList.toggle("on",id===map[t]));
  syncSections();
  update(msg);
}
$("kSBon").addEventListener("change",()=>update(
  $("kSBon").value==="1" ? "Stringer boards on" : "Deck nailed direct to blocks"));
$("boxBase").addEventListener("change",()=>{
  syncSections();
  update($("boxBase").value==="block" ? "Box on block base" : "Box on stringer base");
});
$("tStr").addEventListener("click",()=>setType("stringer","Stringer class"));
$("tBlk").addEventListener("click",()=>setType("block","Block class"));
$("tBox").addEventListener("click",()=>setType("box","Pallet box"));
$("boxLid").addEventListener("change",()=>update());
$("plyT").addEventListener("change",()=>update());
$("floorPlyT").addEventListener("change",()=>update());
$("clOrient").addEventListener("change",()=>update());
$("edgeCl").addEventListener("change",()=>update());
$("floorType").addEventListener("change",()=>{
  $("rowFloorPly").style.display = $("floorType").value==="boards" ? "none" : "";
  update();
});
$("bLay").addEventListener("change",()=>update());
function syncSkirtRows(){
  document.querySelectorAll(".skirtRow").forEach(r=>r.style.display = $("attach").value==="skirt" ? "" : "none");
}
$("attach").addEventListener("change",()=>{ syncSkirtRows(); update(); });
$("btnPresetBox").addEventListener("click",()=>{
  const def={L:48,W:40,dCount:7,dWidth:5.5,dLead:"",dThk:0.75,bCount:5,bWidth:3.5,bLead:5.5,bThk:0.75,
             sCount:3,sThk:1.5,sHgt:3.5,nLen:9,nDep:1.5,nGap:13,wH:30,cleatT:0.75,cleatW:3.5,clSp:24,
             sideOv:2.5,endOv:0.75};
  for(const k in def) $(k).value=def[k];
  $("sNotch").value="1"; $("bLay").value="notch"; $("boxLid").value="1"; $("plyT").value="0.375"; $("kSBon").value="1";
  $("attach").value="skirt"; syncSkirtRows();
  $("floorType").value="boards"; $("floorPlyT").value="0.5"; $("rowFloorPly").style.display="none";
  $("clOrient").value="v"; $("edgeCl").value="in"; $("boxBase").value="stringer"; $("cleatMat").value="lumber";
  setType("box","Preset: Export crate 48×40×30 · 3/8″ ply · skirted");
});
// print once the sheet is current and its drawing decoded (a just-rebuilt image would print blank)
function printSpec(){
  document.body.classList.remove("printCut");
  flushSpec();
  const img=$("spec").querySelector("img"), go=()=>window.print();
  if(img && !img.complete && img.decode) img.decode().then(go,go); else go();
}
$("btnPrint").addEventListener("click",printSpec);
// the cut list prints from its own button; the browser's own Print and Ctrl+P give the spec sheet.
// The switch is undone as soon as printing ends (afterprint, or the page leaving print mode).
function endCutPrint(){ document.body.classList.remove("printCut"); }
function printCut(){
  buildCutSheet(buildModel());
  document.body.classList.add("printCut");
  window.addEventListener("afterprint",endCutPrint,{once:true});
  window.print();
}
if(window.matchMedia){ const mq=window.matchMedia("print");
  const f=e=>{ if(!e.matches) endCutPrint(); };
  if(mq.addEventListener) mq.addEventListener("change",f); else if(mq.addListener) mq.addListener(f); }
$("btnCut").addEventListener("click",printCut);
$("cleatMat").addEventListener("change",()=>update($("cleatMat").value==="ply"?"Cleats ripped from plywood":"Lumber cleats"));
$("btnReset").addEventListener("click",()=>{
  const def={L:48,W:40,dCount:7,dWidth:3.5,dLead:5.5,dThk:0.75,bCount:5,bWidth:3.5,bLead:5.5,bThk:0.75,
             sCount:3,sThk:1.5,sHgt:3.5,nLen:9,nDep:1.5,nGap:13,kNL:3,kNW:3,kSize:3.5,kHgt:3.5,kSBt:0.75,kSBw:3.5,
             wH:30,cleatT:0.75,cleatW:3.5,clSp:24,sideOv:2.5,endOv:0.75,
             Fb:850,E:1100000,Fc:1310,SF:1.5,defPct:1.0,bearing:2,forkSp:24};
  for(const k in def) $(k).value=def[k];
  spSel.value=0; $("sNotch").value="1"; $("bLay").value="notch"; $("boxLid").value="1"; $("plyT").value="0.375"; $("kSBon").value="1";
  $("attach").value="skirt"; syncSkirtRows();
  $("floorType").value="boards"; $("floorPlyT").value="0.5"; $("rowFloorPly").style.display="none";
  $("clOrient").value="v"; $("edgeCl").value="in"; $("boxBase").value="stringer"; $("cleatMat").value="lumber";
  syncSections();
  update("Reset to GMA 48×40 · White Fir");
});

