# Browser checks (Chrome via Playwright): the design list and its database (save, update, load, delete, the
# older in-browser list moved in, damaged or blocked or full storage, two tabs, design files saved and loaded
# into the list, importing many files, search), design files (good, damaged, foreign), type switching, printing.
# Usage: python3 flows.py [path/to/pallet-lab.html]     (needs: pip install playwright && playwright install chromium)
import pathlib
import asyncio, json, os, random, sys, unicodedata
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
URL=pathlib.Path(os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,"..","..","pallet-lab.html"))).as_uri()
OLD=os.path.join(HERE,"..","fixtures","old-saves")
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
# the design list works in the background: wait until it has settled
async def idle(pg):
    await pg.evaluate("libIdle()")
# every design in the list, in order, with what is stored for it
LIST_JS="""async()=>{ await libIdle(); const rows=await designDB.list();
  return Promise.all(rows.map(async r=>({name:r.name, source:r.source||'', state:await designDB.get(r.id)}))); }"""
async def lib(pg):
    return await pg.evaluate(LIST_JS)
async def options(pg):
    return await pg.evaluate("[...document.getElementById('libSel').options].map(o=>({v:o.value,t:o.text}))")
async def newpage(b,init=None,ls=None):
    ctx=await b.new_context(viewport={"width":1440,"height":900}, accept_downloads=True)
    if init: await ctx.add_init_script(init)
    pg=await ctx.new_page()
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    if ls is not None:
        await pg.goto(URL); await idle(pg)
        await pg.evaluate("v=>{localStorage.clear(); if(v!==null) localStorage.setItem('palletlab.designs',v)}", ls)
        await pg.reload()
    else:
        await pg.goto(URL)
    await pg.wait_for_timeout(300); await idle(pg)
    # (an evaluated string whose value is a function gets called by Playwright, so end with a plain value)
    await pg.evaluate("window.print=()=>{window.__printed=(window.__printed||0)+1; window.__cutMode=document.body.classList.contains('printCut');}; 0")
    return ctx,pg,errs
def wfile(name,content):
    f=os.path.join(D,name); open(f,"w",encoding="utf-8").write(content); return f
# the search rule, written again here: every word, in name, client, part #, type or date; no accents or capitals
def fold(s): return "".join(c for c in unicodedata.normalize("NFD",s) if not unicodedata.combining(c)).lower()
def matches(words,st,name):
    f=st.get("f",{}); txt=fold(" ".join([name,str(f.get("client","")),str(f.get("partNo","")),st.get("type") or "stringer",str(st.get("saved",""))[:10]]))
    return all(w in txt for w in fold(words).split())
