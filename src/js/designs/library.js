/* ---- design list: every design in the database, searchable (off if this browser blocks storage) ---- */
let designDB=null, libOK=true, libRows=[], libQ=Promise.resolve();
// list work runs one step at a time, in order, so a pick never reads a list that a save is still changing
function libRun(fn){ const p=libQ.then(fn); libQ=p.catch(()=>{}); return p; }
// resolves once the list has settled (the browser checks wait on it)
function libIdle(){ return libQ.then(()=>{}); }
// search text: no capitals, no accents (Peñoles finds penoles)
const fold = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
// the rows, read again once per change (never per keystroke); each keeps the text a search looks at
async function libReload(){
  const s=v=>typeof v==="string" ? v : "";
  libRows=(await designDB.list()).map(r=>{
    const row={id:r.id, name:r.name, client:s(r.client), partNo:s(r.partNo), type:s(r.type), saved:s(r.saved)};
    row.q=fold([row.name, row.client, row.partNo, row.type, row.saved.slice(0,10)].join(" "));
    return row;
  });
}
function libOff(){
  libOK=false; libRows=[];
  ["libSel","libFind","btnLibSave","btnLibDel","btnImport"].forEach(id=>{ $(id).disabled=true; });
  $("libHint").textContent="This browser is blocking local storage, so the in-browser list is off. Design files (.json) still work normally.";
}
// the rows that match the search box: every word, in any of name, client, part #, type or date
function libMatches(){
  const words=fold($("libFind").value).split(/\s+/).filter(Boolean);
  return {words, rows: words.length ? libRows.filter(r=>words.every(w=>r.q.includes(w))) : libRows};
}
// show the list; `keep` (an id) stays picked when it is shown
function libRender(keep){
  const s=$("libSel"), {words,rows}=libMatches(), n=libRows.length;
  const opt=(v,t)=>{ const o=document.createElement("option"); o.value=v; o.textContent=t; return o; };
  const frag=document.createDocumentFragment();
  frag.appendChild(opt("", !words.length ? "\u2014 saved in this browser \u2014"
                         : rows.length ? `\u2014 ${rows.length} of ${n} match \u2014` : "\u2014 no match \u2014"));
  rows.forEach(r=>frag.appendChild(opt(String(r.id), r.name+" \u00b7 "+r.saved.slice(0,10))));
  s.textContent=""; s.appendChild(frag);
  s.value = keep!=null && rows.some(r=>String(r.id)===String(keep)) ? String(keep) : "";
  $("libFind").placeholder=`search ${n} saved design${n===1?"":"s"}`;
}
const libRow = v => libRows.find(r=>String(r.id)===v);
// reload from the database and show it, keeping `keep` picked
function libRefresh(keep){
  return libRun(async()=>{
    if(!libOK) return;
    try{ await libReload(); }catch(e){ libOff(); }
    libRender(keep);
  });
}
// a design saved here, saved as a file or loaded from one: show it picked, clearing a search that hides it
function libShow(id){
  if(!libMatches().rows.some(r=>r.id===id)) $("libFind").value="";
  libRender(id);
}
// tell other tabs the list changed (they reload it)
let libBC=null;
try{ libBC=new BroadcastChannel(LIB); libBC.onmessage=()=>libChanged(); }catch(e){ libBC=null; }
function libNotify(){
  try{ localStorage.setItem(LIB_PING, Date.now()+":"+Math.random()); }catch(e){}
  try{ if(libBC) libBC.postMessage("changed"); }catch(e){}
}
let libChangedT=0;
function libChanged(){
  clearTimeout(libChangedT);
  libChangedT=setTimeout(()=>{ const v=$("libSel").value; libRefresh(v==="" ? null : v); },30);
}
// another tab saved or deleted a design: reload the list, keeping the one picked here
window.addEventListener("storage",e=>{
  if(e.key===LIB_PING || e.key===null || (designDB && designDB.kind==="local" && e.key===LIB)) libChanged();
});

