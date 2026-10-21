// The design list, headless (jsdom has no IndexedDB, so this runs the older localStorage list the tool
// falls back to): save, update, load, delete, design files loaded into the list, import, search, and the
// list controls kept out of saved designs. The database itself is checked in the browser: browser/flows.py.
// Usage: node library.js [path/to/pallet-lab.html]
const fs=require('fs'), path=require('path');
const {load}=require('./harness');
const FILE=process.argv.slice(2).find(a=>/\.html?$/i.test(a))||path.join(__dirname,'..','pallet-lab.html');
const OLD=path.join(__dirname,'fixtures','old-saves');
const T=load(FILE), w=T.w, $=T.$;
const fails=[]; const check=(ok,msg)=>{ if(!ok) fails.push(msg); };
const idle=()=>w.eval('libIdle()');
const toast=()=>$('toast').textContent;
const opts=()=>[...$('libSel').options].map(o=>({v:o.value,t:o.text}));
const stored=()=>JSON.parse(w.localStorage.getItem('palletlab.designs')||'[]');
const pick=async v=>{ $('libSel').value=v; $('libSel').dispatchEvent(new w.Event('change')); await idle(); };
const save=async name=>{ w.__prompt=name; T.click('btnLibSave'); await idle(); };

setTimeout(async()=>{
  try{
    await idle();
    check(w.eval('designDB.kind')==='local', 'no IndexedDB here: the older in-browser list is used');
    // save, update (keeps its place), load, delete
    T.set('partNo','LIB-A'); T.set('L','44'); await save('Design A');
    check(toast()==='Saved Design A' && stored().length===1, `save: ${toast()}`);
    T.click('tBox'); await save('Design B');
    T.click('tStr'); T.set('L','50'); await save('Design A');
    check(toast()==='Updated Design A', `update: ${toast()}`);
    check(stored().map(d=>d.name).join()==='Design A,Design B' && stored()[0].state.f.L==='50', 'an updated design keeps its place');
    T.set('L','36'); await pick(opts()[1].v);
    check($('L').value==='50' && w.eval('palletType')==='stringer', `load A: L=${$('L').value}`);
    await pick(opts()[2].v);
    check(w.eval('palletType')==='box' && toast()==='Loaded Design B', `load B: ${toast()}`);
    T.click('btnLibDel'); await idle();
    check(toast()==='Deleted Design B' && stored().length===1 && $('libSel').value==='', `delete: ${toast()}`);
    T.click('btnLibDel'); check(toast()==='Pick a saved design first', `delete with nothing picked: ${toast()}`);
    await save('<b>x</b> & "q"');
    check(!$('libSel').querySelector('b') && opts()[2].t.startsWith('<b>x</b> & "q"'), 'odd names are shown as typed, never as HTML');
    // the DESIGNS section is not part of a design
    $('libFind').value='abc';
    const st=w.eval('collectState()');
    check(!('libFind' in st.f) && !('libSel' in st.f), 'search box and list are not saved in a design');
    $('libFind').value='';
    // a design file loaded goes into the list under its file name (fileIn can't be set here: same steps)
    const one={fmt:'pallet-lab/1',type:'block',saved:'2026-09-01T10:00:00.000Z',f:{L:'42',client:'Peñoles',partNo:'BLK-9'}};
    w.eval(`applyState(${JSON.stringify(one)},"x"); libAdd(fileDesignName("loaded-one.pltlab.json"),${JSON.stringify(one)},"file","Loaded loaded-one.pltlab.json")`);
    await idle();
    const s1=stored();
    check(s1.length===3 && s1[2].name==='loaded-one' && JSON.stringify(s1[2].state)===JSON.stringify(one), 'a loaded file is listed as it was saved');
    check($('libSel').selectedOptions[0].text.startsWith('loaded-one'), 'the loaded file is picked in the list');
    // import: old saved designs from every version, plus two files that aren't designs
    const fx=fs.readdirSync(OLD).filter(n=>n.endsWith('.pltlab.json')).sort();
    const files=fx.map(n=>[n,fs.readFileSync(path.join(OLD,n),'utf8')]).concat([['notes.json','{"a":1}'],['bad.pltlab.json','x']]);
    const before=JSON.stringify(w.eval('collectState()').f);
    w.__files=files; w.eval('libImport(__files.map(([n,t])=>new File([t],n)))'); await idle();
    check(toast()===`Imported ${fx.length} designs · 2 files skipped: not design files`, `import: ${toast()}`);
    check(stored().length===3+fx.length && stored().slice(3).map(d=>d.name).join()===fx.map(n=>n.replace('.pltlab.json','')).join(), 'imported in file order');
    check(JSON.stringify(w.eval('collectState()').f)===before, 'importing leaves the design on screen as it was');
    w.eval('libImport(__files.slice(0,2).map(([n,t])=>new File([t],n)))'); await idle();
    check(stored().length===3+fx.length && /^Imported 2 designs \(2 replaced/.test(toast()), `import again replaces: ${toast()}`);
    // search: every word, any field, no accents or capitals
    const find=async q=>{ T.set('libFind',q); return opts().slice(1).map(o=>o.t.split(' · ')[0]); };
    check((await find('PENOLES blk')).join()==='loaded-one', 'search by client (accents and capitals ignored) and part #');
    check((await find('oct 16 box')).join()==='4-oct-16-notch-from-ends_box,5-oct-16-space-between-notches_box,6-oct-16-version-stamp_box', 'several words must all match');
    check(opts()[0].t===`— 3 of ${3+fx.length} match —`, `match count shown: ${opts()[0].t}`);
    check((await find('zzz')).length===0 && opts()[0].t==='— no match —', 'no match');
    await find(''); check(opts().length===4+fx.length, 'an empty search shows them all');
    await find('first-version_box'); await pick(opts()[1].v);
    check(w.eval('palletType')==='box' && toast()==='Loaded 1-first-version_box', `an imported old design opens: ${toast()}`);
    // storage full: the list says so and stays on; delete still works
    const real=w.Storage.prototype.setItem;
    w.Storage.prototype.setItem=function(k,v){ if(k==='palletlab.designs' && v.length>(this.getItem(k)||'').length) throw new w.DOMException('full','QuotaExceededError'); return real.call(this,k,v); };
    await find(''); await save('Too many');
    check(/full/.test(toast()) && !$('libSel').disabled, `full storage: ${toast()}`);
    await pick(opts()[1].v); T.click('btnLibDel'); await idle();
    check(toast()==='Deleted Design A', `delete when full: ${toast()}`);
    w.Storage.prototype.setItem=real;
    check(!/NaN|undefined|Infinity/.test(['det','bom','cards','cutList','warn','vpDims'].map(i=>$(i).textContent).join(' ')), 'results stay clean');
  }catch(e){ fails.push('EXCEPTION '+e.message+'\n'+(e.stack||'').split('\n').slice(0,3).join('\n')); }
  console.log(`design list checks run · page errors: ${T.errors.length?T.errors.slice(0,3):'none'}`);
  console.log(`failed checks: ${fails.length}`); fails.forEach(f=>console.log(' - '+f));
  process.exitCode = (fails.length || T.errors.length) ? 1 : 0;
},500);
