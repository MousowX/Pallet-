/* ---- the shared list: the design list kept in Supabase (pilot) ---- */
// The same calls as the database in db.js (list, get, save, saveMany, remove), over Supabase's REST API
// with plain fetch — nothing to download. Sign-in is email and password; the session stays in this
// browser (localStorage) and is renewed when it runs out. Only the members in supabase/schema.sql can
// read or change a design. Without a connection, or signed out, the list is this browser's, as before.
const CLOUD_SESSION="palletlab.cloud.session";
const cloudOn = () => !!(CLOUD.url && CLOUD.key);
const cloudBase = () => CLOUD.url.replace(/\/+$/,"");
function cloudSession(){
  try{ const s=JSON.parse(localStorage.getItem(CLOUD_SESSION)||"null");
       return s && typeof s.access_token==="string" && typeof s.refresh_token==="string" ? s : null; }catch(e){ return null; }
}
function cloudKeep(s){ try{ if(s) localStorage.setItem(CLOUD_SESSION,JSON.stringify(s)); else localStorage.removeItem(CLOUD_SESSION); }catch(e){} }
// Supabase Auth: a session from a sign-in or a renewal
async function cloudAuth(path,body,token){
  let r;
  try{ r=await fetch(cloudBase()+"/auth/v1/"+path,{method:"POST",
         headers:{apikey:CLOUD.key,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
         body:JSON.stringify(body||{})}); }
  catch(e){ throw dbError("offline",e); }
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw dbError(r.status>=400 && r.status<500 ? "denied" : "other",
                          {message:j.error_description||j.msg||j.message||("HTTP "+r.status)});
  return j;
}
const cloudFrom = (j,email) => ({access_token:j.access_token, refresh_token:j.refresh_token,
  expires_at: j.expires_at || Math.floor(Date.now()/1000)+(j.expires_in||3600), email:(j.user && j.user.email) || email || ""});
async function cloudSignIn(email,password){
  const s=cloudFrom(await cloudAuth("token?grant_type=password",{email,password}),email);
  cloudKeep(s); return s;
}
// a valid access token, renewed a minute before it runs out (or now, `force`). One renewal at a time;
// a refused renewal signs out, unless another tab has just renewed the session itself
let cloudRenewing=null;
function cloudToken(force){
  const s=cloudSession();
  if(!s) return Promise.reject(dbError("signedout"));
  if(!force && s.expires_at-60>Date.now()/1000) return Promise.resolve(s.access_token);
  if(!cloudRenewing) cloudRenewing=(async()=>{
    try{
      const n=cloudFrom(await cloudAuth("token?grant_type=refresh_token",{refresh_token:s.refresh_token}),s.email);
      cloudKeep(n); return n.access_token;
    }catch(e){
      if(e.kind!=="denied") throw e;
      const t=cloudSession();
      if(t && t.refresh_token!==s.refresh_token) return t.access_token;
      cloudKeep(null); throw dbError("signedout",e);
    }finally{ cloudRenewing=null; }
  })();
  return cloudRenewing;
}
// one REST call; a token that ran out on the way is renewed and the call made once more
async function cloudREST(method,path,body,prefer){
  const go=async token=>{
    try{ return await fetch(cloudBase()+"/rest/v1/"+path,{method,
           headers:{apikey:CLOUD.key,Authorization:"Bearer "+token,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})},
           body:body===undefined ? undefined : JSON.stringify(body)}); }
    catch(e){ throw dbError("offline",e); }
  };
  let r=await go(await cloudToken());
  if(r.status===401) r=await go(await cloudToken(true));
  if(r.status===401){ cloudKeep(null); throw dbError("signedout"); }
  const txt=await r.text(); let j=null;
  try{ j=txt ? JSON.parse(txt) : null; }catch(e){}
  if(!r.ok) throw dbError(r.status===403 ? "denied" : "other", {message:(j && j.message) || ("HTTP "+r.status)});
  return j;
}
const cloudBackend={
  kind:"cloud", where:"the shared list",
  async list(){
    const rows=[], page=1000;
    for(let off=0;;off+=page){
      const got=await cloudREST("GET",`designs?select=id,name,type,client,part_no,saved,updated_by&order=id.asc&limit=${page}&offset=${off}`)||[];
      got.forEach(r=>rows.push({id:r.id, name:r.name, type:r.type, client:r.client, partNo:r.part_no, saved:r.saved, by:r.updated_by}));
      if(got.length<page) return rows;
    }
  },
  async get(id){
    const got=await cloudREST("GET",`designs?select=state&id=eq.${encodeURIComponent(id)}`);
    return got && got[0] ? got[0].state : undefined;
  },
  async save(name,state,source){
    const got=await cloudREST("POST","rpc/save_design",{p_name:name, p_state:state, p_source:source||""});
    if(!got || !got[0]) throw dbError("denied");
    return {id:got[0].id, updated:!!got[0].updated};
  },
  async saveMany(items){
    const got=await cloudREST("POST","rpc/save_designs",{p_items:items.map(({name,state,source})=>({name,state,source:source||""}))});
    const r=(got && got[0]) || {added:0, updated:0};
    return {added:r.added, updated:r.updated};
  },
  async remove(id){ await cloudREST("DELETE",`designs?id=eq.${encodeURIComponent(id)}`,undefined,"return=minimal"); },
};
// what a failed step on the shared list tells the person
function cloudWhy(e){
  return e.kind==="offline" ? "could not reach the shared list — check the internet connection"
       : e.kind==="signedout" ? "signed out of the shared list — sign in again"
       : e.kind==="denied" ? "this account can't change the shared list"
       : "the shared list refused it"+(e.message ? ` (${e.message})` : "");
}
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

