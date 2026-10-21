// Designs saved by earlier versions (fixtures/old-saves) must still open: every value the file has comes
// back unchanged, the pallet type is kept, renamed fields are converted, and fields added since then get
// the values recorded in expected.json (the ones that reproduce how the old version showed the design).
// Usage: node oldfiles.js [path/to/pallet-lab.html]
// To record a file from a version that changes the saved format: save one design per type with that
// version into fixtures/old-saves, then add its expected values to expected.json (see the README there).
const fs=require('fs'), path=require('path');
const {load}=require('./harness');
const FILE=process.argv.slice(2).find(a=>/\.html?$/i.test(a))||path.join(__dirname,'..','pallet-lab.html');
const DIR=path.join(__dirname,'fixtures','old-saves');
const expected=JSON.parse(fs.readFileSync(path.join(DIR,'expected.json'),'utf8'));
const T=load(FILE);

setTimeout(()=>{
  const fails=[], names=Object.keys(expected); let opened=0;
  for(const name of names){
    const e=expected[name];
    let saved;
    try{ saved=JSON.parse(fs.readFileSync(path.join(DIR,name+'.pltlab.json'),'utf8')); }
    catch(err){ fails.push(`${name}: fixture missing or unreadable (${err.message})`); continue; }
    try{ T.w.eval('applyState('+JSON.stringify(saved)+',"x")'); }
    catch(err){ fails.push(`${name}: the tool refused the file — ${err.message}`); continue; }
    opened++;
    const st=T.w.eval('collectState()'), toast=T.d.getElementById('toast').textContent, bad=[];
    const type=T.w.eval('palletType');
    if(type!==e.type) bad.push(`type ${e.type} → ${type}`);
    for(const k in saved.f) if(k in st.f && st.f[k]!==saved.f[k]) bad.push(`${k}: ${saved.f[k]} → ${st.f[k]}`);
    for(const k in e.converted) if(st.f[k]!==e.converted[k]) bad.push(`${k} should open as ${e.converted[k]}, got ${st.f[k]}`);
    if(/unknown|unreadable/.test(toast)) bad.push('message: '+toast);
    const text=['det','bom','cards','cutList','warn','vpDims'].map(i=>T.d.getElementById(i).textContent).join(' ');
    ['NaN','undefined','Infinity'].forEach(x=>{ if(text.includes(x)) bad.push('shows '+x); });
    if(bad.length) fails.push(`${name}: ${bad.join(' | ')}`);
  }
  console.log(`old saved designs opened: ${opened} of ${names.length}`);
  console.log(`page errors: ${T.errors.length?T.errors.slice(0,3):'none'}`);
  console.log(`failed checks: ${fails.length}`); fails.forEach(f=>console.log(' - '+f));
  process.exitCode = (fails.length || T.errors.length || opened<names.length) ? 1 : 0;
},500);
