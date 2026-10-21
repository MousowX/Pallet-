# Browser checks (Chrome via Playwright): the in-browser design list (save, update, load, delete, damaged or
# blocked or full storage, two tabs), design files (good, damaged, foreign), type switching, printing.
# Usage: python3 flows.py [path/to/pallet-lab.html]     (needs: pip install playwright && playwright install chromium)
import pathlib
import asyncio, json, os, random, sys
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
URL=pathlib.Path(os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,"..","..","pallet-lab.html"))).as_uri()
import tempfile
D=tempfile.mkdtemp(prefix="pallet-lab-flows-")
BAD=["NaN","undefined","Infinity","null","[object"]
fails=[]
def check(cond,msg):
    if not cond: fails.append(msg); print("FAIL:",msg)
async def health(pg,tag):
    # visible text of results, BOM, cut list, warnings and drawing footer must be clean
    txt=await pg.evaluate("""()=>{
      const ids=['vpDims','warn','bom','cutList','details','results'];
      return ids.map(i=>{const e=document.getElementById(i);return e?e.innerText:''}).join('\\n')+'\\n'+document.body.innerText}""")
    for b in BAD:
        if b in txt:
            i=txt.index(b); check(False,f"{tag}: '{b}' shown: …{txt[max(0,i-60):i+40]!r}")
            break
    vp=await pg.evaluate("document.getElementById('vpDims').textContent")
    check(len(vp)>10, f"{tag}: drawing footer empty (page did not render)")
async def toast(pg):
    return await pg.evaluate("document.getElementById('toast').textContent")
