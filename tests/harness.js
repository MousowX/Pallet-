// Headless loader for pallet-lab.html (jsdom): stubs the canvas, collects runtime errors, gives helpers.
// Used by every node check in this folder.
const fs=require('fs');
const {JSDOM}=require('jsdom');

function load(file){
  const errors=[];
  const dom=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.test/",
    beforeParse(w){
      const noop=()=>{};
      w.HTMLCanvasElement.prototype.getContext=function(){
        return new Proxy({},{get:(t,k)=> k==='measureText' ? (s=>({width:String(s).length*6.1})) : (k in t ? t[k] : noop),
                             set:(t,k,v)=>{ t[k]=v; return true; }});
      };
      w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,';
      w.devicePixelRatio=1;
      w.URL.createObjectURL=()=> 'blob:x'; w.URL.revokeObjectURL=noop;
      w.prompt=(q,d)=> w.__prompt!==undefined ? w.__prompt : d;
      w.confirm=()=>true;
      w.addEventListener('error',e=>errors.push(e.message));
    }});
  const w=dom.window, d=w.document;
  const $=id=>d.getElementById(id);
  const set=(id,v)=>{ const el=$(id); el.value=v; el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); };
  const click=id=>$(id).click();
  // details table → {GROUP: {label: "value [note]"}}
  const details=()=>{
    const out={}; let g='';
    d.querySelectorAll('#det tr').forEach(tr=>{
      if(tr.classList.contains('gh')){ g=tr.textContent.trim(); out[g]={}; return; }
      const td=tr.querySelectorAll('td'); const sm=td[1].querySelector('small');
      const v=[...td[1].childNodes].filter(n=>n.nodeName!=='SMALL').map(n=>n.textContent).join('').trim();
      out[g][td[0].textContent.trim()] = v + (sm?`  [${sm.textContent}]`:'') + (td[1].classList.contains('bad')?'  ✗':'');
    });
    return out;
  };
  const cards=()=>[...d.querySelectorAll('#cards .card')].map(c=>({
    t:c.querySelector('h3').textContent, cap:c.querySelector('.cap').textContent.replace(/\s+/g,' ').trim(),
    sub:c.querySelector('.sub').textContent.replace(/\s+/g,' ').trim(), gov:c.classList.contains('govern')}));
  const bom=()=>[...d.querySelectorAll('#bom tr')].map(r=>r.textContent.replace(/\s+/g,' ').trim());
  const warn=()=>$('warn').innerHTML.split('<br>').map(s=>s.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
  const dims=()=>$('vpDims').textContent.replace(/\s+/g,' ').trim();
  return {w,d,$,set,click,details,cards,bom,warn,dims,errors};
}
module.exports={load};
