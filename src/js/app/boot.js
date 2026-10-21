window.addEventListener("resize",()=>drawScreen(buildModel()));
// redraw whenever the drawing area changes size (window resize, or the footer gaining a warning line)
if(window.ResizeObserver){
  let lastWH="";
  new ResizeObserver(()=>{ const k=cv.clientWidth+"x"+cv.clientHeight; if(k!==lastWH){ lastWH=k; drawScreen(buildModel()); } })
    .observe($("cvWrap"));
}
window.addEventListener("keydown",e=>{
  if(e.key==="p"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); printSpec(); }
});

update();
