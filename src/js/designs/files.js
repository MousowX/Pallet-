/* ---- design file ---- */
const slug = s => (s||"").trim().replace(/[^\p{L}\p{N}_.-]+/gu,"-").replace(/^-+|-+$/g,"");
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
});
$("btnFileLoad").addEventListener("click",()=>$("fileIn").click());
$("fileIn").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    let st=null;
    try{ st=JSON.parse(r.result); }catch(e){ /* not JSON: reported below like any other wrong file */ }
    try{ applyState(st, "Loaded "+file.name); }
    catch(err){ toast("Could not load "+file.name+": "+err.message); }
    $("fileIn").value="";
  };
  r.onerror=()=>{ toast("Could not read that file"); $("fileIn").value=""; };
  r.readAsText(file);
});

