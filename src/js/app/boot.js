// a resize only changes the drawing area, not the design: redraw the design as last worked out
window.addEventListener("resize",()=>drawScreen(lastModel||buildModel()));
// redraw whenever the drawing area changes size (window resize, or the footer gaining a warning line)
if(window.ResizeObserver){
  let lastWH="";
  new ResizeObserver(()=>{ const k=cv.clientWidth+"x"+cv.clientHeight; if(k!==lastWH){ lastWH=k; drawScreen(lastModel||buildModel()); } })
    .observe($("cvWrap"));
}
window.addEventListener("keydown",e=>{
  if(e.key==="p"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); printSpec(); }
});

update();