async def newpage(b,init=None,ls=None):
    ctx=await b.new_context(viewport={"width":1440,"height":900}, accept_downloads=True)
    if init: await ctx.add_init_script(init)
    pg=await ctx.new_page()
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    if ls is not None:
        await pg.goto(URL); await pg.evaluate("v=>{localStorage.clear(); if(v!==null) localStorage.setItem('palletlab.designs',v)}", ls)
        await pg.reload()
    else:
        await pg.goto(URL)
    await pg.wait_for_timeout(300)
    # (an evaluated string whose value is a function gets called by Playwright, so end with a plain value)
    await pg.evaluate("window.print=()=>{window.__printed=(window.__printed||0)+1; window.__cutMode=document.body.classList.contains('printCut');}; 0")
    return ctx,pg,errs

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # ---------- A. library: save / update / load / delete ----------
        ctx,pg,errs=await newpage(b,ls=None)
        await pg.evaluate("localStorage.clear(); libRefresh()")
        await pg.evaluate("window.prompt=()=> 'Design A'; window.confirm=()=>true")
        await pg.fill("#partNo","LIB-A"); await pg.fill("#L","44")
        await pg.click("#btnLibSave"); t=await toast(pg)
        n=await pg.evaluate("document.getElementById('libSel').options.length")
        check(n==2 and t=="Saved Design A", f"A1 save: options={n} toast={t!r}")
        await pg.fill("#L","50"); await pg.click("#btnLibSave"); t=await toast(pg)
        lst=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs'))")
        check(len(lst)==1 and lst[0]["state"]["f"]["L"]=="50" and t=="Updated Design A", f"A2 update: len={len(lst)} toast={t!r}")
        await pg.evaluate("window.prompt=()=> 'Design B'"); await pg.click("#tBox"); await pg.click("#btnLibSave")
        await pg.evaluate("window.prompt=()=> null"); await pg.click("#btnLibSave")   # cancel → nothing
        lst=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs'))")
        check(len(lst)==2, f"A3 save B / cancel: len={len(lst)}")
        await pg.click("#tBlk"); await pg.fill("#L","36")
        await pg.select_option("#libSel","0"); await pg.wait_for_timeout(50)
        L=await pg.evaluate("document.getElementById('L').value"); ty=await pg.evaluate("palletType")
        check(L=="50" and ty=="stringer", f"A4 load A: L={L} type={ty}")
        await pg.select_option("#libSel","1"); ty=await pg.evaluate("palletType")
        check(ty=="box", f"A5 load B: type={ty}")
        await pg.evaluate("window.confirm=()=>false"); await pg.click("#btnLibDel")
        lst=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs'))"); check(len(lst)==2,"A6 delete cancelled must keep")
        await pg.evaluate("window.confirm=()=>true"); await pg.click("#btnLibDel"); t=await toast(pg)
        lst=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs'))")
        check(len(lst)==1 and lst[0]["name"]=="Design A" and t=="Deleted Design B", f"A7 delete B: {[d['name'] for d in lst]} toast={t!r}")
        await pg.click("#btnLibDel"); t=await toast(pg); check(t=="Pick a saved design first", f"A8 delete nothing picked: {t!r}")
        await pg.evaluate("window.prompt=()=> '<b>x</b> & \"q\"'"); await pg.click("#btnLibSave")
        html=await pg.evaluate("document.getElementById('libSel').innerHTML"); check("<b>" not in html, "A9 name escaped in list")
        await pg.reload(); await pg.wait_for_timeout(200)
        n=await pg.evaluate("document.getElementById('libSel').options.length"); check(n==3, f"A10 persists after reload: options={n}")
        await health(pg,"A"); check(not errs, f"A errors: {errs}")
        await ctx.close()

        # ---------- B. corrupted storage ----------
        for tag,val in [("invalid json","{oops"),("object",'{"a":1}'),("string",'"hello"'),("number","42"),
                        ("null entry","[null]"),("no state",'[{"name":"x"}]'),("no name",'[{"state":{"fmt":"pallet-lab/1","f":{}}}]'),
                        ("good+bad",'[{"name":"ok","state":{"fmt":"pallet-lab/1","type":"block","f":{"L":"40"}}},5,{"name":"y","state":null}]')]:
            ctx,pg,errs=await newpage(b,ls=val)
            await health(pg,f"B {tag}")
            check(not errs, f"B {tag}: page errors {errs}")
            dis=await pg.evaluate("document.getElementById('libSel').disabled")
            opts=await pg.evaluate("[...document.getElementById('libSel').options].map(o=>o.text)")
            print(f"  B {tag:12s} disabled={dis} options={opts}")
            # the good entry must still load
            if tag=="good+bad":
                await pg.select_option("#libSel",index=1); ty=await pg.evaluate("palletType")
                check(ty=="block", f"B good entry loads: type={ty}")
            # saving must still work (and repair the list)
            await pg.evaluate("window.prompt=()=> 'Fresh'"); 
            if not dis:
                await pg.click("#btnLibSave"); t=await toast(pg); check(t.startswith("Saved") or t.startswith("Updated"), f"B {tag}: save after corruption → {t!r}")
                check(not errs, f"B {tag}: errors after save {errs}")
            await ctx.close()

        # ---------- C. storage blocked ----------
        init="Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})"
        ctx,pg,errs=await newpage(b,init=init)
        await health(pg,"C blocked"); check(not errs, f"C errors: {errs}")
        dis=await pg.evaluate("document.getElementById('libSel').disabled"); hint=await pg.evaluate("document.getElementById('libHint').textContent")
        check(dis and "blocking" in hint, f"C library off with message: disabled={dis} hint={hint!r}")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        d=await dl.value; fn=os.path.join(D,"blocked_"+d.suggested_filename); await d.save_as(fn)
        check(json.load(open(fn))["fmt"]=="pallet-lab/1", "C file save works with storage blocked")
        await ctx.close()

        # ---------- D. design files ----------
        ctx,pg,errs=await newpage(b)
        await pg.click("#tBox"); await pg.click("#btnPresetBox"); await pg.select_option("#cleatMat","ply"); await pg.fill("#orderQty","25"); await pg.fill("#client","ACME / Foxconn"); await pg.fill("#partNo","CR-4840")
        await pg.select_option("#boxBase","block")
        saved=await pg.evaluate("collectState()")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        d=await dl.value; fn=os.path.join(D,d.suggested_filename); await d.save_as(fn)
        print("  D saved as", d.suggested_filename)
        await pg.click("#btnReset"); await pg.click("#tStr")
        await pg.set_input_files("#fileIn",fn); await pg.wait_for_timeout(150)
        now=await pg.evaluate("collectState()"); t=await toast(pg)
        diff={k:(saved['f'][k],now['f'].get(k)) for k in saved['f'] if saved['f'][k]!=now['f'].get(k)}
        check(not diff and now['type']=="box" and t.startswith("Loaded"), f"D1 round trip: diff={diff} type={now['type']} toast={t!r}")
        # same file twice in a row must load again
        await pg.click("#tStr"); await pg.set_input_files("#fileIn",fn); await pg.wait_for_timeout(150)
        check(await pg.evaluate("palletType")=="box", "D2 same file loads twice")
        def w(name,content):
            f=os.path.join(D,name); open(f,"w").write(content); return f
        before=await pg.evaluate("collectState()")
        cases=[("bad.json","hello {",False),("wrongfmt.json",json.dumps({"fmt":"other","f":{}}),False),
               ("nof.json",json.dumps({"fmt":"pallet-lab/1","type":"box"}),False),
               ("fstring.json",json.dumps({"fmt":"pallet-lab/1","f":"abc"}),False),
               ("array.json","[1,2,3]",False),("nulljson.json","null",False),
               ("empty.json","",False),("crate.json",json.dumps({"fmt":"pallet-lab/1","type":"crate","f":{"L":"40"}}),False),
               ("typenum.json",json.dumps({"fmt":"pallet-lab/1","type":3,"f":{}}),False)]
        for name,content,ok in cases:
            await pg.set_input_files("#fileIn",w(name,content)); await pg.wait_for_timeout(150)
            t=await toast(pg); st=await pg.evaluate("collectState()")
            unchanged = st['f']==before['f'] and st['type']==before['type']
            print(f"  D {name:14s} toast={t!r} unchanged={unchanged}")
            check(t.startswith("Could not load") and unchanged, f"D {name}: toast={t!r} unchanged={unchanged}")
            check(not errs, f"D {name}: errors {errs}")
        # odd but valid-looking files
        odd=[("badselects.json",{"fmt":"pallet-lab/1","type":"box","f":{"plyT":"0.3","sNotch":"maybe","boxBase":"steel","cleatMat":"x","bLay":"zz","attach":"glue","floorType":"?","clOrient":"diag","edgeCl":"q","kSBon":"2","boxLid":"7","floorPlyT":"9","spSel":"77"}}),
             ("empties.json",{"fmt":"pallet-lab/1","type":"block","f":{"L":None,"W":None,"dCount":None,"sNotch":None,"orderQty":None,"kerf":None}}),
             ("numbers.json",{"fmt":"pallet-lab/1","type":"stringer","f":{"L":44,"W":40.5,"dCount":7,"orderQty":3}}),
             ("objects.json",{"fmt":"pallet-lab/1","type":"box","f":{"L":{"a":1},"W":[1,2],"wH":True}}),
             ("huge.json",{"fmt":"pallet-lab/1","type":"box","f":{"L":"1e9","W":"-5","wH":"abc","orderQty":"1e12","sheetW":"0","sheetL":"-1","kerf":"5"}})]
        for name,obj in odd:
            await pg.click("#btnReset")
            await pg.set_input_files("#fileIn",w(name,json.dumps(obj))); await pg.wait_for_timeout(200)
            t=await toast(pg); ty=await pg.evaluate("palletType")
            on=await pg.evaluate("['tStr','tBlk','tBox'].filter(i=>document.getElementById(i).classList.contains('on'))")
            print(f"  D {name:16s} toast={t!r} type={ty} on={on}")
            await health(pg,f"D {name}"); check(not errs, f"D {name}: errors {errs}"); errs.clear()
            check(len(on)==1, f"D {name}: exactly one type button lit (got {on})")
            await pg.wait_for_timeout(400)
            sp=await pg.evaluate("document.getElementById('spec').textContent")
            for bword in BAD:
                if bword in sp: check(False,f"D {name}: spec sheet shows {bword}"); break
        await ctx.close()

        # ---------- E. random type / option switching ----------
        ctx,pg,errs=await newpage(b)
        rnd=random.Random(7)
        acts=["#tStr","#tBlk","#tBox","#btnPresetBox","#btnReset"]
        sels={"boxBase":["stringer","block"],"sNotch":["0","1"],"attach":["skirt","direct"] ,"floorType":["boards","ply"],
              "cleatMat":["lumber","ply"],"clOrient":["v","h"],"edgeCl":["in","out"],"boxLid":["0","1"],"kSBon":["0","1"],"bLay":["notch","even"]}
        # only use option values that exist
        for k in list(sels):
            vals=await pg.evaluate(f"[...document.getElementById('{k}').options].map(o=>o.value)")
            sels[k]=vals
        for step in range(250):
            r=rnd.random()
            if r<0.35:
                a=rnd.choice(acts)
                if await pg.evaluate(f"document.querySelector('{a}').offsetParent!==null"): await pg.click(a)
            elif r<0.8:
                k=rnd.choice(list(sels)); v=rnd.choice(sels[k])
                vis=await pg.evaluate(f"document.getElementById('{k}').offsetParent!==null")
                if vis: await pg.select_option("#"+k,v)
                else: await pg.evaluate(f"(()=>{{const e=document.getElementById('{k}'); e.value='{v}'; e.dispatchEvent(new Event('change'))}})()")
            else:
                k=rnd.choice(["L","W","wH","sCount","dCount","bCount","nGap","nLen","orderQty","kerf","sheetW","clSp"])
                v=str(rnd.choice([0,1,12,24,36,40,48,60,96,120,240,-1,"",0.5]))
                if await pg.evaluate(f"document.getElementById('{k}').offsetParent!==null"): await pg.fill("#"+k,v)
                else: await pg.evaluate(f"(()=>{{const e=document.getElementById('{k}'); e.value='{v}'; e.dispatchEvent(new Event('input'))}})()")
            if step%10==0:
                await health(pg,f"E step {step}")
                # sections must match the type
                st=await pg.evaluate("""()=>{const t=palletType, bb=document.getElementById('boxBase').value, v=id=>document.getElementById(id).style.display!=='none';
                   return {t,bb,str:v('secStringer'),blk:v('secBlock'),box:v('secBox')}}""")
                expS = st['t']=="stringer" or (st['t']=="box" and st['bb']=="stringer")
                expB = st['t']=="block" or (st['t']=="box" and st['bb']=="block")
                check(st['str']==expS and st['blk']==expB and st['box']==(st['t']=="box"), f"E step {step}: sections {st}")
            if errs: check(False, f"E step {step}: {errs}"); errs.clear()
        await pg.wait_for_timeout(450)
        sp=await pg.evaluate("document.getElementById('spec').textContent")
        check(not any(x in sp for x in BAD), "E spec sheet clean after switching")
        await ctx.close()

        # ---------- G. storage full ----------
        ctx,pg,errs=await newpage(b,ls='[]')
        await pg.evaluate("""()=>{ window.prompt=()=> 'Full one'; window.confirm=()=>true;
           const real=Storage.prototype.setItem;
           Storage.prototype.setItem=function(k,v){ const cur=this.getItem(k)||'';
             if(window.__full && v.length>cur.length) throw new DOMException('full','QuotaExceededError'); return real.call(this,k,v); }; }""")
        await pg.click("#btnLibSave")                     # fits
        await pg.evaluate("window.__full=true; window.prompt=()=> 'Too many'")
        await pg.click("#btnLibSave"); t=await toast(pg)
        dis=await pg.evaluate("document.getElementById('libSel').disabled")
        check("full" in t and not dis, f"G1 full storage: toast={t!r} list disabled={dis}")
        await pg.select_option("#libSel","0"); await pg.click("#btnLibDel"); t=await toast(pg)
        n=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs')).length")
        check(t=="Deleted Full one" and n==0, f"G2 delete still works when full: toast={t!r} left={n}")
        check(not errs, f"G errors {errs}")
        await ctx.close()

        # ---------- H. two tabs ----------
        ctx=await b.new_context(viewport={"width":1440,"height":900})
        p1=await ctx.new_page(); p2=await ctx.new_page(); errs=[]
        for q in (p1,p2): q.on("pageerror", lambda e: errs.append(str(e)))
        await p1.goto(URL); await p1.evaluate("localStorage.clear()"); await p1.reload(); await p2.goto(URL)
        await p1.wait_for_timeout(300); await p2.wait_for_timeout(300)
        await p1.evaluate("window.prompt=()=> 'T1'"); await p1.click("#btnLibSave"); await p2.wait_for_timeout(300)
        o2=await p2.evaluate("[...document.getElementById('libSel').options].map(o=>o.text)")
        check(len(o2)==2 and o2[1].startswith("T1"), f"H1 other tab sees the new design: {o2}")
        await p2.select_option("#libSel","0")
        await p1.evaluate("window.prompt=()=> 'A0'"); await p1.click("#btnLibSave"); await p2.wait_for_timeout(300)
        sel=await p2.evaluate("(()=>{const s=document.getElementById('libSel'); return s.options[s.selectedIndex].text})()")
        check(sel.startswith("T1"), f"H2 pick kept when the other tab adds one: {sel!r}")
        await p1.evaluate("window.confirm=()=>true"); await p1.select_option("#libSel","0"); await p1.click("#btnLibDel"); await p2.wait_for_timeout(300)
        o2=await p2.evaluate("[...document.getElementById('libSel').options].map(o=>o.text)")
        v2=await p2.evaluate("document.getElementById('libSel').value")
        check(len(o2)==2 and o2[1].startswith("A0") and v2=="", f"H3 other tab drops the deleted one: {o2} value={v2!r}")
        check(not errs, f"H errors {errs}")
        await ctx.close()

        # ---------- F. printing ----------
        ctx,pg,errs=await newpage(b)
        await pg.keyboard.press("Control+p"); await pg.wait_for_function("window.__printed===1",timeout=5000)
        check(await pg.evaluate("window.__printed")==1 and not await pg.evaluate("window.__cutMode"), "F1 Ctrl+P prints spec")
        await pg.click("#btnCut"); await pg.wait_for_function("window.__printed===2",timeout=5000)
        check(await pg.evaluate("window.__printed")==2 and await pg.evaluate("window.__cutMode"), "F2 cut list prints in cut mode")
        await pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
        check(not await pg.evaluate("document.body.classList.contains('printCut')"), "F3 cut mode undone after print")
        await pg.click("#btnCut"); await pg.click("#btnPrint"); await pg.wait_for_function("window.__printed===4",timeout=5000)
        check(not await pg.evaluate("window.__cutMode"), "F4 print button after cut list prints spec")
        check(not errs, f"F errors {errs}")
        await ctx.close()
        await b.close()
    print("\nFLOWS:", "PASS" if not fails else f"{len(fails)} FAIL")
asyncio.run(main())
sys.exit(1 if fails else 0)
