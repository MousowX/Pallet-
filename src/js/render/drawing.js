/* ================= 2D SPEC DRAWING ================= */
const PAL_SCREEN={bg:null, halo:"#15171b", line:"#b9c4d0", fill:"rgba(202,160,106,.16)", fill2:"rgba(202,160,106,.30)",
                  hid:"#6d7683", dim:"#e8a33d", txt:"#e8a33d", lab:"#5b616b"};
const PAL_PAPER ={bg:"#ffffff", line:"#1a1a1a", fill:"rgba(190,150,90,.22)", fill2:"rgba(190,150,90,.40)",
                  hid:"#8a8a8a", dim:"#8a5510", txt:"#8a5510", lab:"#666666"};

function drawSpec2D(c2,w,h,m,pal,inset=0){   // inset: room kept clear at the top (screen header label)
  const p=m.p, L=m.L, W=m.W, H=m.H;
  const bk = p.base || p.type;      // a box carries its own base kind
  c2.clearRect(0,0,w,h);
  if(pal.bg){ c2.fillStyle=pal.bg; c2.fillRect(0,0,w,h); }
  c2.lineWidth=1; c2.font="10px 'JetBrains Mono',monospace";

  /* ---- helpers ---- */
  const R=(x,y,dw,dh,fill)=>{ c2.fillStyle=fill; c2.fillRect(x,y,dw,dh);
    c2.strokeStyle=pal.line; c2.strokeRect(x,y,dw,dh); };
  const dashRect=(x,y,dw,dh)=>{ c2.save(); c2.setLineDash([4,3]); c2.strokeStyle=pal.hid;
    c2.strokeRect(x,y,dw,dh); c2.restore(); };
  const dashLine=(x1,y1,x2,y2)=>{ c2.save(); c2.setLineDash([4,3]); c2.strokeStyle=pal.hid;
    c2.beginPath(); c2.moveTo(x1,y1); c2.lineTo(x2,y2); c2.stroke(); c2.restore(); };
  const arrow=(x,y,dir)=>{ // dir: 0=left 1=right 2=up 3=down
    c2.beginPath();
    if(dir===0){c2.moveTo(x,y);c2.lineTo(x+6,y-2.6);c2.lineTo(x+6,y+2.6);}
    if(dir===1){c2.moveTo(x,y);c2.lineTo(x-6,y-2.6);c2.lineTo(x-6,y+2.6);}
    if(dir===2){c2.moveTo(x,y);c2.lineTo(x-2.6,y+6);c2.lineTo(x+2.6,y+6);}
    if(dir===3){c2.moveTo(x,y);c2.lineTo(x-2.6,y-6);c2.lineTo(x+2.6,y-6);}
    c2.closePath(); c2.fillStyle=pal.dim; c2.fill(); };
  // dimension lines: extension lines run from the feature to just past the dimension line;
  // a gap too narrow for two arrows gets them outside, pointing in
  const dimH=(x1,x2,y,label,ext1,ext2)=>{
    c2.strokeStyle=pal.dim;
    c2.beginPath();
    const tick=(x,e)=>{ if(e==null) return; c2.moveTo(x,e); c2.lineTo(x, y+(y>e?3:-3)); };
    tick(x1,ext1); tick(x2,ext2);
    const small = x2-x1 < 14;
    c2.moveTo(small?x1-10:x1,y); c2.lineTo(small?x2+10:x2,y);
    c2.stroke();
    if(small){ arrow(x1,y,1); arrow(x2,y,0); } else { arrow(x1,y,0); arrow(x2,y,1); }
    c2.fillStyle=pal.txt; c2.textAlign="center"; c2.textBaseline="bottom";
    c2.fillText(label,(x1+x2)/2,y-3);
  };
  const dimV=(y1,y2,x,label,ext1,ext2)=>{
    c2.strokeStyle=pal.dim;
    c2.beginPath();
    const tick=(yy,e)=>{ if(e==null) return; c2.moveTo(e,yy); c2.lineTo(x+(x>e?3:-3), yy); };
    tick(y1,ext1); tick(y2,ext2);
    const small = y2-y1 < 14;
    c2.moveTo(x,small?y1-10:y1); c2.lineTo(x,small?y2+10:y2);
    c2.stroke();
    if(small){ arrow(x,y1,3); arrow(x,y2,2); } else { arrow(x,y1,2); arrow(x,y2,3); }
    c2.save(); c2.translate(x-4,(y1+y2)/2); c2.rotate(-Math.PI/2);
    c2.fillStyle=pal.txt; c2.textAlign="center"; c2.textBaseline="bottom";
    c2.fillText(label,0,0); c2.restore();
  };
  // two-line callout centred inside an opening; skipped when the opening is too small to hold it
  const note=(cx,cy,head,val,maxW,maxH)=>{
    c2.font="10px 'JetBrains Mono',monospace";
    const tw=Math.max(c2.measureText(head).width, c2.measureText(val).width);
    if(tw+8>maxW || maxH<26) return;
    c2.textAlign="center"; c2.textBaseline="middle";
    c2.fillStyle=pal.lab; c2.fillText(head,cx,cy-6);
    c2.fillStyle=pal.txt; c2.fillText(val,cx,cy+6);
  };
  // dimensions sharing one row, drawn in priority order; one whose label would run into a label
  // already on the row is left off rather than printed on top of it
  const dimRow=(y,items,ext)=>{
    c2.font="10px 'JetBrains Mono',monospace";
    const placed=[];
    items.forEach(it=>{
      const w=c2.measureText(it.label).width, cx=(it.x1+it.x2)/2, a=cx-w/2-4, b=cx+w/2+4;
      if(placed.some(([u,v])=>a<v && b>u)) return;
      placed.push([a,b]);
      dimH(it.x1,it.x2,y,it.label,ext,ext);
    });
  };
  // board-gap dimensions for a deck: one "GAP TYP" when the gaps are equal, else each different gap
  // once; then the end board's width, and the inner board's width when it differs
  const deckDims=(iv,x0,sc)=>{
    const n=iv.length, items=[], X=v=>x0+v*sc;
    if(n<2) return items;
    const gaps=[]; for(let i=1;i<n;i++) gaps.push([iv[i-1][1], iv[i][0]]);
    const even=gaps.every(([a,b])=>Math.abs((b-a)-(gaps[0][1]-gaps[0][0]))<1/32);
    if(even){ const [a,b]=gaps[n-2]; if(b-a>0.01) items.push({x1:X(a),x2:X(b),label:inch(b-a)+" GAP TYP"}); }
    else { const seen=new Set(); gaps.forEach(([a,b])=>{ const k=inch(b-a); if(b-a>0.01 && !seen.has(k)){ seen.add(k); items.push({x1:X(a),x2:X(b),label:k+" GAP"}); } }); }
    items.push({x1:X(iv[0][0]), x2:X(iv[0][1]), label:inch(iv[0][1]-iv[0][0])});
    if(n>2 && Math.abs((iv[1][1]-iv[1][0])-(iv[0][1]-iv[0][0]))>1e-6)
      items.push({x1:X(iv[1][0]), x2:X(iv[1][1]), label:inch(iv[1][1]-iv[1][0])});
    return items;
  };
  const viewLabel=(x,y,t)=>{ c2.fillStyle=pal.lab; c2.textAlign="left"; c2.textBaseline="top";
    c2.font="700 10px 'Segoe UI',sans-serif"; c2.fillText(t,x,y);
    c2.font="10px 'JetBrains Mono',monospace"; };

  /* ---- layout ---- */
  const pad=46;
  const topH=h*0.55;
  // TOP VIEW
  {
    const rw=w-2*pad, rh=topH-2*pad-inset;
    const sc=Math.min(rw/L, rh/W);
    const x0=(w-L*sc)/2, y0=pad+inset+ (rh-W*sc)/2 +6;
    viewLabel(x0,y0-34,"TOP VIEW");
    // hidden members below deck (draw first)
    if(bk==="stringer"){
      spread(p.sC,W,p.sB).forEach(z=>{
        dashLine(x0, y0+(z-p.sB/2)*sc, x0+L*sc, y0+(z-p.sB/2)*sc);
        dashLine(x0, y0+(z+p.sB/2)*sc, x0+L*sc, y0+(z+p.sB/2)*sc);
      });
    }else{
      const xs=spread(p.nBL,L,p.k), zs=spread(p.nBW,W,p.k);
      xs.forEach(bx=>zs.forEach(bz=> dashRect(x0+(bx-p.k/2)*sc, y0+(bz-p.k/2)*sc, p.k*sc, p.k*sc)));
      if(p.sbC>0) spread(p.sbC,W,p.sbW).forEach(z=>{
        dashLine(x0, y0+(z-p.sbW/2)*sc, x0+L*sc, y0+(z-p.sbW/2)*sc);
        dashLine(x0, y0+(z+p.sbW/2)*sc, x0+L*sc, y0+(z+p.sbW/2)*sc);
      });
    }
    // floor / top deck
    const tIv=p.topIv;
    if(p.type==="box" && p.hasP){
      R(x0, y0, L*sc, W*sc, pal.fill);            // continuous ply floor (hides boards below)
    }else{
      tIv.forEach(([a,b])=> R(x0+a*sc, y0, (b-a)*sc, W*sc, pal.fill));
    }
    // box walls overlay
    if(p.type==="box"){
      const t=p.sT*sc;
      R(x0, y0, L*sc, t, pal.fill2);
      R(x0, y0+W*sc-t, L*sc, t, pal.fill2);
      R(x0, y0+t, t, W*sc-2*t, pal.fill2);
      R(x0+L*sc-t, y0+t, t, W*sc-2*t, pal.fill2);
      const cwp=p.cw*sc, ctp=p.ct*sc, out=p.edgeCl==="out";
      // corner cleats: one on the side panel + one on the end panel at each corner
      const X1=x0, X2=x0+L*sc, Y1=y0, Y2=y0+W*sc;
      (out ? [
        [X1,Y1-ctp,cwp,ctp],[X1-ctp,Y1,ctp,cwp],
        [X2-cwp,Y1-ctp,cwp,ctp],[X2,Y1,ctp,cwp],
        [X1,Y2,cwp,ctp],[X1-ctp,Y2-cwp,ctp,cwp],
        [X2-cwp,Y2,cwp,ctp],[X2,Y2-cwp,ctp,cwp],
      ] : [
        [X1+t,Y1+t,cwp,ctp],[X1+t,Y1+t,ctp,cwp],
        [X2-t-cwp,Y1+t,cwp,ctp],[X2-t-ctp,Y1+t,ctp,cwp],
        [X1+t,Y2-t-ctp,cwp,ctp],[X1+t,Y2-t-cwp,ctp,cwp],
        [X2-t-cwp,Y2-t-ctp,cwp,ctp],[X2-t-ctp,Y2-t-cwp,ctp,cwp],
      ]).forEach(r=> R(r[0],r[1],r[2],r[3],pal.fill2));
      const intLab="INT "+inch(p.iL)+" × "+inch(p.iW)+" CLEAR", ix=x0+L*sc/2, iy=y0+W*sc/2;
      c2.textAlign="center"; c2.textBaseline="middle";
      c2.save(); c2.lineJoin="round"; c2.lineWidth=4; c2.strokeStyle=pal.halo||pal.bg;
      c2.strokeText(intLab, ix, iy); c2.restore();
      c2.fillStyle=pal.txt; c2.fillText(intLab, ix, iy);
    }
    // dims
    dimH(x0, x0+L*sc, y0-16, inch(L), y0, y0);
    dimV(y0, y0+W*sc, x0-16, inch(W), x0, x0);
    if(p.type==="box" && p.edgeCl==="out"){
      const e=p.ct*sc;
      dimH(x0-e, x0+L*sc+e, y0+W*sc+22, inch(p.oL)+" EXT", y0+W*sc+e, y0+W*sc+e);
      dimV(y0-e, y0+W*sc+e, x0-36, inch(p.oW)+" EXT", x0-e, x0-e);
    }
    if(p.type!=="box"){
      const yE=y0+W*sc, n=tIv.length;
      // row 1: gap between boards, end board width, inner board width (when different)
      dimRow(yE+16, deckDims(tIv,x0,sc), yE);
      // row 2: board spacing centre to centre — between two inner boards when the end boards are wider
      if(n>1){
        const mixed = n>2 && Math.abs((tIv[1][1]-tIv[1][0])-(tIv[0][1]-tIv[0][0]))>1e-6;
        const i = mixed && n>3 ? 1 : 0, c=j=>(tIv[j][0]+tIv[j][1])/2;
        if(!mixed || n>3) dimH(x0+c(i)*sc, x0+c(i+1)*sc, yE+34, inch(c(i+1)-c(i))+" C-C TYP", yE, yE);
      }
      // right side: spacing of the stringers / block rows under the deck
      const zs = bk==="stringer" ? spread(p.sC,W,p.sB) : spread(p.nBW,W,p.k);
      if(zs.length>1) dimV(y0+zs[0]*sc, y0+zs[1]*sc, x0+L*sc+18, inch(zs[1]-zs[0])+" C-C", x0+L*sc, x0+L*sc);
    }
  }

  const botY=topH+8, botH2=h-botY;
  const colW=w/2;

  /* ---- SIDE ELEVATION (length) ---- */
  {
    const notchDims = bk==="stringer" && p.notch && p.notchX.length>0;
    const rw=colW-1.6*pad, rh=botH2-2*pad-(p.type==="box" && notchDims ? 18 : 0);   // a box keeps a row free for the notch dimensions
    const sc=Math.min(rw/L, rh/Math.max(H,1)/1.0);
    const x0=pad+ (rw-L*sc)/2, yB=botY+pad+ (rh+H*sc)/2;  // yB = ground line
    const Y=v=> yB - v*sc;
    viewLabel(x0,Math.max(botY+6,Y(H)-44),"SIDE ELEVATION");    // just above the view, not floating over a flat pallet
    {
      // ---- base ----
      p.botIv.forEach(([a,b])=> R(x0+a*sc, Y(p.bT), (b-a)*sc, p.bT*sc, pal.fill));
      if(bk==="stringer"){
        // stringer profile with notches
        const y1=Y(p.y0), y2=Y(p.y0+p.sH);
        c2.fillStyle=pal.fill2; c2.strokeStyle=pal.line;
        c2.beginPath();
        if(p.notch){
          const nD=Math.min(p.notchD,p.sH)*sc, nL=p.notchL*sc;
          c2.moveTo(x0,y1);
          p.notchX.forEach(nx=>{ const a=x0+nx*sc;
            c2.lineTo(a,y1); c2.lineTo(a,y1-nD); c2.lineTo(a+nL,y1-nD); c2.lineTo(a+nL,y1); });
          c2.lineTo(x0+L*sc,y1); c2.lineTo(x0+L*sc,y2); c2.lineTo(x0,y2); c2.closePath();
        }else{
          c2.rect(x0,y2,L*sc,p.sH*sc);
        }
        c2.fill(); c2.stroke();
      }else{
        spread(p.nBL,L,p.k).forEach(x=> R(x0+(x-p.k/2)*sc, Y(p.y0+p.kH), p.k*sc, p.kH*sc, pal.fill2));
        if(p.sbC>0) R(x0, Y(p.y0+p.kH+p.sbT), L*sc, p.sbT*sc, pal.fill2);
      }
      // ---- floor / top deck ----
      if(p.type==="box"){
        let yF=p.baseTop;
        if(p.hasB){ p.topIv.forEach(([a,b])=> R(x0+a*sc, Y(yF+p.dT), (b-a)*sc, p.dT*sc, pal.fill)); yF+=p.dT; }
        if(p.hasP){ R(x0, Y(yF+p.fPT), L*sc, p.fPT*sc, pal.fill2); }
      }else{
        p.topIv.forEach(([a,b])=> R(x0+a*sc, Y(H), (b-a)*sc, p.dT*sc, pal.fill));
      }
      // ---- box walls: this view looks at a SIDE panel (its own lap) ----
      if(p.type==="box"){
        const yBot=p.baseH-p.lapS;         // side panel drops lapS below the deck top (0 on-deck)
        // plywood panel
        R(x0, Y(p.baseH+p.wH), L*sc, p.pHS*sc, pal.fill);
        // cleat frame
        if(p.orient==="v"){
          R(x0, Y(p.baseH+p.wH), L*sc, p.cw*sc, pal.fill2);
          R(x0, Y(yBot+p.cw), L*sc, p.cw*sc, pal.fill2);
          spread(p.nVL, L, p.cw).forEach(x=>
            R(x0+(x-p.cw/2)*sc, Y(p.baseH+p.wH-p.cw), p.cw*sc, (p.pHS-2*p.cw)*sc, pal.fill2));
        }else{
          R(x0, Y(p.baseH+p.wH), p.cw*sc, p.pHS*sc, pal.fill2);
          R(x0+(L-p.cw)*sc, Y(p.baseH+p.wH), p.cw*sc, p.pHS*sc, pal.fill2);
          spread(p.nHS, p.pHS, p.cw).forEach(y=>
            R(x0+p.cw*sc, Y(yBot+y+p.cw/2), (L-2*p.cw)*sc, p.cw*sc, pal.fill2));
        }
        if(p.edgeCl==="out"){
          // corner cleats of the END panels project past each end of the crate (end-panel height)
          R(x0-p.ct*sc, Y(p.baseH+p.wH), p.ct*sc, p.pHE*sc, pal.fill2);
          R(x0+L*sc,    Y(p.baseH+p.wH), p.ct*sc, p.pHE*sc, pal.fill2);
        }
        if(p.lid) R(x0, Y(H), L*sc, p.lidT*sc, pal.fill2);
        dimV(Y(p.baseH+p.wH), Y(p.baseH), x0-16, inch(p.wH), x0, x0);
        if(p.lapS>0) dimV(Y(p.baseH), Y(yBot), x0+L*sc+34, inch(p.lapS)+" LAP", x0+L*sc, x0+L*sc);
      }
    }
    // ---- pallet details: notch position and size, space between the notches, bottom-deck gaps ----
    let row=18;                                  // next free dimension row under the ground line
    if(notchDims){
      const n0=p.notchX[0], n1=n0+p.notchL, n2=p.notchX[1], yN=Y(p.y0);
      // chain: end → notch, the notch, then the space to the other notch; each label shortens
      // if it would run into the one before it, and the last is left off when even the number won't fit
      c2.font="10px 'JetBrains Mono',monospace";
      const tw=t=>c2.measureText(t).width;
      const hasEnd = n0>0.01;                      // notches pushed to the very ends: no 0″ dimension
      const lab1=inch(n0), edge1= hasEnd ? n0/2*sc + tw(lab1)/2 + 6 : 0, cN=(n0+p.notchL/2)*sc;
      const lab2=[inch(p.notchL)+" × "+inch(p.notchD)+" NOTCH", inch(p.notchL)+" NOTCH", inch(p.notchL)]
        .find(t=>cN - tw(t)/2 >= edge1) || inch(p.notchL);
      if(hasEnd) dimH(x0, x0+n0*sc, yB+row, lab1, yB, yN);
      dimH(x0+n0*sc, x0+n1*sc, yB+row, lab2, yN, yN);
      if(n2>n1+1e-6){
        const edge2=cN + tw(lab2)/2 + 14, cB=(n1+n2)/2*sc, gap=inch(n2-n1);   // wider gap: the two labels must not read as one
        const lab3=[gap+" BETWEEN NOTCHES", gap+" BETWEEN", gap].find(t=>cB - tw(t)/2 >= edge2);
        if(lab3) dimH(x0+n1*sc, x0+n2*sc, yB+row, lab3, yN, yN);
      }
      row+=18;
    }
    if(p.type!=="box"){
      if(p.botIv.length>=2){
        dimRow(yB+row, deckDims(p.botIv,x0,sc), yB);   // bottom-deck gaps and board widths
        row+=18;
      }
      const f=m.det.f48;
      if(bk==="block" && f && f.h>0.01){
        const xs=spread(p.nBL,L,p.k), a=xs[0]+p.k/2, b=xs[1]-p.k/2;
        note(x0+(a+b)/2*sc, Y(f.bottom+f.h/2), "FORK ENTRY", inch(f.width)+" × "+inch(f.h), (b-a)*sc, f.h*sc);
      }
    }
    dimH(x0, x0+L*sc, yB+row, inch(L), yB, yB);
    if(p.type==="box" && p.edgeCl==="out")
      dimH(x0-p.ct*sc, x0+(L+p.ct)*sc, yB+row+18, inch(p.oL)+" EXT", yB, yB);
    dimV(Y(H), yB, x0+L*sc+18, inch(H), x0+L*sc, x0+L*sc);
  }

  /* ---- END ELEVATION (width) ---- */
  {
    const rw=colW-1.6*pad, rh=botH2-2*pad;
    const sc=Math.min(rw/W, rh/Math.max(H,1));
    const x0=colW+0.6*pad+ (rw-W*sc)/2, yB=botY+pad+ (rh+H*sc)/2;
    const Y=v=> yB - v*sc;
    viewLabel(x0,Math.max(botY+6,Y(H)-44),"END ELEVATION");
    {
      // ---- base ----
      if(p.bC) R(x0, Y(p.bT), W*sc, p.bT*sc, pal.fill);
      let szs=[];
      if(bk==="stringer"){
        szs=spread(p.sC,W,p.sB);
        szs.forEach(z=> R(x0+(z-p.sB/2)*sc, Y(p.y0+p.sH), p.sB*sc, p.sH*sc, pal.fill2));
      }else{
        spread(p.nBW,W,p.k).forEach(z=> R(x0+(z-p.k/2)*sc, Y(p.y0+p.kH), p.k*sc, p.kH*sc, pal.fill2));
        if(p.sbC>0) spread(p.sbC,W,p.sbW).forEach(z=> R(x0+(z-p.sbW/2)*sc, Y(p.y0+p.kH+p.sbT), p.sbW*sc, p.sbT*sc, pal.fill2));
      }
      // ---- floor / top deck ----
      if(p.type==="box"){
        let yF=p.baseTop;
        if(p.hasB){ R(x0, Y(yF+p.dT), W*sc, p.dT*sc, pal.fill); yF+=p.dT; }
        if(p.hasP){ R(x0, Y(yF+p.fPT), W*sc, p.fPT*sc, pal.fill2); }
      }else{
        R(x0, Y(H), W*sc, p.dT*sc, pal.fill);
      }
      // ---- box walls: this view looks at an END panel (its own lap) ----
      if(p.type==="box"){
        const eW=W-2*p.pT;
        const yBot=p.baseH-p.lapE;
        R(x0+p.pT*sc, Y(p.baseH+p.wH), eW*sc, p.pHE*sc, pal.fill);
        if(p.orient==="v"){
          R(x0+p.pT*sc, Y(p.baseH+p.wH), eW*sc, p.cw*sc, pal.fill2);
          R(x0+p.pT*sc, Y(yBot+p.cw), eW*sc, p.cw*sc, pal.fill2);
          spread(p.nVW, eW, p.cw).forEach(z=>
            R(x0+(p.pT+z-p.cw/2)*sc, Y(p.baseH+p.wH-p.cw), p.cw*sc, (p.pHE-2*p.cw)*sc, pal.fill2));
        }else{
          R(x0+p.pT*sc, Y(p.baseH+p.wH), p.cw*sc, p.pHE*sc, pal.fill2);
          R(x0+(W-p.pT-p.cw)*sc, Y(p.baseH+p.wH), p.cw*sc, p.pHE*sc, pal.fill2);
          spread(p.nHE, p.pHE, p.cw).forEach(y=>
            R(x0+(p.pT+p.cw)*sc, Y(yBot+y+p.cw/2), (eW-2*p.cw)*sc, p.cw*sc, pal.fill2));
        }
        if(p.edgeCl==="out"){
          // corner cleats of the SIDE panels project past each face of the crate (side-panel height)
          R(x0-p.ct*sc, Y(p.baseH+p.wH), p.ct*sc, p.pHS*sc, pal.fill2);
          R(x0+W*sc,    Y(p.baseH+p.wH), p.ct*sc, p.pHS*sc, pal.fill2);
        }
        if(p.lid) R(x0, Y(H), W*sc, p.lidT*sc, pal.fill2);
        if(p.lapE>0) dimV(Y(p.baseH), Y(yBot), x0+W*sc+34, inch(p.lapE)+" LAP", x0+W*sc, x0+W*sc);
      }else{
        if(bk==="stringer")
          dimH(x0+(szs[0]-p.sB/2)*sc, x0+(szs[0]+p.sB/2)*sc, Y(H)-14, inch(p.sB), Y(p.y0+p.sH), Y(p.y0+p.sH));
        // fork entry callout in the first opening between stringers / block rows
        const f=m.det.f40;
        if(f && f.n>0 && f.h>0.01){
          const zs = bk==="stringer" ? spread(p.sC,W,p.sB) : spread(p.nBW,W,p.k);
          const hw = bk==="stringer" ? p.sB/2 : p.k/2, a=zs[0]+hw, b=zs[1]-hw;
          note(x0+(a+b)/2*sc, Y(f.bottom+f.h/2), "FORK ENTRY", inch(f.width)+" × "+inch(f.h), (b-a)*sc, f.h*sc);
        }
      }
    }
    dimH(x0, x0+W*sc, yB+18, inch(W), yB, yB);
    if(p.type==="box" && p.edgeCl==="out")
      dimH(x0-p.ct*sc, x0+(W+p.ct)*sc, yB+36, inch(p.oW)+" EXT", yB, yB);
    dimV(Y(H), yB, x0+W*sc+18, inch(H), x0+W*sc, x0+W*sc);
  }
}