// a design file saved or loaded goes into the list too, quietly: only a failure is reported
// (`done` is what the toast already says)
function libAdd(name,state,source,done){
  return libRun(async()=>{
    if(!libOK) return;
    let r;
    try{ r=await designDB.save(name,state,source); }
    catch(e){
      if(e.kind==="blocked"){ libOff(); libRender(); return; }
      toast(done+(e.kind==="full" ? " — this browser's storage is full, so it was not added to the design list"
                                  : " — it could not be added to the design list"));
      return;
    }
    try{ await libReload(); }catch(e){ libOff(); }
    libShow(r.id); libNotify();
  });
}
// many design files into the list in one go; files that aren't designs are counted and skipped
function libImport(files){
  return libRun(async()=>{
    if(!libOK) return;
    const texts=await Promise.all(files.map(readText)), items=[];
    texts.forEach((t,i)=>{
      let st=null;
      try{ st=JSON.parse(t); checkDesign(st); }catch(e){ return; }
      items.push({name:fileDesignName(files[i].name), state:st, source:"import"});
    });
    const bad=files.length-items.length;
    if(!items.length){ toast(`Nothing imported: ${bad===1 ? "the file is" : `the ${bad} files are`} not PALLET\u00b7LAB design files`); return; }
    let r;
    try{ r=await designDB.saveMany(items); }
    catch(e){
      if(e.kind==="blocked"){ libOff(); libRender(); }
      toast(e.kind==="full" ? "This browser's storage is full — nothing was imported. Delete saved designs to make room"
                            : "Could not import into this browser");
      return;
    }
    const keep=$("libSel").value;
    try{ await libReload(); }catch(e){ libOff(); }
    libRender(keep==="" ? null : keep); libNotify();
    const n=r.added+r.updated;
    toast(`Imported ${n} design${n===1?"":"s"}`+(r.updated ? ` (${r.updated} replaced a saved design of the same name)` : "")+
          (bad ? ` · ${bad} file${bad===1?"":"s"} skipped: not design files` : ""));
  });
}

$("libFind").addEventListener("input",()=>{ const v=$("libSel").value; libRender(v==="" ? null : v); });
$("libFind").addEventListener("keydown",e=>{ if(e.key==="Escape" && $("libFind").value){ $("libFind").value=""; libRender($("libSel").value); } });
$("btnLibSave").addEventListener("click",()=>{
  const dflt=($("partNo").value.trim()||$("client").value.trim()||palletType+" "+$("L").value+"x"+$("W").value);
  const name=(window.prompt("Save design as:",dflt)||"").trim();
  if(!name) return;
  const st=collectState();
  libRun(async()=>{
    if(!libOK) return;
    let r;
    try{ r=await designDB.save(name,st,"browser"); }
    catch(e){
      if(e.kind==="blocked") libOff();
      else { try{ await libReload(); }catch(_){ libOff(); } }
      libRender($("libSel").value);
      toast(e.kind==="full" ? "This browser's storage is full — delete a saved design, or use SAVE FILE"
                            : "Could not save to this browser");
      return;
    }
    try{ await libReload(); }catch(e){ libOff(); }
    libShow(r.id); toast((r.updated?"Updated ":"Saved ")+name); libNotify();
  });
});
$("libSel").addEventListener("change",()=>{
  const v=$("libSel").value; if(v==="") return;
  const d=libRow(v); if(!d) return;
  libRun(async()=>{
    let st;
    try{ st=await designDB.get(d.id); }catch(e){ toast("Could not load: this browser's storage could not be read"); return; }
    if($("libSel").value!==v) return;             // another design was picked meanwhile
    try{ applyState(st,"Loaded "+d.name); }catch(err){ toast("Could not load: "+err.message); }
  });
});
$("btnLibDel").addEventListener("click",()=>{
  const v=$("libSel").value;
  if(v===""){ toast("Pick a saved design first"); return; }
  const d=libRow(v); if(!d) return;
  if(!window.confirm('Delete "'+d.name+'" from this browser?')) return;
  libRun(async()=>{
    let ok=true;
    try{ await designDB.remove(d.id); }catch(e){ ok=false; if(e.kind==="blocked") libOff(); }
    if(libOK){ try{ await libReload(); }catch(e){ libOff(); } }
    libRender(ok ? null : v);
    toast(ok ? "Deleted "+d.name : "Could not delete from this browser");
    if(ok) libNotify();
  });
});
// open the database (moving the older in-browser list into it the first time) and show the list
libRun(async()=>{
  try{ designDB=await designDBOpen(); await libReload(); }catch(e){ libOff(); }
  libRender();
});

