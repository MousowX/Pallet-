/* ================= RENDER: CUT LIST (whole order) ================= */
const fmtBF = v => (v<1000 ? v.toFixed(2) : Math.round(v).toLocaleString())+" BF";
const SHEET_SCREEN={pad:0.8, sheet:"#15171b", fill:"rgba(202,160,106,.30)", line:"#8b929c", sw:0.6, text:false};
const SHEET_PAPER ={pad:0.8, sheet:"#ffffff", fill:"rgba(190,150,90,.22)", line:"#333333", sw:0.3, text:true, fs:2.8, txt:"#222222"};
const shortName = lbls => Object.keys(lbls).map(x=>x.replace(/ (panel|cleat)$/,"")).join("/");
const partDims = t => t.rot ? `${inch(t.w).slice(0,-1)}×${inch(t.h).slice(0,-1)}` : inch(t.h);   // strips: length only
// one sheet layout as SVG: portrait, sheet length running down
function sheetSVG(pt,types,SW,SL,o){
  let s=`<svg viewBox="${-o.pad} ${-o.pad} ${SW+2*o.pad} ${SL+2*o.pad}" xmlns="http://www.w3.org/2000/svg">`+
        `<rect x="0" y="0" width="${SW}" height="${SL}" fill="${o.sheet}" stroke="${o.line}" stroke-width="${o.sw}" stroke-dasharray="${o.sw*4} ${o.sw*3}"/>`;
  pt.placed.forEach(q=>{
    const t=types[q.i];
    s+=`<rect x="${+q.x.toFixed(3)}" y="${+q.y.toFixed(3)}" width="${+q.w.toFixed(3)}" height="${+q.h.toFixed(3)}" fill="${o.fill}" stroke="${o.line}" stroke-width="${o.sw}"/>`;
    if(!o.text) return;
    const txt=`${shortName(t.labels)} ${partDims(t)}`, fs=o.fs, len=txt.length*fs*0.58;
    const vert=q.h>q.w, room=vert?q.h:q.w, thick=vert?q.w:q.h;
    if(len>room-1 || fs>thick-0.5) return;           // too small to label — the caption lists it
    const cx=(q.x+q.w/2).toFixed(2), cy=(q.y+q.h/2).toFixed(2);
    s+=`<text x="${cx}" y="${cy}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${o.txt}" font-family="Arial,sans-serif"${vert?` transform="rotate(-90 ${cx} ${cy})"`:""}>${esc(txt)}</text>`;
  });
  return s+"</svg>";
}
// what one layout holds: "Side 48×32.5 ×1 · Lid 48×40 ×1"
function layoutParts(pt,types){
  const c=new Map(); pt.placed.forEach(q=>c.set(q.i,(c.get(q.i)||0)+1));
  return [...c].map(([i,n])=>`${shortName(types[i].labels)} ${partDims(types[i])} ×${n}`).join(" · ");
}
function spliceNotes(c){
  return c.splices.map(x=>{
    const n=x.pieces.reduce((a,q)=>a+q.n,0);
    const list=x.pieces.map(q=>(q.n>1?q.n+" × ":"")+(x.strip?inch(q.h):sizeTxt(q.w,q.h))).join(" + ");
    if(x.strip) return `${x.label} ${inch(x.h)} is longer than the sheet — cut ${n} pieces (${list}) and join them with a splice plate`;
    return `${x.label} ${sizeTxt(x.w,x.h)} is bigger than the sheet — made of ${n} pieces (${list}); `+
      (x.label==="Floor panel" ? "joints must land on a stringer or board" : "back each joint with a cleat");
  });
}
function renderCut(m){
  const c=m.cut, n=c.N;
  $("cutTitle").textContent=`CUT LIST — ORDER OF ${n.toLocaleString()}`;
  let h="";
  if(c.lumber.length){
    h+=`<div class="grp">LUMBER PIECES</div><table class="bom">`+
      c.lumber.map(o=>`<tr><td>${o.qN.toLocaleString()}×</td><td>${sizeTxt(o.t,o.w,o.len)}<small>${[...o.uses].map(([u,q])=>`${u} ${q}`).join(" · ")} per unit${o.op?` · ${o.op}`:""}</small></td><td>${fmtBF(o.bfN)}</td></tr>`).join("")+
      `<tr class="tt"><td></td><td>Total lumber</td><td>${fmtBF(c.bfN)}</td></tr></table>`;
  }
  c.ply.forEach(s=>{
    h+=`<div class="grp">PLYWOOD ${frac(s.th)} · ${s.sheets.toLocaleString()} SHEET${s.sheets===1?"":"S"}</div>`+
       `<div class="cutNote">${c.SW}×${c.SL} sheets · <b>${Math.round(s.used*100)}%</b> of the wood used · ${frac(c.kerf)} saw cut between parts</div>`+
       `<div class="sheets">`+s.patterns.slice(0,8).map(pt=>`<figure title="${esc(layoutParts(pt,s.types))}">${sheetSVG(pt,s.types,c.SW,c.SL,SHEET_SCREEN)}<figcaption><b>×${pt.rep.toLocaleString()}</b> · ${pt.placed.length} part${pt.placed.length===1?"":"s"}</figcaption></figure>`).join("")+`</div>`+
       (s.patterns.length>8?`<div class="cutNote">+ ${s.patterns.length-8} more layouts on the printed cut list</div>`:"")+
       (s.uncut?`<div class="cutNote" style="color:var(--bad)">${s.uncut} parts could not be placed on a sheet</div>`:"");
  });
  spliceNotes(c).forEach(t=>{ h+=`<div class="cutNote">⚠ ${t}</div>`; });
  h+=`<div class="cutNote">Nails ≈ <b>${(m.nails*n).toLocaleString()}</b>${m.lags?` · lag screws <b>${(m.lags*n).toLocaleString()}</b>`:""}${c.ply.length?" · hover a sheet for its parts":""}</div>`;
  $("cutList").innerHTML=h;
}
// printable cut list — for the shop, or for whoever supplies the wood
function buildCutSheet(m){
  const c=m.cut, n=c.N, d=new Date().toLocaleDateString();
  const client=esc($("client").value.trim()||"—"), partNo=esc($("partNo").value.trim()||"—");
  let h=`<h1>CUT LIST</h1>
    <div class="meta" style="font-size:12px;color:#111;margin-bottom:2px"><b>PART #: ${partNo}</b> · CLIENT: ${client} · <b>ORDER: ${n.toLocaleString()} ${n===1?"unit":"units"}</b></div>
    <div class="meta">Generated ${d} · PALLET·LAB in-house tool · ${m.p.type==="box"?"PALLET BOX":palletType.toUpperCase()+" PALLET"} · ${m.L}" × ${m.W}" × ${m.H.toFixed(2)}" · quantities are for the whole order</div>`;
  if(c.lumber.length) h+=`<h2>LUMBER — ${SPECIES[spSel.value].n}</h2>
    <table><tr><th>Qty</th><th>Piece — thickness × width × length</th><th>Per unit</th><th>Board feet</th></tr>
    ${c.lumber.map(o=>`<tr><td>${o.qN.toLocaleString()}</td><td>${sizeTxt(o.t,o.w,o.len)}${o.op?` · ${o.op}`:""}</td><td>${[...o.uses].map(([u,q])=>`${u} ${q}`).join(" · ")}</td><td>${fmtBF(o.bfN)}</td></tr>`).join("")}
    <tr><td></td><td><b>Total lumber</b></td><td></td><td><b>${fmtBF(c.bfN)}</b></td></tr></table>`;
  if(c.ply.length){
    h+=`<h2>PLYWOOD — ${c.SW}×${c.SL}″ SHEETS · ${frac(c.kerf)} SAW CUT</h2>
    <table><tr><th>Thickness</th><th>Sheets</th><th>Parts per unit</th><th>Wood used</th></tr>
    ${c.ply.map(s=>`<tr><td>${frac(s.th)}</td><td><b>${s.sheets.toLocaleString()}</b></td><td>${s.types.map(t=>`${shortName(t.labels)} ${partDims(t)} ×${Object.values(t.labels).reduce((a,b)=>a+b,0)}`).join(" · ")}</td><td>${Math.round(s.used*100)}%</td></tr>`).join("")}</table>`;
    c.ply.forEach(s=>{
      h+=`<div class="keep"><h3>${frac(s.th)} — ${s.patterns.length} LAYOUT${s.patterns.length===1?"":"S"} · ${s.sheets.toLocaleString()} SHEET${s.sheets===1?"":"S"}</h3>
        <div class="sheets">${s.patterns.map(pt=>`<figure>${sheetSVG(pt,s.types,c.SW,c.SL,SHEET_PAPER)}<figcaption><b>${pt.rep.toLocaleString()} ${pt.rep===1?"sheet":"sheets"}</b> · ${layoutParts(pt,s.types)}</figcaption></figure>`).join("")}</div></div>`;
    });
    const notes=[...spliceNotes(c),
      "Cleat strips are ripped along the face grain (the sheet's length); panels may be turned.",
      `Layouts use straight through-cuts with ${frac(c.kerf)} for each saw cut.`];
    h+=`<p class="cutNote" style="margin-top:6px">${notes.join("<br>")}</p>`;
  }
  h+=`<p class="cutNote" style="margin-top:6px">Fasteners for the order: ~${(m.nails*n).toLocaleString()} nails${m.lags?` + ${(m.lags*n).toLocaleString()} lag screws 5/16×3"`:""}. Lumber sizes are finished sizes; add trim allowance when cutting from longer stock.</p>`;
  $("cutSheet").innerHTML=h;
}