BLOCK_LS="Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}});"
BLOCK_IDB="Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('blocked','SecurityError')}});"

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # ---------- A. design list: save / update / load / delete ----------
        ctx,pg,errs=await newpage(b)
        kind=await pg.evaluate("designDB.kind"); check(kind=="db", f"A0 the list uses the database (IndexedDB): kind={kind}")
        await pg.evaluate("window.prompt=()=> 'Design A'; window.confirm=()=>true")
        await pg.fill("#partNo","LIB-A"); await pg.fill("#L","44")
        await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        n=await pg.evaluate("document.getElementById('libSel').options.length")
        check(n==2 and t=="Saved Design A", f"A1 save: options={n} toast={t!r}")
        await pg.fill("#L","50"); await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        lst=await lib(pg)
        check(len(lst)==1 and lst[0]["state"]["f"]["L"]=="50" and t=="Updated Design A", f"A2 update: len={len(lst)} toast={t!r}")
        await pg.evaluate("window.prompt=()=> 'Design B'"); await pg.click("#tBox"); await pg.click("#btnLibSave"); await idle(pg)
        await pg.evaluate("window.prompt=()=> null"); await pg.click("#btnLibSave"); await idle(pg)   # cancel → nothing
        lst=await lib(pg)
        check(len(lst)==2, f"A3 save B / cancel: len={len(lst)}")
        await pg.click("#tBlk"); await pg.fill("#L","36")
        o=await options(pg)
        await pg.select_option("#libSel",o[1]["v"]); await idle(pg)
        L=await pg.evaluate("document.getElementById('L').value"); ty=await pg.evaluate("palletType")
        check(L=="50" and ty=="stringer", f"A4 load A: L={L} type={ty}")
        await pg.select_option("#libSel",o[2]["v"]); await idle(pg); ty=await pg.evaluate("palletType")
        check(ty=="box", f"A5 load B: type={ty}")
        await pg.evaluate("window.confirm=()=>false"); await pg.click("#btnLibDel"); await idle(pg)
        lst=await lib(pg); check(len(lst)==2,"A6 delete cancelled must keep")
        await pg.evaluate("window.confirm=()=>true"); await pg.click("#btnLibDel"); await idle(pg); t=await toast(pg)
        lst=await lib(pg)
        check(len(lst)==1 and lst[0]["name"]=="Design A" and t=="Deleted Design B", f"A7 delete B: {[d['name'] for d in lst]} toast={t!r}")
        await pg.click("#btnLibDel"); t=await toast(pg); check(t=="Pick a saved design first", f"A8 delete nothing picked: {t!r}")
        await pg.evaluate("window.prompt=()=> '<b>x</b> & \"q\"'"); await pg.click("#btnLibSave"); await idle(pg)
        html=await pg.evaluate("document.getElementById('libSel').innerHTML"); check("<b>" not in html, "A9 name escaped in list")
        o=await options(pg); check(o[2]["t"].startswith('<b>x</b> & "q"'), f"A9b odd name shown as typed: {o[2]['t']!r}")
        await pg.evaluate("window.prompt=()=> 'Design A'"); await pg.click("#btnLibSave"); await idle(pg)
        o=await options(pg); check([x["t"].split(" · ")[0] for x in o[1:]]==["Design A",'<b>x</b> & "q"'], f"A10 an updated design keeps its place: {o}")
        await pg.reload(); await pg.wait_for_timeout(200); await idle(pg)
        n=await pg.evaluate("document.getElementById('libSel').options.length"); check(n==3, f"A11 persists after reload: options={n}")
        st=await pg.evaluate("collectState()"); check("libFind" not in st["f"] and "libSel" not in st["f"], "A12 the list and search box are not part of a design")
        await health(pg,"A"); check(not errs, f"A errors: {errs}")
        await ctx.close()

        # ---------- B. damaged older in-browser list: what can be used moves into the database ----------
        for tag,val in [("invalid json","{oops"),("object",'{"a":1}'),("string",'"hello"'),("number","42"),
                        ("null entry","[null]"),("no state",'[{"name":"x"}]'),("no name",'[{"state":{"fmt":"pallet-lab/1","f":{}}}]'),
                        ("good+bad",'[{"name":"ok","state":{"fmt":"pallet-lab/1","type":"block","f":{"L":"40"}}},5,{"name":"y","state":null}]')]:
            ctx,pg,errs=await newpage(b,ls=val)
            await health(pg,f"B {tag}")
            check(not errs, f"B {tag}: page errors {errs}")
            dis=await pg.evaluate("document.getElementById('libSel').disabled")
            opts=await pg.evaluate("[...document.getElementById('libSel').options].map(o=>o.text)")
            print(f"  B {tag:12s} disabled={dis} options={opts}")
            moved=await pg.evaluate("[localStorage.getItem('palletlab.designs'), localStorage.getItem('palletlab.designs.backup')]")
            check(moved[0] is None and moved[1]==val, f"B {tag}: old list moved to the backup key: {moved}")
            # the good entry must still load
            if tag=="good+bad":
                check(len(opts)==2 and opts[1].startswith("ok"), f"B good entry listed: {opts}")
                await pg.select_option("#libSel",index=1); await idle(pg); ty=await pg.evaluate("palletType")
                check(ty=="block", f"B good entry loads: type={ty}")
            else:
                check(len(opts)==1, f"B {tag}: nothing usable, nothing listed: {opts}")
            # saving must still work
            await pg.evaluate("window.prompt=()=> 'Fresh'")
            if not dis:
                await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg); check(t.startswith("Saved") or t.startswith("Updated"), f"B {tag}: save after corruption → {t!r}")
                check(not errs, f"B {tag}: errors after save {errs}")
            await ctx.close()
        # damaged rows inside the database itself are left out, the good ones still load
        ctx,pg,errs=await newpage(b)
        await pg.evaluate("""()=>new Promise(ok=>{ const rq=indexedDB.open('palletlab',1); rq.onsuccess=()=>{ const db=rq.result,
            t=db.transaction(['list','files'],'readwrite'), l=t.objectStore('list'), f=t.objectStore('files');
            l.put({id:901,name:'',type:'box'}); l.put({id:902,name:'no file'}); l.put({id:903,name:'good',type:'block',saved:'2026-10-20T00:00:00Z'});
            f.put({id:903,state:{fmt:'pallet-lab/1',type:'block',f:{L:'41'}}}); t.oncomplete=()=>{ db.close(); ok(); }; }; })""")
        await pg.evaluate("libRefresh()"); await idle(pg)
        o=await options(pg); check([x["t"] for x in o[1:]]==["no file ·","good · 2026-10-20"], f"B2 damaged rows left out: {o}")
        await pg.select_option("#libSel",o[1]["v"]); await idle(pg); t=await toast(pg)
        check(t.startswith("Could not load"), f"B3 a row without its design says so: {t!r}")
        await pg.select_option("#libSel",o[2]["v"]); await idle(pg)
        check(await pg.evaluate("palletType")=="block" and await pg.evaluate("document.getElementById('L').value")=="41", "B4 the good row loads")
        await health(pg,"B2"); check(not errs, f"B2 errors {errs}")
        await ctx.close()

        # ---------- C. storage blocked ----------
        ctx,pg,errs=await newpage(b,init=BLOCK_LS+BLOCK_IDB)
        await health(pg,"C blocked"); check(not errs, f"C errors: {errs}")
        dis=await pg.evaluate("['libSel','libFind','btnLibSave','btnLibDel','btnImport'].every(i=>document.getElementById(i).disabled)")
        hint=await pg.evaluate("document.getElementById('libHint').textContent")
        check(dis and "blocking" in hint, f"C library off with message: disabled={dis} hint={hint!r}")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        d=await dl.value; fn=os.path.join(D,"blocked_"+d.suggested_filename); await d.save_as(fn)
        check(json.load(open(fn))["fmt"]=="pallet-lab/1", "C file save works with storage blocked")
        await pg.set_input_files("#fileIn",fn); await pg.wait_for_timeout(150); await idle(pg); t=await toast(pg)
        check(t.startswith("Loaded"), f"C file load works with storage blocked: {t!r}")
        check(not errs, f"C errors after files: {errs}")
        await ctx.close()
        # only the database refused: the older in-browser list is used, as before
        ctx,pg,errs=await newpage(b,init=BLOCK_IDB)
        kind=await pg.evaluate("designDB.kind"); check(kind=="local", f"C2 no database → older list: kind={kind}")
        await pg.evaluate("window.prompt=()=> 'Kept here'"); await pg.fill("#L","46"); await pg.click("#btnLibSave"); await idle(pg)
        raw=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs'))")
        check(len(raw)==1 and raw[0]["name"]=="Kept here" and raw[0]["state"]["f"]["L"]=="46", f"C2 saved in the older list: {raw}")
        await pg.fill("#L","60"); await pg.select_option("#libSel",index=1); await idle(pg)
        check(await pg.evaluate("document.getElementById('L').value")=="46", "C2 loads from the older list")
        check(not errs, f"C2 errors {errs}")
        await ctx.close()
        # only localStorage refused: the database still works
        ctx,pg,errs=await newpage(b,init=BLOCK_LS)
        kind=await pg.evaluate("designDB.kind"); check(kind=="db", f"C3 database works without localStorage: kind={kind}")
        await pg.evaluate("window.prompt=()=> 'In the db'"); await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        check(t=="Saved In the db" and len(await lib(pg))==1, f"C3 save: {t!r}")
        check(not errs, f"C3 errors {errs}")
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
        ctx,pg,errs=await newpage(b)
        await pg.evaluate("""()=>{ window.prompt=()=> 'Full one'; window.confirm=()=>true;
           for(const m of ['put','add']){ const real=IDBObjectStore.prototype[m];
             IDBObjectStore.prototype[m]=function(...a){ if(window.__full) throw new DOMException('full','QuotaExceededError'); return real.apply(this,a); }; } }""")
        await pg.click("#btnLibSave"); await idle(pg)                     # fits
        await pg.evaluate("window.__full=true; window.prompt=()=> 'Too many'")
        await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        dis=await pg.evaluate("document.getElementById('libSel').disabled")
        check("full" in t and not dis and len(await lib(pg))==1, f"G1 full storage: toast={t!r} list disabled={dis}")
        await pg.select_option("#libSel",index=1); await idle(pg); await pg.click("#btnLibDel"); await idle(pg); t=await toast(pg)
        check(t=="Deleted Full one" and len(await lib(pg))==0, f"G2 delete still works when full: toast={t!r}")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        await dl.value; await idle(pg); t=await toast(pg)
        check(t.startswith("Saved ") and "storage is full" in t, f"G3 file still saved, list full said: {t!r}")
        check(not errs, f"G errors {errs}")
        await ctx.close()
        # the older in-browser list (no database) when full, as before
        ctx,pg,errs=await newpage(b,init=BLOCK_IDB,ls='[]')
        await pg.evaluate("""()=>{ window.prompt=()=> 'Full one'; window.confirm=()=>true;
           const real=Storage.prototype.setItem;
           Storage.prototype.setItem=function(k,v){ const cur=this.getItem(k)||'';
             if(window.__full && k==='palletlab.designs' && v.length>cur.length) throw new DOMException('full','QuotaExceededError'); return real.call(this,k,v); }; }""")
        await pg.click("#btnLibSave"); await idle(pg)
        await pg.evaluate("window.__full=true; window.prompt=()=> 'Too many'")
        await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        dis=await pg.evaluate("document.getElementById('libSel').disabled")
        check("full" in t and not dis, f"G4 older list full: toast={t!r} list disabled={dis}")
        await pg.select_option("#libSel",index=1); await idle(pg); await pg.click("#btnLibDel"); await idle(pg); t=await toast(pg)
        n=await pg.evaluate("JSON.parse(localStorage.getItem('palletlab.designs')).length")
        check(t=="Deleted Full one" and n==0, f"G5 delete still works when full: toast={t!r} left={n}")
        check(not errs, f"G4 errors {errs}")
        await ctx.close()

        # ---------- H. two tabs ----------
        for tag,init in (("database",None),("older list",BLOCK_IDB)):
            ctx=await b.new_context(viewport={"width":1440,"height":900})
            if init: await ctx.add_init_script(init)
            p1=await ctx.new_page(); p2=await ctx.new_page(); errs=[]
            for q in (p1,p2): q.on("pageerror", lambda e: errs.append(str(e)))
            await p1.goto(URL); await p2.goto(URL)
            await p1.wait_for_timeout(300); await p2.wait_for_timeout(300); await idle(p1); await idle(p2)
            await p1.evaluate("window.prompt=()=> 'T1'"); await p1.click("#btnLibSave"); await idle(p1); await p2.wait_for_timeout(300); await idle(p2)
            o2=await p2.evaluate("[...document.getElementById('libSel').options].map(o=>o.text)")
            check(len(o2)==2 and o2[1].startswith("T1"), f"H1 {tag}: other tab sees the new design: {o2}")
            await p2.select_option("#libSel",index=1); await idle(p2)
            await p1.evaluate("window.prompt=()=> 'A0'"); await p1.click("#btnLibSave"); await idle(p1); await p2.wait_for_timeout(300); await idle(p2)
            sel=await p2.evaluate("(()=>{const s=document.getElementById('libSel'); return s.options[s.selectedIndex].text})()")
            check(sel.startswith("T1"), f"H2 {tag}: pick kept when the other tab adds one: {sel!r}")
            await p1.evaluate("window.confirm=()=>true"); await p1.select_option("#libSel",index=1); await idle(p1); await p1.click("#btnLibDel"); await idle(p1)
            await p2.wait_for_timeout(300); await idle(p2)
            o2=await p2.evaluate("[...document.getElementById('libSel').options].map(o=>o.text)")
            v2=await p2.evaluate("document.getElementById('libSel').value")
            check(len(o2)==2 and o2[1].startswith("A0") and v2=="", f"H3 {tag}: other tab drops the deleted one: {o2} value={v2!r}")
            check(not errs, f"H {tag} errors {errs}")
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

        # ---------- I. design files go into the list ----------
        ctx,pg,errs=await newpage(b)
        await pg.fill("#partNo","CR-77"); await pg.fill("#client","Peñoles")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        d=await dl.value; fn=os.path.join(D,d.suggested_filename); await d.save_as(fn); await idle(pg)
        base=d.suggested_filename[:-len(".pltlab.json")]
        lst=await lib(pg); t=await toast(pg); sel=await pg.evaluate("document.getElementById('libSel').selectedOptions[0].text")
        check(len(lst)==1 and lst[0]["name"]==base and lst[0]["source"]=="file" and lst[0]["state"]==json.load(open(fn,encoding="utf-8")),
              f"I1 saved file is in the list as {base!r}: {[x['name'] for x in lst]}")
        check(t=="Saved "+d.suggested_filename and sel.startswith(base), f"I2 toast {t!r}, picked {sel!r}")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        await dl.value; await idle(pg)
        check(len(await lib(pg))==1, "I3 saving the same file again updates it, no copy")
        one={"fmt":"pallet-lab/1","type":"block","saved":"2026-09-01T10:00:00.000Z","f":{"L":"42","W":"40","partNo":"BLK-9"}}
        await pg.set_input_files("#fileIn",wfile("loaded-one.pltlab.json",json.dumps(one))); await pg.wait_for_timeout(150); await idle(pg)
        lst=await lib(pg); t=await toast(pg)
        check(len(lst)==2 and lst[1]["name"]=="loaded-one" and lst[1]["state"]==one and t=="Loaded loaded-one.pltlab.json",
              f"I4 loaded file added as it was saved: {[x['name'] for x in lst]} toast={t!r}")
        await pg.set_input_files("#fileIn",wfile("other.json",json.dumps(dict(one,type="box")))); await pg.wait_for_timeout(150); await idle(pg)
        lst=await lib(pg); check(len(lst)==3 and lst[2]["name"]=="other", f"I5 a .json file is listed without the extension: {[x['name'] for x in lst]}")
        await pg.set_input_files("#fileIn",wfile("broken.pltlab.json","{nope")); await pg.wait_for_timeout(150); await idle(pg)
        check(len(await lib(pg))==3, "I6 a file that can't be opened is not added")
        await health(pg,"I"); check(not errs, f"I errors {errs}")

        # ---------- J. import many files at once ----------
        fx=sorted(n for n in os.listdir(OLD) if n.endswith(".pltlab.json"))
        paths=[os.path.join(OLD,n) for n in fx]+[wfile("notes.json",'{"hello":1}'), wfile("garbage.pltlab.json","x")]
        await pg.click("#btnReset"); before=await pg.evaluate("collectState()")
        await pg.set_input_files("#importIn",paths)
        await pg.wait_for_function("document.getElementById('toast').textContent.startsWith('Imported')",timeout=10000); await idle(pg)
        t=await toast(pg); lst=await lib(pg); now=await pg.evaluate("collectState()")
        names=[x["name"] for x in lst][3:]
        check(names==[n[:-len(".pltlab.json")] for n in fx], f"J1 imported in file order: {names}")
        check(all(x["state"]==json.load(open(os.path.join(OLD,n),encoding="utf-8")) for x,n in zip(lst[3:],fx)), "J2 imported designs stored as the files are")
        check(t==f"Imported {len(fx)} designs · 2 files skipped: not design files", f"J3 toast: {t!r}")
        check(now["f"]==before["f"] and now["type"]==before["type"], "J4 importing leaves the design on screen as it was")
        await pg.set_input_files("#importIn",paths[:3])
        await pg.wait_for_function("document.getElementById('toast').textContent.startsWith('Imported 3')",timeout=10000); await idle(pg)
        t=await toast(pg); check(len(await lib(pg))==3+len(fx) and "3 replaced" in t, f"J5 importing again replaces, no copies: {t!r}")
        await pg.set_input_files("#importIn",[paths[-1]])
        await pg.wait_for_function("document.getElementById('toast').textContent.startsWith('Nothing')",timeout=10000); await idle(pg)
        t=await toast(pg); check(t=="Nothing imported: the file is not PALLET·LAB design files" or t.startswith("Nothing imported"), f"J6 only bad files: {t!r}")
        o=await options(pg); first=[x for x in o if x["t"].startswith("1-first-version_box")][0]
        await pg.select_option("#libSel",first["v"]); await idle(pg)
        t=await toast(pg); check(await pg.evaluate("palletType")=="box" and t=="Loaded 1-first-version_box", f"J7 an imported old design opens: {t!r}")
        await health(pg,"J"); check(not errs, f"J errors {errs}")

        # ---------- K. search ----------
        lst=await lib(pg); total=len(lst)
        for words in ["stringer","oct 16 box","PENOLES","penoles cr-77","2026-09","blk-9","zzz nothing"]:
            await pg.fill("#libFind",words)
            o=await options(pg); shown=[x["t"].split(" · ")[0] for x in o[1:]]
            want=[x["name"] for x in lst if matches(words,x["state"],x["name"])]
            head=o[0]["t"]
            check(shown==want, f"K {words!r}: shown {shown} want {want}")
            check(head==(f"— {len(want)} of {total} match —" if want else "— no match —"), f"K {words!r}: first line {head!r}")
        res=[]
        for words in ["penoles","PEÑOLES","Peñoles"]:
            await pg.fill("#libFind",words); res.append([x["t"] for x in await options(pg)])
        check(res[0]==res[1]==res[2] and any(x.startswith(base) for x in res[0]), f"K accents and capitals ignored: {res}")
        await pg.focus("#libFind"); await pg.keyboard.press("Escape")
        o=await options(pg); check(len(o)==total+1 and await pg.evaluate("document.getElementById('libFind').value")=="", "K Escape clears the search")
        ph=await pg.evaluate("document.getElementById('libFind').placeholder"); check(ph==f"search {total} saved designs", f"K placeholder counts: {ph!r}")
        # a design saved while a search hides it: the search clears so the new one shows, picked
        await pg.fill("#libFind","stringer"); await pg.evaluate("window.prompt=()=> 'Shown after save'"); await pg.click("#btnLibSave"); await idle(pg)
        sel=await pg.evaluate("document.getElementById('libSel').selectedOptions[0].text")
        check(sel.startswith("Shown after save") and await pg.evaluate("document.getElementById('libFind').value")=="", f"K save clears a hiding search: {sel!r}")
        await health(pg,"K"); check(not errs, f"K errors {errs}")
        await ctx.close()

        # ---------- L. the older in-browser list moves into the database once ----------
        old=[{"name":"Old one","state":{"fmt":"pallet-lab/1","type":"block","saved":"2026-10-01T00:00:00Z","f":{"L":"40"}}},
             {"name":"Old two","state":{"fmt":"pallet-lab/1","type":"box","saved":"2026-10-02T00:00:00Z","f":{"L":"48"}}}]
        raw=json.dumps(old)
        ctx,pg,errs=await newpage(b,ls=raw)
        lst=await lib(pg); kept=await pg.evaluate("[localStorage.getItem('palletlab.designs'), localStorage.getItem('palletlab.designs.backup')]")
        check([x["name"] for x in lst]==["Old one","Old two"] and [x["state"] for x in lst]==[o["state"] for o in old], f"L1 moved in, in order: {[x['name'] for x in lst]}")
        check(kept[0] is None and kept[1]==raw, f"L2 old list kept as a backup: {kept}")
        await pg.reload(); await pg.wait_for_timeout(200); await idle(pg)
        check(len(await lib(pg))==2, "L3 not moved in twice")
        await pg.evaluate("window.confirm=()=>true"); await pg.select_option("#libSel",index=1); await idle(pg); await pg.click("#btnLibDel"); await idle(pg)
        await pg.reload(); await pg.wait_for_timeout(200); await idle(pg)
        check([x["name"] for x in await lib(pg)]==["Old two"], "L4 a deleted design does not come back")
        # an older version of the tool saved again into its list: moved in at the next start, replacing by name
        await pg.evaluate("v=>localStorage.setItem('palletlab.designs',v)", json.dumps([{"name":"Old two","state":dict(old[1]["state"],f={"L":"50"})},{"name":"Old three","state":old[0]["state"]}]))
        await pg.reload(); await pg.wait_for_timeout(200); await idle(pg)
        lst=await lib(pg)
        check([x["name"] for x in lst]==["Old two","Old three"] and lst[0]["state"]["f"]["L"]=="50", f"L5 later saves of an older version move in: {[x['name'] for x in lst]}")
        check(not errs, f"L errors {errs}")
        await ctx.close()

        await b.close()
    print("\nFLOWS:", "PASS" if not fails else f"{len(fails)} FAIL")
asyncio.run(main())
sys.exit(1 if fails else 0)
