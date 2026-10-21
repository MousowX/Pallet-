/* ================= FOLDING PANELS — screen only ================= */
// Every panel section (data-fold) opens and closes from its title. A closed input section shows a
// one-line summary of what it holds, so nothing that changes the numbers is hidden without a trace.
// The help notes (.hint) sit behind a "?" on the title. The browser remembers both (localStorage);
// nothing here touches a design, a result, the drawing or the printouts.
const FOLD_KEY="palletlab.ui.folds";
let foldState={closed:[], help:[]};
try{ const v=JSON.parse(localStorage.getItem(FOLD_KEY)||"null");
     if(v && Array.isArray(v.closed) && Array.isArray(v.help)) foldState={closed:v.closed.filter(x=>typeof x==="string"), help:v.help.filter(x=>typeof x==="string")}; }catch(e){}
const foldKeep = () => { try{ localStorage.setItem(FOLD_KEY,JSON.stringify(foldState)); }catch(e){} };
const foldSecs = () => [...document.querySelectorAll(".sec[data-fold]")];
// one line per closed input section, from the design as last worked out
const FOLD_SUMMARY={
  id:        m=>[$("partNo").value.trim(), $("client").value.trim()].filter(Boolean).join(" · ")+(m.cut.N>1 ? ` · ${m.cut.N.toLocaleString()} pcs` : ""),
  footprint: m=>`${inch(m.L)} × ${inch(m.W)}`,
  top:       m=>m.p.type==="box" && !m.p.hasB ? `${frac(m.p.fPT)} triplay floor`
                : `${m.p.topIv.length} boards · ${inch(m.p.dT)}`+(m.p.type==="box" && m.p.hasP ? ` + ${frac(m.p.fPT)} triplay` : ""),
  bottom:    m=>m.p.botIv.length ? `${m.p.botIv.length} boards · ${inch(m.p.bT)}` : "none",
  stringers: m=>`${m.p.sC} × ${inch(m.p.sB).slice(0,-1)}×${inch(m.p.sH)}`+(m.p.notch ? " · notched" : ""),
  blocks:    m=>`${m.p.nBL}×${m.p.nBW} blocks · ${inch(m.p.k)}`,
  box:       m=>`${inch(m.p.wH)} walls · ${frac(m.p.pT)} ply`+(m.p.lid ? " · lid" : ""),
  // the values the calculation uses (V keeps them inside each input's limits)
  material:  ()=>`${(SPECIES[spSel.value]||{n:""}).n.split(" — ")[0]} · Fb ${V("Fb")}`,
  analysis:  ()=>`SF ${Math.max(1,V("SF"))} · δ ${V("defPct")}%`,
};
function foldSummaries(m){
  foldSecs().forEach(sec=>{
    const f=FOLD_SUMMARY[sec.dataset.fold], out=sec.querySelector(":scope > h2 > .foldSum");
    if(!f || !out) return;
    // a section the pallet type hides has nothing to sum up; a summary never stops the update
    let t=""; if(sec.style.display!=="none"){ try{ t=f(m); }catch(e){ t=""; } }
    if(out.textContent!==t){ out.textContent=t; out.title=t; }     // the whole line on hover when it is cut short
  });
}
function foldApply(sec){
  const k=sec.dataset.fold, closed=foldState.closed.includes(k), help=foldState.help.includes(k);
  sec.classList.toggle("collapsed",closed);
  sec.classList.toggle("helpOn",help);
  const h=sec.querySelector(":scope > h2");
  h.setAttribute("aria-expanded",String(!closed));
  const q=h.querySelector(".helpBtn"); if(q){ q.setAttribute("aria-pressed",String(help)); q.title=help ? "Hide the notes" : "Show the notes"; }
}
const foldFlip = (list,k) => { const i=list.indexOf(k); if(i>=0) list.splice(i,1); else list.push(k); };
foldSecs().forEach(sec=>{
  const k=sec.dataset.fold, h=sec.querySelector(":scope > h2");
  sec.classList.add("foldable");
  h.setAttribute("role","button"); h.tabIndex=0;
  // the titles of the results panels are rewritten by the tool (PALLET DETAILS, CUT LIST — ORDER OF …):
  // they get no extra parts, only the open/close arrow (CSS)
  if(!h.id){
    if(FOLD_SUMMARY[k]){ const s=document.createElement("span"); s.className="foldSum"; h.appendChild(s); }
    if(sec.querySelector(".hint")){
      const q=document.createElement("button"); q.type="button"; q.className="helpBtn"; q.textContent="?";
      q.setAttribute("aria-label","Notes for "+h.firstChild.textContent.trim().toLowerCase());
      q.addEventListener("click",e=>{ e.stopPropagation(); foldFlip(foldState.help,k); foldKeep(); foldApply(sec); });
      q.addEventListener("keydown",e=>e.stopPropagation());
      h.appendChild(q);
    }
  }
  const flip=()=>{ foldFlip(foldState.closed,k); foldKeep(); foldApply(sec); };
  h.addEventListener("click",flip);
  h.addEventListener("keydown",e=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); flip(); } });
  foldApply(sec);
});
