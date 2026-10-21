/* ================= SPEC SHEET (print) ================= */
function buildSpec(m,a,gov){
  const d=new Date().toLocaleDateString();
  const sp = SPECIES[spSel.value].n;
  const client=esc($("client").value.trim()||"—"), partNo=esc($("partNo").value.trim()||"—");
  $("spec").innerHTML = `
    <h1>${m.p.type==="box"?"PALLET BOX":"PALLET"} SPECIFICATION</h1>
    <div class="meta" style="font-size:12px;color:#111;margin-bottom:2px"><b>PART #: ${partNo}</b> · CLIENT: ${client}</div>
    <div class="meta">Generated ${d} · PALLET·LAB in-house tool · ${palletType.toUpperCase()} CLASS · ${m.L}" × ${m.W}" × ${m.H.toFixed(2)}"</div>
    <h2>CONSTRUCTION</h2>
    <table><tr><th>Qty</th><th>Component</th><th>Board feet</th></tr>
      ${m.bom.map(b=>`<tr><td>${b.q}</td><td>${b.d}</td><td>${b.sf!=null? b.sf.toFixed(1)+" ft²" : b.bf.toFixed(2)+" BF"}</td></tr>`).join("")}
      <tr><td></td><td><b>Total lumber — ${sp}</b></td><td><b>${m.totBF.toFixed(2)} BF</b></td></tr>
      ${m.totSF>0?`<tr><td></td><td><b>Total plywood (ISPM-15 exempt)</b></td><td><b>${m.totSF.toFixed(1)} ft² · ${m.sheetTxt} (${m.cut.SW}×${m.cut.SL}″)</b></td></tr>`:""}
    </table>
    <p style="margin-top:6px">Fasteners: ~${m.nails} nails${m.lags?` + ${m.lags} lag screws 5/16×3"`:""} · Estimated tare weight: ${m.weight.toFixed(0)} lb${
      m.p.type==="box" ? ` · Interior clear: ${m.p.iL.toFixed(2)}″ × ${m.p.iW.toFixed(2)}″ × ${m.p.wH}″ (${((m.p.iL*m.p.iW*m.p.wH)/1728).toFixed(1)} ft³)${m.p.edgeCl==="out"?` · Exterior overall: ${m.p.oL.toFixed(2)}″ × ${m.p.oW.toFixed(2)}″ (cleats stand ${m.p.ct}″ proud of base each face)`:""}<br>Corner joint: ${m.p.edgeCl==="out"?`exterior edge cleats lapping the side-to-end joint — nailed from outside through cleat into both panels`:`interior edge cleats inside the corner — panels nailed to cleat, flush exterior`}<br>Base attachment: ${m.p.attach==="skirt"?`skirted — side panels lap ${m.p.lapS}″ and end panels lap ${m.p.lapE}″ over the base, nailed horizontally into it (fasteners in shear)`:`on-deck — bottom rails lag-screwed vertically through deck into stringers (detachable)`}` : ""}</p>
    <h2>${m.det.title}</h2>
    <table>${m.det.groups.map(g=>`<tr><td class="g">${g.title}</td><td class="gv">${
      g.items.map(it=>`${it.k}: ${it.bad?`<span class="bad">${it.v}</span>`:`<b>${it.v}</b>`}${it.note?` <i>(${it.note})</i>`:""}`).join(" · ")
    }</td></tr>`).join("")}</table>
    <div class="keep"><h2>DRAWING</h2>
    <img src="${printDrawingPNG(m)}" style="width:100%;border:1px solid #999"></div>
    <div class="keep"><h2>ESTIMATED LOAD CAPACITY</h2>
    <div class="meta" style="margin:-2px 0 4px">Dry lumber, MC ≤ 19% · Fb ${V("Fb")} psi · E ${(V("E")/1e6).toFixed(2)}×10⁶ psi · SF ${V("SF")} · δ limit ${V("defPct")}% of span</div>
    <table><tr><th>Support condition</th><th>Est. capacity</th><th>Limited by</th></tr>
      ${a.modes.map(x=>`<tr><td>${x.t}${x===gov?" — GOVERNS":""}</td><td>${fmtLb(x.cap)} lb</td><td>${x.gov}</td></tr>`).join("")}
    </table>
    <p class="note">Capacities are internal engineering estimates from simplified beam theory (uniform load, simply supported spans, single-species design values). They are not a PDS® analysis and are not valid for contractual load certification. Verify critical applications by physical test or licensed professional engineer.</p></div>`;
}

