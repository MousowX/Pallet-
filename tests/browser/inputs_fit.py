# Every visible number input must show its whole value (no "0." for 0.75), at 1440 and 1280 px wide,
# with the current values and with the longest value each input allows.
# Usage: python3 inputs_fit.py [path/to/pallet-lab.html]     (needs Playwright, like flows.py)
import pathlib
import asyncio, os, sys
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
FILE=os.path.abspath(next((a for a in sys.argv[1:] if a.lower().endswith((".html",".htm"))), os.path.join(HERE,"..","..","pallet-lab.html")))
JS = """(longest)=>{
  const out=[];
  document.querySelectorAll('#app input[type=number]').forEach(e=>{
    if(!e.offsetParent) return;                       // hidden row
    const keep=e.value;
    const step=parseFloat(e.step)||1, dec=(String(e.step).split('.')[1]||'').length;
    const vals=[keep];
    if(longest){ const mx=parseFloat(e.max); if(Number.isFinite(mx)) vals.push((Math.floor((mx-step)/step)*step+ (dec? step*0.5:0)).toFixed(dec)); }
    vals.forEach(v=>{ e.value=v; if(e.scrollWidth>e.clientWidth+1) out.push(e.id+'="'+v+'" needs '+e.scrollWidth+'px, has '+e.clientWidth+'px'); });
    e.value=keep;
  });
  return out; }"""
async def main():
    bad=0
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vw in (1440,1280):
            pg=await b.new_page(viewport={"width":vw,"height":900})
            await pg.goto(pathlib.Path(FILE).as_uri()); await pg.wait_for_timeout(300)
            for mode,steps in [("stringer",[]),("block",["#tBlk"]),("box preset",["#tBox","#btnPresetBox"])]:
                for s in steps: await pg.click(s)
                await pg.wait_for_timeout(100)
                r=await pg.evaluate(JS, False); r2=await pg.evaluate(JS, True)
                print(f"{vw} {mode:11s} current values: {'all fit' if not r else r}")
                print(f"{vw} {mode:11s} long values:    {'all fit' if not r2 else r2}")
                bad+=len(r)+len(r2)
            await pg.close()
        await b.close()
    print(f"failed checks: {bad}")
    return bad==0
sys.exit(0 if asyncio.run(main()) else 1)
