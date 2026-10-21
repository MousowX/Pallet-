/* ================= GEOMETRY MODEL ================= */
function spread(count, span, itemW){
  // center positions across span, ends flush
  if(count===1) return [span/2];
  const pos=[];
  for(let i=0;i<count;i++) pos.push(itemW/2 + i*(span-itemW)/(count-1));
  return pos;
}
// notch geometry lives in the model so the drawing, the details and the capacity check agree:
// two notches per stringer, the same distance in from each end
// the two notches are centred on the stringer, the chosen space apart — the distance to each end
// follows. If notches + space are longer than the stringer, the notches sit at the ends (warned).
function notchGeom(L,sH,on){
  if(!on) return {notchL:0, notchD:0, notchX:[]};
  const nL=Math.max(0,V("nLen")), nD=Math.max(0,V("nDep")), gap=Math.max(0,V("nGap"));
  const e=(L-2*nL-gap)/2, fit=e>=-1e-9, eU=Math.max(0,e);
  return {notchL:nL, notchD:nD, notchGap:gap, notchFit:fit, notchX:[eU, L-eU-nL]};
}
// Deck boards as [start,end] intervals along the length. The two end ("lead") boards sit flush
// at the ends; the others are spread between them with equal gaps.
function deckBoards(n, lead, inner, span){
  if(n<=0) return [];
  if(n===1) return [[span/2-lead/2, span/2+lead/2]];
  const k=n-2, gap=(span-2*lead-k*inner)/(n-1), out=[[0,lead]];
  let x=lead+gap;
  for(let i=0;i<k;i++){ out.push([x,x+inner]); x+=inner+gap; }
  out.push([span-lead,span]);
  return out;
}
// Bottom deck.
// Block base: one board under each block column (end boards flush, inner boards centred on the column).
// Notched stringer base set to "clear the notches": end boards at the ends, inner boards grouped in the
// space between the two notches, so the forks find bare floor under each notch (GMA layout).
// Anything else: the same rule as the top deck.
function bottomBoards(n, lead, inner, L, b, how){
  if(n<=0) return {iv:[], mode:"none"};
  if(b.kind==="block"){
    const xs=spread(b.nBL, L, b.k), last=xs.length-1;
    const iv=xs.map((x,i)=> i===0 ? [0,lead] : i===last ? [L-lead,L] : [x-inner/2, x+inner/2]);
    // centred under the columns when that fits; boards too wide for it keep equal gaps instead
    const fits=iv.every((q,i)=> i===0 || q[0]>=iv[i-1][1]-1e-9);
    return fits ? {iv, mode:"columns"} : {iv:deckBoards(n,lead,inner,L), mode:"columns-even"};
  }
  if(how==="notch" && b.notch && n>=2){
    const z0=b.notchX[0]+b.notchL, z1=b.notchX[1], room=z1-z0, k=n-2;
    if(room>0 && k*inner<=room+1e-6){
      const iv=[[0,lead]];
      if(k===1) iv.push([(z0+z1-inner)/2, (z0+z1+inner)/2]);
      if(k>1){ const g=(room-k*inner)/(k-1); for(let i=0;i<k;i++){ const x=z0+i*(inner+g); iv.push([x,x+inner]); } }
      iv.push([L-lead,L]);
      return {iv, mode:"notch"};
    }
    return {iv:deckBoards(n,lead,inner,L), mode:"even", noFit:{k, need:k*inner, room:Math.max(0,room)}};
  }
  return {iv:deckBoards(n,lead,inner,L), mode:"even"};
}
