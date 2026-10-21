/* ================= DESIGN DATABASE — every saved design, kept in this browser ================= */
// One database (IndexedDB) holds every design: the ones saved here, every design file saved or loaded,
// and files imported in bulk. It has two stores, so the list never has to read the designs themselves:
//   list   {id, name, type, client, partNo, saved, source}   one small row per design (id: order added)
//   files  {id, state}                                        the design file, read only when it is opened
// A save writes one design instead of rewriting the whole list, the list is read once per change and
// searched in memory, and nothing runs while the tool is idle. Designs are stored in the design file
// format ({fmt, type, saved, f}), so applyState opens them exactly like a file.
// Where IndexedDB is missing or refused, the same calls use the older in-browser list (localStorage
// "palletlab.designs"), as the tool always did. Designs in that list move into the database the first
// time it opens; the old list is kept as it was under "palletlab.designs.backup".
const LIB="palletlab.designs", LIB_BACKUP=LIB+".backup", LIB_PING=LIB+".changed";
const DB_NAME="palletlab", DB_VERSION=1;

// what went wrong, in the terms the list reports: "full", "blocked" (storage refused) or "other"
function dbError(kind,cause){ const e=new Error(cause && cause.message || kind); e.kind=kind; return e; }
const isQuota=e=>/quota/i.test(e && e.name || "");

// entries of the older list that can be used: a name and a design (anything else is left out)
function legacyList(raw){
  let v; try{ v=JSON.parse(raw||"[]"); }catch(e){ return []; }
  return Array.isArray(v) ? v.filter(d=>d && typeof d==="object" && typeof d.name==="string" && d.name.trim()
                                       && d.state && typeof d.state==="object") : [];
}
// a design's row in the list: what the list shows and what a search looks at
function designRow(name,state,source){
  const f = state.f && typeof state.f==="object" ? state.f : {}, s=v=>typeof v==="string" ? v : "";
  return {name, type:s(state.type)||"stringer", client:s(f.client), partNo:s(f.partNo),
          saved:state.saved ? String(state.saved) : "", source};
}