// The canvas memory is set up again only when the drawing area changes size (setting its width or
// height always reallocates and clears it). Each drawing still starts from the same clean state: it is
// wrapped in save/restore, and drawSpec2D clears the whole area first.
let cvSize="";
function drawScreen(m){
  const w=cv.clientWidth, h=cv.clientHeight, size=w+"x"+h+"@"+devicePixelRatio;
  if(size!==cvSize){ cvSize=size; cv.width=w*devicePixelRatio; cv.height=h*devicePixelRatio; }
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.save();
  try{ drawSpec2D(ctx,w,h,m,PAL_SCREEN,18); }finally{ ctx.restore(); }
}

function printDrawingPNG(m){
  // laid out at 1100×600 and rendered at 2×: dimension text comes out ~40% larger on paper
  // than a 1500-wide layout, and the drawing takes less of the page (a pallet spec fits one Letter page)
  const W=1100, H=600, k=2;
  const oc=document.createElement("canvas");
  oc.width=W*k; oc.height=H*k;
  const c=oc.getContext("2d",{willReadFrequently:true}); c.scale(k,k);   // CPU canvas: the trim below reads pixels back
  drawSpec2D(c,W,H,m,PAL_PAPER);
  // trim the blank bands above and below the views (full width kept, so the drawing prints at the
  // same scale); read in strips so only the blank band and its edge are scanned
  try{
    const cw=oc.width, ch=oc.height, step=32, keep=14*k;
    const ink=(y,n)=>{ const d=c.getImageData(0,y,cw,n).data;
      for(let r=0;r<n;r++){ for(let i=r*cw*4, e=i+cw*4; i<e; i+=4) if(d[i]<245||d[i+1]<245||d[i+2]<245) return r; }
      return -1; };
    let top=0, bot=ch;
    for(let y=0; y<ch; y+=step){ const n=Math.min(step,ch-y), r=ink(y,n); if(r>=0){ top=y+r; break; } }
    for(let y=ch; y>top; y-=step){ const n=Math.min(step,y-top), y0=y-n;
      const d=c.getImageData(0,y0,cw,n).data; let hit=-1;
      for(let r=n-1;r>=0 && hit<0;r--){ for(let i=r*cw*4, e=i+cw*4; i<e; i+=4) if(d[i]<245||d[i+1]<245||d[i+2]<245){ hit=r; break; } }
      if(hit>=0){ bot=y0+hit+1; break; } }
    top=Math.max(0,top-keep); bot=Math.min(ch,bot+keep);
    if(bot-top>0 && bot-top<ch){
      const t=document.createElement("canvas"); t.width=cw; t.height=bot-top;
      t.getContext("2d").drawImage(oc,0,-top);
      return t.toDataURL("image/png");
    }
  }catch(e){ /* no pixel access: print the full frame */ }
  return oc.toDataURL("image/png");
}

