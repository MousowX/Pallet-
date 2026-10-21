/* ================= SAVE / LOAD DESIGNS ================= */
const FMT="pallet-lab/1";
// every labelled control in the input columns — collected live so nothing is ever missed
const ctrls = () => Array.from(document.querySelectorAll('#main input[id], #main select[id]'))
                         .filter(el=>el.type!=="file" && el.id!=="libSel");   // the library picker isn't part of a design

function collectState(){
  const f={};
  ctrls().forEach(el=> f[el.id]=el.value);
  return {fmt:FMT, type:palletType, saved:new Date().toISOString(), f};
}
function syncRows(){
  syncSkirtRows();
  $("rowFloorPly").style.display = $("floorType").value==="boards" ? "none" : "";
  syncNotchRows();
  syncSections();
}
// fields older files may still carry: ignored quietly (the stringer-board count now follows the
// block rows; the single skirt lap became separate side and end laps; notches are now set by the
// space between them instead of the distance from each end)
const RETIRED=new Set(["kSB","libSel","skirtOv","nEnd"]);
// what an older file gets for a field it doesn't have, so it loads exactly as it was saved
// a number from an old file read the way the tool reads its inputs (kept inside the input's limits)
const oldNum=(v,lo,hi)=>{ const x=parseFloat(v); return Math.min(hi,Math.max(lo,Number.isFinite(x)?x:lo)); };
const MIGRATE={
  dLead:  ()=>"",                                   // end boards the same width as the rest
  bLead:  ()=>"",
  bLay:   ()=>"even",                               // the bottom deck used to be spread evenly
  sideOv: f=>"skirtOv" in f ? f.skirtOv : undefined, // one lap used to apply to all four sides
  endOv:  f=>"skirtOv" in f ? f.skirtOv : undefined,
  // notches used to be set from each end. The first version had no notch inputs at all: it drew them
  // 9″ long, centred at 27% and 73% of the length and min(1.5″, 40% of the stringer height) deep —
  // a file from it keeps those notches (the space rounded to 1/4″, the depth up to the next 1/8″)
  nGap:   f=>{
    if("nEnd" in f) return String(Math.round((oldNum(f.L,12,240)-2*oldNum(f.nEnd,0,100)-2*oldNum(f.nLen,4,16))*1e6)/1e6);
    if(!("nLen" in f)) return String(Math.max(0, Math.round((0.46*oldNum(f.L,12,240)-9)*4)/4));
    return undefined; },
  nDep:   f=>"nLen" in f ? undefined : String(Math.ceil(Math.min(1.5, 0.4*oldNum(f.sHgt,2,6))*8-1e-9)/8),
};
const TYPES={stringer:"tStr",block:"tBlk",box:"tBox"};
function applyState(st,msg){
  // everything is checked before the screen is touched, so a bad file leaves the current design as it was
  if(!st||typeof st!=="object"||st.fmt!==FMT||!st.f||typeof st.f!=="object"||Array.isArray(st.f))
    throw new Error("not a PALLET\u00b7LAB design file");
  const type = st.type==null ? "stringer" : st.type;
  if(!Object.prototype.hasOwnProperty.call(TYPES,type)) throw new Error("unknown pallet type in the file");
  const byId={}; ctrls().forEach(el=>byId[el.id]=el);
  const has=id=>Object.prototype.hasOwnProperty.call(st.f,id);
  // a value a control can actually take: text or a number, and for a list one of its choices
  const usable=(el,v)=>(typeof v==="string" || (typeof v==="number" && Number.isFinite(v))) &&
                       (el.tagName!=="SELECT" || [...el.options].some(o=>o.value===String(v)));
  let unknown=0, invalid=0;
  for(const id in byId){
    const el=byId[id];
    if(has(id) && usable(el,st.f[id])){ el.value=String(st.f[id]); continue; }
    if(has(id)) invalid++;
    // a field the file doesn't have (added after it was saved) starts from its default,
    // not from whatever design was on screen before
    const mv=!has(id) && MIGRATE[id] ? MIGRATE[id](st.f) : undefined;
    if(mv!==undefined){ el.value=mv; continue; }
    if(el.tagName==="SELECT"){ const o=[...el.options].find(o=>o.defaultSelected)||el.options[0]; if(o) el.value=o.value; }
    else el.value=el.defaultValue;
  }
  for(const id in st.f) if(!byId[id] && !RETIRED.has(id)) unknown++;
  palletType = type;
  ["tStr","tBlk","tBox"].forEach(id=>$(id).classList.toggle("on",id===TYPES[palletType]));
  syncRows();
  const notes=[];
  if(unknown) notes.push(`${unknown} unknown field${unknown>1?"s":""} skipped`);
  if(invalid) notes.push(`${invalid} unreadable value${invalid>1?"s":""} set to default`);
  update(msg + (notes.length?` (${notes.join(", ")})`:""));
}

