/* ---- browser library (optional — degrades if storage is blocked) ---- */
const LIB="palletlab.designs";
let libOK=true, libFull=false, libNames=[];
// storage that is blocked turns the list off; a list that can't be read (damaged, or written by
// another page) counts as empty, and entries without a name and a design are left out
function libRead(){
  let raw;
  try{ raw=localStorage.getItem(LIB); }catch(e){ libOK=false; return []; }
  let v; try{ v=JSON.parse(raw||"[]"); }catch(e){ return []; }
  return Array.isArray(v) ? v.filter(d=>d && typeof d==="object" && typeof d.name==="string" && d.name.trim()
                                       && d.state && typeof d.state==="object") : [];
}
// a full storage is not a blocked one: the list stays on so designs can be deleted to make room
function libWrite(list){
  libFull=false;
  try{ localStorage.setItem(LIB,JSON.stringify(list)); return true; }
  catch(e){ if(/quota/i.test(e && e.name || "")) libFull=true; else libOK=false; return false; }
}
function libRefresh(sel){
  const list=libRead(), s=$("libSel");
  libNames=list.map(d=>d.name);
  s.innerHTML='<option value="">\u2014 saved in this browser \u2014</option>'+
    list.map((d,i)=>`<option value="${i}">${esc(d.name)} \u00b7 ${esc(String(d.state.saved||"").slice(0,10))}</option>`).join("");
  if(sel!=null) s.value=sel;
  if(!libOK){
    $("libSel").disabled=true; $("btnLibSave").disabled=true; $("btnLibDel").disabled=true;
    $("libHint").textContent="This browser is blocking local storage, so the in-browser list is off. Design files (.json) still work normally.";
  }
}
$("btnLibSave").addEventListener("click",()=>{
  const dflt=($("partNo").value.trim()||$("client").value.trim()||palletType+" "+$("L").value+"x"+$("W").value);
  const name=(window.prompt("Save design as:",dflt)||"").trim();
  if(!name) return;
  const list=libRead();
  const st=collectState();
  const at=list.findIndex(d=>d.name===name);
  if(at>=0) list[at]={name,state:st}; else list.push({name,state:st});
  if(libWrite(list)){ libRefresh(at>=0?at:list.length-1); toast((at>=0?"Updated ":"Saved ")+name); }
  else { libRefresh(); toast(libFull ? "This browser's storage is full — delete a saved design, or use SAVE FILE"
                                      : "Could not save to this browser"); }
});
$("libSel").addEventListener("change",()=>{
  const i=$("libSel").value; if(i==="") return;
  const d=libRead()[+i]; if(!d) return;
  try{ applyState(d.state,"Loaded "+d.name); }catch(err){ toast("Could not load: "+err.message); }
});
$("btnLibDel").addEventListener("click",()=>{
  const i=$("libSel").value;
  if(i===""){ toast("Pick a saved design first"); return; }
  const list=libRead(), d=list[+i]; if(!d) return;
  if(!window.confirm('Delete "'+d.name+'" from this browser?')) return;
  list.splice(+i,1);
  if(libWrite(list)){ libRefresh(); toast("Deleted "+d.name); } else { libRefresh(); toast("Could not delete from this browser"); }
});
libRefresh();
// another tab saved or deleted a design: reload the list, keeping the one picked here
window.addEventListener("storage",e=>{
  if(e.key!==LIB && e.key!==null) return;
  const v=$("libSel").value, name = v==="" ? null : libNames[+v];
  libRefresh();
  const at = name==null ? -1 : libNames.indexOf(name);
  if(at>=0) $("libSel").value=String(at);
});

