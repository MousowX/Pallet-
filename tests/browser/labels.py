# Labels in the drawings must not print on top of each other or run off the edge — screen (1440x900)
# and paper (spec sheet), over random realistic designs. Canvas text is measured in the real browser.
# Usage: python3 labels.py [path/to/pallet-lab.html] [N]     (needs Playwright, like flows.py)
import pathlib
import asyncio, json, os, random, sys
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
args=sys.argv[1:]
FILE=os.path.abspath(next((a for a in args if a.lower().endswith((".html",".htm"))), os.path.join(HERE,"..","..","pallet-lab.html")))
N=int(next((a for a in args if a.isdigit()), 250))
random.seed(11)
def design():
    t=random.choice(['stringer','stringer','block','box','box'])
    f=dict(L=random.choice([36,40,42,44,46,48,48,48,52,54,60,72,96,120]), W=random.choice([30,36,40,40,42,44,48,60]),
      dCount=random.randint(3,12), dWidth=random.choice([3.5,3.5,5.5]), dLead=random.choice(['',5.5]), dThk=random.choice([0.5625,0.625,0.75]),
      bCount=random.choice([0,3,5,5,7]), bWidth=random.choice([3.5,5.5]), bLead=random.choice(['',5.5]), bThk=0.75, bLay=random.choice(['notch','even']),
      sCount=random.choice([2,3,3,4,5]), sThk=random.choice([1.25,1.5]), sHgt=3.5, sNotch=random.choice(['1','1','0']),
      nLen=random.choice([6,9,12]), nDep=1.5, nGap=random.choice([6,10,13,18,22,30]),
      kNL=random.choice([3,3,4]), kNW=random.choice([3,3,4]), kSize=random.choice([3.5,5.5]), kHgt=3.5, kSBon=random.choice(['1','0']), kSBt=0.75, kSBw=3.5,
      boxBase=random.choice(['stringer','block']), floorType=random.choice(['boards','ply','plyboards']), wH=random.choice([12,24,30,48,60]),
      plyT=random.choice(['0.375','0.5']), cleatT=0.75, cleatW=3.5, clSp=24, edgeCl=random.choice(['in','out']), clOrient=random.choice(['v','h']),
      attach=random.choice(['skirt','surface']), sideOv=random.choice([0,0.75,2.5,4]), endOv=random.choice([0,0.75,2.5]), boxLid=random.choice(['1','0']), species='0')
    return {"fmt":"pallet-lab/1","type":t,"f":{k:str(v) for k,v in f.items()}}
JS_PATCH = """(()=>{ window.__T=[]; const P=CanvasRenderingContext2D.prototype, orig=P.fillText;
  P.fillText=function(txt,x,y){ try{
    const m=this.measureText(String(txt)), w=m.width, fs=parseFloat((this.font.match(/(\\d+(?:\\.\\d+)?)px/)||[0,10])[1]);
    const a=this.textAlign, b=this.textBaseline;
    const x0 = a==='center'? x-w/2 : (a==='right'||a==='end')? x-w : x;
    const y0 = b==='top'? y : (b==='middle'||b==='central')? y-fs/2 : b==='bottom'? y-fs : y-fs*0.8;
    const T=this.getTransform(), pts=[[x0,y0],[x0+w,y0],[x0,y0+fs],[x0+w,y0+fs]].map(([u,v])=>[T.a*u+T.c*v+T.e, T.b*u+T.d*v+T.f]);
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const cv=this.canvas; if(!cv.__id) cv.__id=(window.__cid=(window.__cid||0)+1);
    window.__T.push({t:String(txt), x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys), cw:cv.width, ch:cv.height, cid:cv.__id, screen:cv.id==='cv'});
  }catch(e){} return orig.apply(this,arguments); };
})()"""
JS_CHECK = """(which)=>{
  const all=window.__T; window.__T=[]; const out=[];
  // only the canvas being checked, and only its last complete drawing
  const mine=all.filter(b=> which==='screen' ? b.screen : !b.screen);
  const last=mine.length? mine[mine.length-1].cid : null;
  const B=mine.filter(b=>b.cid===last);
  for(let i=0;i<B.length;i++){ const a=B[i];
    if(a.x0<-1||a.y0<-1||a.x1>a.cw+1||a.y1>a.ch+1) out.push({kind:'clipped', a:a.t});
    for(let j=i+1;j<B.length;j++){ const b=B[j];
      const ix=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0), iy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
      if(a.t===b.t && Math.abs(a.x0-b.x0)<0.5 && Math.abs(a.y0-b.y0)<0.5) continue;
      if(ix>0 && iy>0){ const ar=ix*iy, sm=Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0));
        if(ar>0.12*sm) out.push({kind:'overlap', a:a.t, b:b.t}); } } }
  return out; }"""
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch()
        pg=await br.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(pathlib.Path(FILE).as_uri()); await pg.wait_for_timeout(300)
        await pg.evaluate(JS_PATCH)
        stats={'screen':{'designs':0,'bad':0},'paper':{'designs':0,'bad':0}}; pairs={}; examples=[]
        for i in range(N):
            st=design()
            await pg.evaluate("s=>applyState(s,'')", st)
            await pg.evaluate("window.__T=[]; drawScreen(buildModel())")
            r1=await pg.evaluate(JS_CHECK,'screen')
            if any(o['kind']=='clipped' for o in r1):
                # the drawing area can still be resizing right after a design loads: look again once it settles
                await pg.wait_for_timeout(400)
                await pg.evaluate("window.__T=[]; drawScreen(buildModel())")
                r1=await pg.evaluate(JS_CHECK,'screen')
            await pg.evaluate("window.__T=[]; printDrawingPNG(buildModel())")
            r2=await pg.evaluate(JS_CHECK,'paper')
            for tag,r in (('screen',r1),('paper',r2)):
                stats[tag]['designs']+=1
                if r:
                    stats[tag]['bad']+=1
                    for o in r:
                        key=(tag,o['kind'],o['a'].split('″')[-1].strip() or 'number', (o.get('b','') or '').split('″')[-1].strip() or ('number' if o.get('b') else ''))
                        pairs[key]=pairs.get(key,0)+1
                    examples.append((i,tag,st['type'],r[:4],st))
        print(json.dumps(stats))
        for k,v in sorted(pairs.items(), key=lambda kv:-kv[1])[:20]: print(v, k)
        for e in examples[:10]: print(e[0], e[1], e[2], e[3])
        print("page errors:", errs or "none")
        bad=stats['screen']['bad']+stats['paper']['bad']
        print(f"failed checks: {bad + (1 if errs else 0)}")
        await br.close()
        return not bad and not errs
sys.exit(0 if asyncio.run(main()) else 1)