// switch the list to the shared one; false (this browser's list stays) when it can't be used.
// Runs inside a libRun step.
async function cloudStart(){
  try{
    if((await cloudREST("POST","rpc/is_member",{}))!==true){
      const s=cloudSession(); cloudKeep(null);
      if(s) cloudAuth("logout",{},s.access_token).catch(()=>{});
      toast("This account is not a member of the shared list — ask to be added");
      return false;
    }
    designDB=cloudBackend; await libReload();
    clearInterval(cloudLookT); cloudLookT=setInterval(cloudLook,60000);
  }catch(e){
    designDB=libLocal; await libReloadSafe();
    toast(e.kind==="signedout" ? "Signed out of the shared list — sign in again"
        : e.kind==="offline" ? "Could not reach the shared list — showing this browser's list"
        : "The shared list could not be opened — showing this browser's list");
    return false;
  }
  return true;
}
// back to this browser's list (signed out, or the session could not be renewed). Inside a libRun step.
async function cloudStop(msg){
  clearInterval(cloudLookT); cloudLookT=0;
  designDB=libLocal; $("libFind").value="";
  await libReloadSafe(); libRender(); cloudUI();
  if(msg) toast(msg);
}
function cloudUI(){
  const on=cloudOn() && libOK && !!libLocal, shared=!!designDB && designDB.kind==="cloud";
  $("cloudBox").style.display = on ? "" : "none";
  $("cloudSignedOut").style.display = on && !shared ? "" : "none";
  $("cloudSignedIn").style.display = on && shared ? "" : "none";
  const s=cloudSession();
  $("cloudUser").textContent = shared && s ? s.email : "";
  $("secLib").classList.toggle("shared", shared);
}
// other people change the shared list too: look again when this page comes back into view, and every
// minute while it is in view — only while the shared list is in use (a hidden page asks nothing)
let cloudLookT=0;
const cloudLook = () => { if(designDB && designDB.kind==="cloud" && document.visibilityState!=="hidden") libChanged(); };
window.addEventListener("focus",cloudLook);
document.addEventListener("visibilitychange",cloudLook);

function cloudSignInClick(){
  const email=$("cloudEmail").value.trim(), pw=$("cloudPass").value;
  if(!email || !pw){ toast("Enter the email and password of your shared-list account"); return; }
  libRun(async()=>{
    try{ await cloudSignIn(email,pw); }
    catch(e){
      toast(e.kind==="offline" ? "Could not reach the shared list — check the internet connection"
          : e.kind==="denied" && /invalid login credentials/i.test(e.message) ? "Could not sign in: wrong email or password"
          : "Could not sign in: "+e.message);
      return;
    }finally{ $("cloudPass").value=""; }
    const ok=await cloudStart();
    $("libFind").value=""; libRender(); cloudUI();
    if(ok) toast("Signed in — this is the shared list");
  });
}
$("btnCloudIn").addEventListener("click",cloudSignInClick);
$("cloudPass").addEventListener("keydown",e=>{ if(e.key==="Enter") cloudSignInClick(); });
$("btnCloudOut").addEventListener("click",()=>{
  libRun(async()=>{
    const s=cloudSession(); cloudKeep(null);
    if(s) cloudAuth("logout",{},s.access_token).catch(()=>{});   // ends the session on the server too; signed out here either way
    await cloudStop("Signed out — this is this browser's list");
  });
});
// copy every design of this browser's list into the shared list (designs there with the same name are replaced)
$("btnCloudCopy").addEventListener("click",()=>{
  libRun(async()=>{
    if(!designDB || designDB.kind!=="cloud") return;
    let items=[];
    try{
      for(const r of await libLocal.list()){ const st=await libLocal.get(r.id); if(st && typeof st==="object") items.push({name:r.name, state:st, source:"browser"}); }
    }catch(e){ toast("Could not read this browser's list"); return; }
    if(!items.length){ toast("This browser's list is empty — nothing to copy"); return; }
    if(!window.confirm(`Copy the ${items.length} design${items.length===1?"":"s"} saved in this browser to the shared list? Designs there with the same name are replaced.`)) return;
    let r;
    try{ r=await designDB.saveMany(items); }
    catch(e){ if(e.kind==="signedout") await cloudStop(); toast("Nothing copied: "+cloudWhy(e)); return; }
    const keep=$("libSel").value; await libReloadSafe(); libRender(keep==="" ? null : keep); libNotify();
    const n=r.added+r.updated;
    toast(`Copied ${n} design${n===1?"":"s"} to the shared list`+(r.updated ? ` (${r.updated} replaced one of the same name)` : ""));
  });
});
