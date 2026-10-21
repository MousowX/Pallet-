# Same designs, two versions of the tool: the drawings must come out the same, pixel for pixel.
# The paper drawing (spec sheet) is drawn at a fixed size, so it must match exactly. The screen drawing
# follows the size of the drawing area: if a restructure changes the page layout, screen differences
# are expected and reported apart.
# Usage: python3 compare_drawings.py [baseline.html] [candidate.html] [N]
#   defaults: the newest approved version in ../../history  vs  ../../pallet-lab.html, 120 designs
# Needs: pip install playwright && playwright install chromium
import pathlib
import asyncio, base64, os, random, sys, tempfile
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
args=sys.argv[1:]; files=[a for a in args if a.lower().endswith((".html",".htm"))]
import re
HIST=os.path.join(HERE,"..","..","history")
def newest():
    f=sorted((n for n in os.listdir(HIST) if re.match(r"^\d+_.*\.html?$",n,re.I) and not re.search("REVERTED|SUPERSEDED",n,re.I)), key=lambda n:int(n.split("_")[0]))
    return os.path.join(HIST,f[-1])
BASE=os.path.abspath(files[0] if files else newest())
CAND=os.path.abspath(files[1] if len(files)>1 else os.path.join(HERE,"..","..","pallet-lab.html"))
N=int(next((a for a in args if a.isdigit()), 120))
random.seed(1017)
def design():
    t=random.choice(['stringer','stringer','block','box','box'])
    f=dict(L=random.choice([36,40,42,44,46,48,48,48,52,60,72,96,120]), W=random.choice([30,36,40,40,42,44,48,60]),
      dCount=random.randint(3,12), dWidth=random.choice([3.5,3.5,5.5]), dLead=random.choice(['',5.5]), dThk=random.choice([0.5625,0.625,0.75]),
      bCount=random.choice([0,3,5,5,7]), bWidth=random.choice([3.5,5.5]), bLead=random.choice(['',5.5]), bThk=0.75, bLay=random.choice(['notch','even']),
      sCount=random.choice([2,3,3,4,5]), sThk=random.choice([1.25,1.5]), sHgt=3.5, sNotch=random.choice(['1','1','0']),
      nLen=random.choice([6,9,12]), nDep=1.5, nGap=random.choice([6,10,13,18,22,30]),
      kNL=random.choice([3,3,4]), kNW=random.choice([3,3,4]), kSize=random.choice([3.5,5.5]), kHgt=3.5, kSBon=random.choice(['1','0']), kSBt=0.75, kSBw=3.5,
      boxBase=random.choice(['stringer','block']), floorType=random.choice(['boards','ply','plyboards']), wH=random.choice([12,24,30,48,60]),
      plyT=random.choice(['0.375','0.5']), cleatT=0.75, cleatW=3.5, clSp=24, edgeCl=random.choice(['in','out']), clOrient=random.choice(['v','h']),
      attach=random.choice(['skirt','surface']), sideOv=random.choice([0,0.75,2.5,4]), endOv=random.choice([0,0.75,2.5]), boxLid=random.choice(['1','0']),
      cleatMat=random.choice(['lumber','ply']), species='0')
    return {"fmt":"pallet-lab/1","type":t,"f":{k:str(v) for k,v in f.items()}}
GRAB="""()=>{ const m=buildModel(); drawScreen(m); return [document.getElementById('cv').toDataURL('image/png'), printDrawingPNG(m)]; }"""
async def main():
    out=tempfile.mkdtemp(prefix="pallet-lab-drawings-")
    async with async_playwright() as p:
        br=await p.chromium.launch(); pages=[]; errs=[]
        for f in (BASE,CAND):
            pg=await br.new_page(viewport={"width":1440,"height":900}); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(pathlib.Path(f).as_uri()); await pg.wait_for_timeout(300); pages.append(pg)
        paper=screen=0; shown=0
        for i in range(N):
            st=design(); got=[]
            for pg in pages:
                await pg.evaluate("s=>applyState(s,'')", st)
                got.append(await pg.evaluate(GRAB))
            (s0,p0),(s1,p1)=got
            for kind,a,b in (("paper",p0,p1),("screen",s0,s1)):
                if a!=b:
                    if kind=="paper": paper+=1
                    else: screen+=1
                    if shown<6:
                        shown+=1
                        for tag,u in (("baseline",a),("candidate",b)):
                            open(os.path.join(out,f"{i:03d}_{kind}_{tag}.png"),"wb").write(base64.b64decode(u.split(",")[1]))
        await br.close()
    print(f"baseline:  {os.path.basename(BASE)}\ncandidate: {os.path.basename(CAND)}")
    print(f"designs compared: {N} · paper drawings different: {paper} · screen drawings different: {screen}")
    if paper or screen: print(f"examples saved in: {out}")
    print("page errors:", errs[:3] or "none")
    print(f"failed checks: {(1 if paper else 0) + (1 if errs else 0)}" + ("  (screen differences alone are expected when the page layout changed)" if screen and not paper else ""))
    return not paper and not errs
sys.exit(0 if asyncio.run(main()) else 1)
