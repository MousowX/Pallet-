# The pallet spec sheet must print on ONE Letter page: checks N realistic pallet designs (816 x 1056 CSS px incl. margins).
# Usage: python3 printfit.py [path/to/pallet-lab.html] [N]     (needs Playwright, like flows.py)
import pathlib
import asyncio, random, json, sys
from playwright.async_api import async_playwright
import os
HERE=os.path.dirname(os.path.abspath(__file__))
args=sys.argv[1:]
FILE=os.path.abspath(next((a for a in args if a.lower().endswith((".html",".htm"))), os.path.join(HERE,"..","..","pallet-lab.html")))
N=int(next((a for a in args if a.isdigit()), 150))
random.seed(4)
def design():
    t=random.choice(['stringer','block'])
    f=dict(L=random.choice([36,40,42,44,46,48,48,48,52,54,60]), W=random.choice([36,40,40,40,42,44,48]),
      dCount=random.randint(5,9), dWidth=random.choice([3.5,3.5,5.5]), dLead=random.choice(['',5.5,5.5]),
      dThk=random.choice([0.625,0.75]), bCount=random.choice([0,3,5,5]), bWidth=random.choice([3.5,5.5]), bLead=random.choice(['',5.5]),
      bThk=0.75, bLay=random.choice(['notch','even']), sCount=random.choice([2,3,3,4]), sThk=1.5, sHgt=3.5,
      sNotch=random.choice(['1','1','0']), nLen=9, nDep=1.5, nGap=random.choice([13,22]),
      kNL=3, kNW=3, kSize=random.choice([3.5,5.5]), kHgt=3.5, kSBon=random.choice(['1','0']), kSBt=0.75, kSBw=3.5, species=random.choice(['0','1']))
    return {"fmt":"pallet-lab/1","type":t,"f":{k:str(v) for k,v in f.items()}}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={"width":816,"height":1056})
        await pg.goto(pathlib.Path(FILE).as_uri()); await pg.wait_for_timeout(300)
        await pg.fill("#partNo","PLT-4840-GMA-REV-B"); await pg.fill("#client","Cliente Industrial del Norte")
        hs=[]; worst=None
        for i in range(N):
            st=design()
            await pg.evaluate("s=>applyState(s,'')", st)
            await pg.emulate_media(media="print")
            h=await pg.evaluate("async()=>{ if(typeof flushSpec==='function') flushSpec(); const i=document.querySelector('#spec img'); if(i&&i.decode) await i.decode(); return document.getElementById('spec').getBoundingClientRect().height; }")
            await pg.emulate_media(media="screen")
            hs.append(h)
            if worst is None or h>worst[0]: worst=(h,st)
        fit=sum(1 for h in hs if h<=1056)
        print(f"{os.path.basename(FILE)}: {fit}/{N} pallet designs fit one page · tallest {max(hs):.0f}px · median {sorted(hs)[N//2]:.0f}px")
        print("tallest design:", json.dumps(worst[1]))
        await b.close()
        return fit==N
sys.exit(0 if asyncio.run(main()) else 1)
