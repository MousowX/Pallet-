/* ================= STATE ================= */
const $ = id => document.getElementById(id);
let palletType = "stringer";
const cv = $("cv"), ctx = cv.getContext("2d");

const ids = ["L","W","dCount","dWidth","dLead","dThk","bCount","bWidth","bLead","bThk","sCount","sThk","sHgt","nLen","nDep","nGap",
             "kNL","kNW","kSize","kHgt","kSBt","kSBw","wH","cleatT","cleatW","clSp","sideOv","endOv",
             "orderQty","sheetW","sheetL","kerf",
             "Fb","E","Fc","SF","defPct","bearing","forkSp"];
// Every number the tool uses comes through here. A blank, non-numeric or out-of-range entry (also the
// moment a field is cleared to type a new value) is used at the nearest allowed value, and the field gets
// a red outline — so a half-typed number can never produce zero-width boards or negative capacities.
// Fields marked data-blank="same" may be left empty on purpose and then read as 0.
function V(id){
  const el=$(id), raw=String(el.value).trim(), v=parseFloat(raw);
  if(raw==="" && el.dataset.blank==="same"){ el.classList.remove("bad"); return 0; }
  const lo=parseFloat(el.min), hi=parseFloat(el.max);
  let x = Number.isFinite(v) ? v : (Number.isFinite(lo) ? lo : 0);
  if(Number.isFinite(lo)) x=Math.max(lo,x);
  if(Number.isFinite(hi)) x=Math.min(hi,x);
  el.classList.toggle("bad", !(Number.isFinite(v) && x===v));
  return x;
}
// one formatter for the drawing, the details panel and the print — rounded to 1/16″
function inch(v){ const r=Math.round(Math.round(v*1e6)/1e6*16)/16;   // snap float noise first, so x.5/16 always rounds the same way
  return (r%1===0?r.toFixed(0):r.toFixed(2).replace(/0+$/,'').replace(/\.$/,''))+'″'; }

/* species dropdown */
const spSel = $("species");
SPECIES.forEach((s,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=s.n; spSel.appendChild(o); });
spSel.addEventListener("change",()=>{ const s=SPECIES[spSel.value]; $("Fb").value=s.Fb; $("E").value=s.E; $("Fc").value=s.Fc; update("Species: "+s.n); });

