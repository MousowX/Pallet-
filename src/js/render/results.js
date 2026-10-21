function renderDetails(det){
  $("detTitle").textContent=det.title;
  setHTML("det",det.groups.map(g=>
    `<tr class="gh"><td colspan="2">${g.title}</td></tr>`+
    g.items.map(it=>`<tr><td>${it.k}</td><td${it.bad?' class="bad"':''}>${it.v}${it.note?`<small>${it.note}</small>`:""}</td></tr>`).join("")
  ).join(""));
}

/* ================= RENDER: RESULTS ================= */
const fmtLb = n => n>=99999 ? ">99,999" : Math.round(n).toLocaleString();
function renderResults(m,a){
  const gov = a.modes.reduce((min,x)=>x.cap<min.cap?x:min, a.modes[0]);
  setHTML("cards", a.modes.map(x=>`
    <div class="card ${x===gov?'govern':''}">
      <div class="ct"><h3>${x.t}</h3></div>
      <div class="cap ${x.cap<1500?'mid':''}">${fmtLb(x.cap)} <small>lb</small></div>
      <div class="sub"><b>${x.note}</b><br>${x.k==="stack" ? "short-column crush basis · braced by walls" : `limited by ${x.gov} · δ ≈ ${x.defl.toFixed(2)}" at rated load`}</div>
    </div>`).join(""));
  return gov;
}

function renderBOM(m){
  const rows = m.bom.map(b=>`<tr><td>${b.q}×</td><td>${b.d}</td><td>${b.sf!=null? b.sf.toFixed(1)+" ft²" : b.bf.toFixed(2)+" BF"}</td></tr>`).join("");
  setHTML("bom", rows +
    `<tr class="tt"><td></td><td>Total lumber</td><td>${m.totBF.toFixed(2)} BF</td></tr>` +
    (m.totSF>0?`<tr class="tt"><td></td><td>Total plywood</td><td>${m.totSF.toFixed(1)} ft² · ${m.sheetTxt} (${m.cut.SW}×${m.cut.SL})</td></tr>`:"") +
    `<tr class="tt"><td></td><td>Fasteners est. / weight est.</td><td>${m.nails} nails${m.lags?` · ${m.lags} lags 5/16×3"`:""} · ${m.weight.toFixed(0)} lb</td></tr>`);
}

