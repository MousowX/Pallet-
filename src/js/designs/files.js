/* ---- design file ---- */
// Every file saved or loaded also goes into the design list (libAdd), under the file's name.
const slug = s => (s||"").trim().replace(/[^\p{L}\p{N}_.-]+/gu,"-").replace(/^-+|-+$/g,"");
// the list name of a design file: its file name without ".pltlab.json" / ".json"
const fileDesignName = n => n.replace(/\.pltlab\.json$/i,"").replace(/\.json$/i,"") || n;
$("btnFileSave").addEventListener("click",()=>{
  const st=collectState();
  const name=[slug($("partNo").value), slug($("client").value), palletType]
             .filter(Boolean).join("_") || "pallet-design";
  const blob=new Blob([JSON.stringify(st,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name+".pltlab.json";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},0);
  toast("Saved "+a.download);
  libAdd(name, st, "file", "Saved "+a.download);
});
$("btnFileLoad").addEventListener("click",()=>$("fileIn").click());
$("fileIn").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    let st=null, ok=false;
    try{ st=JSON.parse(r.result); }catch(e){ /* not JSON: reported below like any other wrong file */ }
    try{ applyState(st, "Loaded "+file.name); ok=true; }
    catch(err){ toast("Could not load "+file.name+": "+err.message); }
    $("fileIn").value="";
    if(ok) libAdd(fileDesignName(file.name), st, "file", "Loaded "+file.name);
  };
  r.onerror=()=>{ toast("Could not read that file"); $("fileIn").value=""; };
  r.readAsText(file);
});
// many design files at once, straight into the list (the design on screen stays as it is)
$("btnImport").addEventListener("click",()=>$("importIn").click());
$("importIn").addEventListener("change",e=>{
  const files=[...e.target.files];
  $("importIn").value="";                // the same files can be picked again
  if(files.length) libImport(files);
});
// a file's text, or null when it can't be read
const readText = file => new Promise(ok=>{
  const r=new FileReader();
  r.onload=()=>ok(String(r.result)); r.onerror=()=>ok(null);
  r.readAsText(file);
});