/* ---- IndexedDB ---- */
function idbOpen(){
  return new Promise((ok,no)=>{
    let rq;
    try{ rq=indexedDB.open(DB_NAME,DB_VERSION); }catch(e){ no(e); return; }      // missing, or refused outright
    rq.onupgradeneeded=()=>{
      const db=rq.result;
      if(!db.objectStoreNames.contains("list"))
        db.createObjectStore("list",{keyPath:"id",autoIncrement:true}).createIndex("name","name",{unique:true});
      if(!db.objectStoreNames.contains("files")) db.createObjectStore("files",{keyPath:"id"});
    };
    rq.onsuccess=()=>{ const db=rq.result; db.onversionchange=()=>db.close(); ok(db); };   // let a newer version upgrade it
    rq.onerror=()=>no(rq.error);
  });
}
function idbBackend(db){
  // one transaction over both stores: `work` queues its requests and fills `out`. Every callback is
  // guarded, and any error aborts the whole transaction, so a design is never half written
  const run=(mode,work)=>new Promise((ok,no)=>{
    let t, failed=null; const out={};
    const fail=e=>{ if(!failed){ failed=e; try{ t.abort(); }catch(_){} } };
    const guard=fn=>(...a)=>{ try{ fn(...a); }catch(e){ fail(e); } };
    try{ t=db.transaction(["list","files"],mode); }catch(e){ no(dbError(isQuota(e)?"full":"other",e)); return; }
    t.oncomplete=()=>ok(out);
    t.onabort=()=>{ const e=failed||t.error; no(dbError(isQuota(e)?"full":"other",e)); };
    try{ work(t.objectStore("list"), t.objectStore("files"), out, guard); }catch(e){ fail(e); }
  });
  // add a design, or replace the one with the same name (it keeps its place in the list); done(id, updated)
  const upsert=(list,files,guard,{name,state,source},done)=>{
    const rq=list.index("name").getKey(name);
    rq.onsuccess=guard(()=>{
      const row=designRow(name,state,source), id=rq.result;
      if(id!==undefined){ row.id=id; list.put(row); files.put({id,state}); done(id,true); return; }
      const add=list.add(row);
      add.onsuccess=guard(()=>{ files.put({id:add.result,state}); done(add.result,false); });
    });
  };
  return {
    kind:"db",
    list:()=>run("readonly",(list,files,out,guard)=>{
      const rq=list.getAll();
      rq.onsuccess=guard(()=>{ out.rows=rq.result.filter(r=>r && typeof r.name==="string" && r.name.trim()); });
    }).then(o=>o.rows),
    get:id=>run("readonly",(list,files,out,guard)=>{
      const rq=files.get(id);
      rq.onsuccess=guard(()=>{ out.state=rq.result ? rq.result.state : undefined; });
    }).then(o=>o.state),
    save:(name,state,source)=>run("readwrite",(list,files,out,guard)=>
      upsert(list,files,guard,{name,state,source},(id,updated)=>{ out.id=id; out.updated=updated; })),
    // many designs in one transaction (all or nothing), one after the other so repeated names update
    saveMany:items=>run("readwrite",(list,files,out,guard)=>{
      out.added=0; out.updated=0;
      const next=i=>{ if(i<items.length) upsert(list,files,guard,items[i],(id,upd)=>{ out[upd?"updated":"added"]++; next(i+1); }); };
      next(0);
    }),
    remove:id=>run("readwrite",(list,files)=>{ list.delete(id); files.delete(id); }).then(()=>{}),
  };
}
// the first time the database opens, the designs of the older in-browser list move into it, in order
async function idbMigrate(be){
  let raw=null;
  try{ raw=localStorage.getItem(LIB); }catch(e){ return; }       // storage blocked: nothing to move
  if(raw==null) return;
  const items=legacyList(raw).map(d=>({name:d.name, state:d.state, source:"browser"}));
  if(items.length) await be.saveMany(items);                     // fails → the old list stays for next time
  try{ localStorage.removeItem(LIB); localStorage.setItem(LIB_BACKUP,raw); }catch(e){}
}

/* ---- the older in-browser list (localStorage): used only where IndexedDB can't be ---- */
// The whole list is one JSON value, read and written as the tool always did; a design's id is its name.
const localBackend={
  kind:"local",
  read(){ let raw; try{ raw=localStorage.getItem(LIB); }catch(e){ throw dbError("blocked",e); } return legacyList(raw); },
  // a full storage is not a blocked one: the list stays on so designs can be deleted to make room
  write(list){ try{ localStorage.setItem(LIB,JSON.stringify(list)); }catch(e){ throw dbError(isQuota(e)?"full":"blocked",e); } },
  async list(){ return this.read().map(d=>({id:d.name, ...designRow(d.name,d.state,"browser")})); },
  async get(id){ const d=this.read().find(d=>d.name===id); return d ? d.state : undefined; },
  async save(name,state){
    const list=this.read(), at=list.findIndex(d=>d.name===name);
    if(at>=0) list[at]={name,state}; else list.push({name,state});
    this.write(list); return {id:name, updated:at>=0};
  },
  async saveMany(items){
    const list=this.read(); let updated=0;
    items.forEach(({name,state})=>{ const at=list.findIndex(d=>d.name===name);
      if(at>=0){ list[at]={name,state}; updated++; } else list.push({name,state}); });
    this.write(list); return {added:items.length-updated, updated};
  },
  async remove(id){
    const list=this.read(), at=list.findIndex(d=>d.name===id);
    if(at>=0){ list.splice(at,1); this.write(list); }
  },
};

// the database, or the older list where IndexedDB can't be used. Rejects with kind "blocked" when this
// browser refuses storage altogether.
async function designDBOpen(){
  let db=null;
  try{ db=await idbOpen(); }catch(e){ db=null; }
  if(db){ const be=idbBackend(db); try{ await idbMigrate(be); }catch(e){ /* tried again next time */ } return be; }
  localBackend.read();
  return localBackend;
}
