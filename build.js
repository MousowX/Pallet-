// Builds pallet-lab.html, the one self-contained file Isaac opens, from the sources in src/.
// The CSS files go into its <style>, the JavaScript files into its one <script>, in the order listed
// below: they run top to bottom as a single script, sharing one global scope, as the file always did
// (the tests call its functions by name). No libraries, no downloads: the result works offline.
//
// Usage: node build.js           write pallet-lab.html
//        node build.js --check   only check that pallet-lab.html is what src/ builds (npm test runs it)
//        node build.js --site    the website (Vercel, Render): the checked pallet-lab.html alone, as
//                                dist/index.html — nothing else from the project is published
"use strict";
const fs=require("fs"), path=require("path");
const SRC=path.join(__dirname,"src"), OUT=path.join(__dirname,"pallet-lab.html");

const CSS=[
  "screen.css",                // the page
  "print.css",                 // the printed spec sheet and cut list
];
const JS=[
  "core/species.js",           // the two species and their design values
  "core/state.js",             // V() reads the inputs, inch() formats sizes, species dropdown
  "model/geometry.js",         // notches, deck boards, bottom deck layouts
  "model/cutting.js",          // plywood sheet layouts, lumber cut list
  "model/build-model.js",      // buildModel(): the design, its bill of materials and cut list
  "model/analysis.js",         // analyze(): beam-theory capacities
  "model/details.js",          // palletDetails(): gaps, spacing, fork openings, warnings
  "render/results.js",         // capacity cards, details panel, bill of materials
  "render/cut-list.js",        // cut list panel and printed cut list
  "render/drawing.js",         // drawSpec2D(): top, side and end views, screen and paper
  "render/spec-sheet.js",      // the printed spec sheet
  "app/update.js",             // update(): runs on every change
  "app/events.js",             // buttons, presets, printing
  "designs/format.js",         // design files: collectState, applyState, RETIRED, MIGRATE
  "designs/db.js",             // the design database (IndexedDB; the older localStorage list where it is missing)
  "designs/files.js",          // save, load and import design files
  "designs/library.js",        // the design list: search, save, load, delete
  "app/boot.js",               // resize, Ctrl+P, first draw
];

const read=f=>fs.readFileSync(path.join(SRC,f),"utf8").replace(/\r\n?/g,"\n");
function build(){
  let html=read("index.html");
  // slices, not String.replace: the code is full of "$" that a replacement string would expand
  const put=(mark,files,closing)=>{
    const at=html.indexOf(mark);
    if(at<0 || html.indexOf(mark,at+1)>=0) throw new Error(`src/index.html must have ${mark} exactly once`);
    const body=files.map(f=>{
      const s=read(f);
      if(!s.endsWith("\n")) throw new Error(`src/${f} must end with a line break`);
      if(s.toLowerCase().includes(closing)) throw new Error(`src/${f} contains "${closing}", which would end the inline block early`);
      return s;
    }).join("");
    html=html.slice(0,at)+body+html.slice(at+mark.length+1);     // +1: the placeholder's own line break
  };
  put("/*@build:css*/",CSS.map(f=>"css/"+f),"</style");
  put("/*@build:js*/",JS.map(f=>"js/"+f),"</script");
  return html;
}

const html=build();
if(process.argv.includes("--check") || process.argv.includes("--site")){
  const now=fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").replace(/\r\n?/g,"\n") : "";
  if(now!==html){
    console.log("pallet-lab.html is not up to date with src/ — run: node build.js");
    console.log("failed checks: 1");
    process.exit(1);
  }
  console.log("pallet-lab.html matches src/");
  if(process.argv.includes("--site")){
    // the site publishes the committed, tested file as it is
    const dir=path.join(__dirname,"dist");
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,"index.html"),now);
    console.log("site: dist/index.html");
  }else console.log("failed checks: 0");
}else{
  fs.writeFileSync(OUT,html);
  console.log(`built pallet-lab.html · ${(Buffer.byteLength(html)/1024).toFixed(1)} KB · ${CSS.length} CSS + ${JS.length} JS files from src/`);
}
