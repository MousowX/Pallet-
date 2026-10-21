# Browser checks (Chrome via Playwright) of the shared design list (Supabase), against a stand-in for
# Supabase that runs here: the parts of its Auth and REST API the tool uses, with the rules of
# supabase/schema.sql (members only, names unique, a replaced design keeps its id). The tool is opened
# from a second local address, so every call crosses origins like the real site does.
# Checks: hidden when not set up; sign-in (wrong password, not a member, offline); save, update, load,
# delete, design files, import, search; a second computer sees changes; the session survives a reload
# and is renewed when it runs out; a session that can't be renewed signs out; offline at start and on
# a save; sign out; copying this browser's list; the password is never stored.
# Usage: python3 cloud.py [path/to/pallet-lab.html]     (needs Playwright, like flows.py)
import asyncio, json, os, re, sys, tempfile, threading, time, secrets, pathlib
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
FILE=os.path.abspath(next((a for a in sys.argv[1:] if a.lower().endswith((".html",".htm"))), os.path.join(HERE,"..","..","pallet-lab.html")))
OLD=os.path.join(HERE,"..","fixtures","old-saves")
KEY="test-publishable-key"
fails=[]
def check(cond,msg):
    if not cond: fails.append(msg); print("FAIL:",msg)

# ---------- the stand-in for Supabase ----------
class Mock:
    def __init__(s):
        s.users={}          # email -> {password, member}
        s.access={}         # token -> (email, expires)
        s.refresh={}        # token -> email
        s.rows=[]; s.next_id=1; s.ttl=3600; s.calls=[]
        s.lock=threading.Lock()
    def session(s,email):
        a=secrets.token_hex(12); r=secrets.token_hex(12); exp=int(time.time())+s.ttl
        s.access[a]=(email,exp); s.refresh[r]=email
        return {"access_token":a,"refresh_token":r,"expires_in":s.ttl,"expires_at":exp,"token_type":"bearer","user":{"email":email}}
    def upsert(s,email,name,state,source):
        if not isinstance(name,str) or not name.strip(): raise ValueError("23514")
        f=state.get("f") if isinstance(state.get("f"),dict) else {}
        vals=dict(name=name,type=(state.get("type") or "stringer"),client=f.get("client") or "",part_no=f.get("partNo") or "",
                  saved=state.get("saved") or "",source=source or "",state=state,updated_by=email,updated_at=time.time())
        for r in s.rows:
            if r["name"]==name: r.update(vals); return r["id"],True
        row=dict(id=s.next_id,**vals); s.next_id+=1; s.rows.append(row); return row["id"],False
M=Mock()

class API(BaseHTTPRequestHandler):
    def log_message(s,*a): pass
    def cors(s):
        s.send_header("Access-Control-Allow-Origin","*")
        s.send_header("Access-Control-Allow-Headers","apikey, authorization, content-type, prefer, x-client-info")
        s.send_header("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS")
    def send(s,code,body=None):
        data=b"" if body is None else json.dumps(body).encode()
        s.send_response(code); s.cors()
        if body is not None: s.send_header("Content-Type","application/json")
        s.send_header("Content-Length",str(len(data))); s.end_headers(); s.wfile.write(data)
    def do_OPTIONS(s):
        s.send_response(204); s.cors(); s.send_header("Content-Length","0"); s.end_headers()
    def body(s):
        n=int(s.headers.get("Content-Length") or 0)
        try: return json.loads(s.rfile.read(n) or b"{}")
        except Exception: return {}
    def who(s):
        a=(s.headers.get("Authorization") or "").replace("Bearer ","")
        t=M.access.get(a)
        if not t or t[1]<time.time(): return None
        return t[0]
    def route(s,method):
        u=urlparse(s.path); q=parse_qs(u.query); p=u.path
        M.calls.append((method,p))
        if s.headers.get("apikey")!=KEY: return s.send(401,{"message":"Invalid API key"})
        with M.lock:
            if p=="/auth/v1/token" and method=="POST":
                b=s.body(); g=q.get("grant_type",[""])[0]
                if g=="password":
                    usr=M.users.get(b.get("email",""))
                    if not usr or usr["password"]!=b.get("password"): return s.send(400,{"error":"invalid_grant","error_description":"Invalid login credentials"})
                    return s.send(200,M.session(b["email"]))
                if g=="refresh_token":
                    email=M.refresh.pop(b.get("refresh_token",""),None)
                    if not email: return s.send(400,{"error":"invalid_grant","error_description":"Invalid Refresh Token"})
                    return s.send(200,M.session(email))
                return s.send(400,{"error":"unsupported_grant_type"})
            if p=="/auth/v1/logout" and method=="POST":
                email=s.who()
                if email:
                    for k in [k for k,v in M.refresh.items() if v==email]: del M.refresh[k]
                return s.send(204)
            if not p.startswith("/rest/v1/"): return s.send(404,{"message":"not found"})
            email=s.who()
            if not email: return s.send(401,{"code":"PGRST301","message":"JWT expired"})
            member=M.users.get(email,{}).get("member",False)
            if p=="/rest/v1/rpc/is_member": return s.send(200,member)
            if p=="/rest/v1/rpc/save_design" and method=="POST":
                b=s.body()
                if not member: return s.send(403,{"code":"42501","message":"new row violates row-level security policy for table \"designs\""})
                try: i,upd=M.upsert(email,b.get("p_name"),b.get("p_state") or {},b.get("p_source"))
                except ValueError: return s.send(400,{"code":"23514","message":"check constraint"})
                return s.send(200,[{"id":i,"updated":upd}])
            if p=="/rest/v1/rpc/save_designs" and method=="POST":
                b=s.body(); items=b.get("p_items") or []
                if not member: return s.send(403,{"code":"42501","message":"new row violates row-level security policy for table \"designs\""})
                if any(not isinstance(it.get("name"),str) or not it["name"].strip() for it in items): return s.send(400,{"code":"23514","message":"check constraint"})
                a=u_=0
                for it in items:
                    _,upd=M.upsert(email,it["name"],it.get("state") or {},it.get("source"))
                    if upd: u_+=1
                    else: a+=1
                return s.send(200,[{"added":a,"updated":u_}])
            if p=="/rest/v1/designs":
                rows=M.rows if member else []
                idq=q.get("id",[""])[0]
                if idq.startswith("eq."): rows=[r for r in rows if str(r["id"])==idq[3:]]
                if method=="DELETE":
                    ids={r["id"] for r in rows}; M.rows=[r for r in M.rows if r["id"] not in ids]; return s.send(204)
                if method=="GET":
                    rows=sorted(rows,key=lambda r:r["id"])
                    off=int(q.get("offset",["0"])[0]); lim=int(q.get("limit",["1000"])[0])
                    cols=q.get("select",["*"])[0].split(",")
                    return s.send(200,[{c:r[c] for c in cols} for r in rows[off:off+lim]])
            return s.send(404,{"message":"not found"})
    def do_GET(s): s.route("GET")
    def do_POST(s): s.route("POST")
    def do_DELETE(s): s.route("DELETE")

def serve(handler,directory=None):
    h=handler if directory is None else (lambda *a,**k: SimpleHTTPRequestHandler(*a,directory=directory,**k))
    srv=ThreadingHTTPServer(("127.0.0.1",0),h); threading.Thread(target=srv.serve_forever,daemon=True).start(); return srv

class Quiet(SimpleHTTPRequestHandler):
    def log_message(s,*a): pass

async def main():
    api=serve(API); API_URL=f"http://127.0.0.1:{api.server_address[1]}"
    site=tempfile.mkdtemp(prefix="pallet-lab-cloud-")
    html=open(FILE,encoding="utf-8").read()
    # the tool's shared-list setting, pointed at the stand-in (and, for check 0, left empty)
    cfg=re.compile(r'const CLOUD={ url:"[^"]*", key:"[^"]*" };')
    check(len(cfg.findall(html))==1, "the tool has its shared-list setting once")
    open(os.path.join(site,"index.html"),"w",encoding="utf-8").write(cfg.sub(f'const CLOUD={{ url:"{API_URL}", key:"{KEY}" }};',html))
    open(os.path.join(site,"blank.html"),"w",encoding="utf-8").write(cfg.sub('const CLOUD={ url:"", key:"" };',html))
    web=serve(lambda *a,**k: Quiet(*a,directory=site,**k)); URL=f"http://127.0.0.1:{web.server_address[1]}/"
    M.users={"ana@test.local":{"password":"pw-ana-1","member":True},"beto@test.local":{"password":"pw-beto-2","member":True},
             "ext@test.local":{"password":"pw-ext-3","member":False}}
    async with async_playwright() as p:
        b=await p.chromium.launch()
        async def page(ctx):
            pg=await ctx.new_page(); errs=[]
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: m.type=="error" and "Failed to load resource" not in m.text and errs.append(m.text))
            await pg.goto(URL); await pg.wait_for_timeout(200); await pg.evaluate("libIdle()")
            await pg.evaluate("window.confirm=()=>true; 0")
            return pg,errs
        idle=lambda pg: pg.evaluate("libIdle()")
        toast=lambda pg: pg.evaluate("document.getElementById('toast').textContent")
        opts=lambda pg: pg.evaluate("[...document.getElementById('libSel').options].map(o=>({v:o.value,t:o.text,tip:o.title}))")
        shown=lambda pg,i: pg.evaluate(f"document.getElementById('{i}').offsetParent!==null")
        async def sign_in(pg,email,pw):
            await pg.fill("#cloudEmail",email); await pg.fill("#cloudPass",pw); await pg.click("#btnCloudIn"); await idle(pg)
        names=lambda: [r["name"] for r in sorted(M.rows,key=lambda r:r["id"])]

        # ---------- 0. not set up: nothing shows ----------
        ctx=await b.new_context(); pg=await ctx.new_page(); await pg.goto(URL+"blank.html"); await pg.wait_for_timeout(200)
        check(not await shown(pg,"cloudBox"), "0 without a Supabase project the shared-list controls are hidden")
        await ctx.close()

        # ---------- 1. signing in ----------
        ctx=await b.new_context(); pg,errs=await page(ctx)
        check(await shown(pg,"cloudSignedOut") and not await shown(pg,"cloudSignedIn"), "1 signed out: the sign-in form shows")
        check((await opts(pg))[0]["t"]=="— saved in this browser —", "1 signed out: this browser's list")
        await sign_in(pg,"ana@test.local","wrong"); t=await toast(pg)
        check(t=="Could not sign in: wrong email or password" and await pg.evaluate("designDB.kind")!="cloud", f"1a wrong password: {t!r}")
        check(await pg.evaluate("document.getElementById('cloudPass').value")=="", "1b the password box is emptied after a try")
        await sign_in(pg,"ext@test.local","pw-ext-3"); t=await toast(pg)
        check("not a member" in t and await pg.evaluate("designDB.kind")!="cloud" and await pg.evaluate("localStorage.getItem('palletlab.cloud.session')") is None,
              f"1c an account that is not a member stays out: {t!r}")
        await ctx.route(API_URL+"/**", lambda r: r.abort())
        await sign_in(pg,"ana@test.local","pw-ana-1"); t=await toast(pg)
        check("Could not reach the shared list" in t and await pg.evaluate("designDB.kind")!="cloud", f"1d offline: {t!r}")
        await ctx.unroute(API_URL+"/**")
        await sign_in(pg,"ana@test.local","pw-ana-1"); t=await toast(pg)
        check(t=="Signed in — this is the shared list" and await pg.evaluate("designDB.kind")=="cloud", f"1e sign in: {t!r}")
        check(await shown(pg,"cloudSignedIn") and await pg.evaluate("document.getElementById('cloudUser').textContent")=="ana@test.local", "1f shows who is signed in")
        check((await opts(pg))[0]["t"]=="— shared list —", "1g the list is the shared list")
        ls=await pg.evaluate("JSON.stringify(localStorage)")
        check("pw-ana-1" not in ls, "1h the password is never stored")
        st=await pg.evaluate("collectState()"); check(not any(k.startswith("cloud") for k in st["f"]), "1i the sign-in boxes are not part of a design")

        # ---------- 2. working on the shared list ----------
        await pg.evaluate("window.prompt=()=> 'Shared A'"); await pg.fill("#partNo","SH-1"); await pg.fill("#L","44")
        await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        check(t=="Saved Shared A" and names()==["Shared A"] and M.rows[0]["updated_by"]=="ana@test.local" and M.rows[0]["part_no"]=="SH-1", f"2a save: {t!r} {names()}")
        await pg.fill("#L","50"); await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        check(t=="Updated Shared A" and len(M.rows)==1 and M.rows[0]["state"]["f"]["L"]=="50", f"2b update in place: {t!r}")
        await pg.click("#tBox"); await pg.evaluate("window.prompt=()=> 'Shared B'"); await pg.click("#btnLibSave"); await idle(pg)
        await pg.click("#tStr"); await pg.fill("#L","36")
        o=await opts(pg); await pg.select_option("#libSel",o[1]["v"]); await idle(pg)
        check(await pg.evaluate("document.getElementById('L').value")=="50" and await toast(pg)=="Loaded Shared A", "2c load from the shared list")
        check(o[1]["tip"]=="last saved by ana@test.local", f"2d who saved it: {o[1]['tip']!r}")
        await pg.select_option("#libSel",o[2]["v"]); await idle(pg); await pg.click("#btnLibDel"); await idle(pg); t=await toast(pg)
        check(t=="Deleted Shared B" and names()==["Shared A"], f"2e delete: {t!r} {names()}")
        async with pg.expect_download() as dl: await pg.click("#btnFileSave")
        d=await dl.value; await idle(pg)
        check(d.suggested_filename[:-len(".pltlab.json")] in names(), f"2f a saved file goes into the shared list: {names()}")
        fx=sorted(n for n in os.listdir(OLD) if n.endswith(".pltlab.json"))
        await pg.set_input_files("#importIn",[os.path.join(OLD,n) for n in fx])
        await pg.wait_for_function("document.getElementById('toast').textContent.startsWith('Imported')",timeout=10000); await idle(pg)
        check(await toast(pg)==f"Imported {len(fx)} designs" and len(M.rows)==2+len(fx), f"2g import into the shared list: {await toast(pg)!r}")
        await pg.fill("#libFind","oct 16 box"); o=await opts(pg)
        check([x["t"].split(" · ")[0] for x in o[1:]]==["4-oct-16-notch-from-ends_box","5-oct-16-space-between-notches_box","6-oct-16-version-stamp_box"], f"2h search the shared list: {o}")
        await pg.fill("#libFind","")
        n0=len(M.rows); await pg.evaluate("window.prompt=()=> '   '"); await pg.click("#btnLibSave"); await idle(pg)
        check(len(M.rows)==n0, "2i a blank name saves nothing")

        # ---------- 3. a second computer ----------
        ctx2=await b.new_context(); pg2,errs2=await page(ctx2)
        await sign_in(pg2,"beto@test.local","pw-beto-2")
        o2=await opts(pg2); check(len(o2)==1+len(M.rows), f"3a the other computer sees the same list: {len(o2)-1} of {len(M.rows)}")
        await pg2.evaluate("window.prompt=()=> 'From Beto'"); await pg2.click("#btnLibSave"); await idle(pg2)
        await pg.evaluate("window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(200); await idle(pg)
        check(any(x["t"].startswith("From Beto") for x in await opts(pg)), "3b coming back to the page shows the other computer's design")
        await pg.evaluate("window.prompt=()=> 'From Beto'; window.confirm=()=>false")
        await pg.click("#btnLibSave"); await idle(pg)
        check([r for r in M.rows if r["name"]=="From Beto"][0]["updated_by"]=="beto@test.local", "3c a design someone else saved is not replaced without asking")
        await pg.evaluate("window.confirm=()=>true"); await pg.click("#btnLibSave"); await idle(pg)
        check([r for r in M.rows if r["name"]=="From Beto"][0]["updated_by"]=="ana@test.local", "3d … and is replaced when the answer is yes")
        await ctx2.close()

        # ---------- 4. the session ----------
        await pg.reload(); await pg.wait_for_timeout(200); await idle(pg)
        check(await pg.evaluate("designDB.kind")=="cloud" and await shown(pg,"cloudSignedIn"), "4a still signed in after a reload")
        M.ttl=1; s=json.loads(await pg.evaluate("localStorage.getItem('palletlab.cloud.session')"))
        M.access={k:(v[0],0) for k,v in M.access.items()}              # every access token runs out now
        await pg.fill("#L","52"); await pg.evaluate("window.prompt=()=> 'Shared A'"); await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        s2=json.loads(await pg.evaluate("localStorage.getItem('palletlab.cloud.session')"))
        check(t=="Updated Shared A" and s2["refresh_token"]!=s["refresh_token"], f"4b a run-out session is renewed on the way: {t!r}")
        M.ttl=3600; M.access={}; M.refresh={}                          # the server forgets every session
        await pg.fill("#L","53"); await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        check(await pg.evaluate("designDB.kind")!="cloud" and "signed out" in t.lower() and await shown(pg,"cloudSignedOut"), f"4c a session that can't be renewed signs out: {t!r}")
        check((await opts(pg))[0]["t"]=="— saved in this browser —", "4d back to this browser's list")

        # ---------- 5. offline ----------
        await sign_in(pg,"ana@test.local","pw-ana-1")
        await ctx.route(API_URL+"/**", lambda r: r.abort())
        n0=len(M.rows); await pg.evaluate("window.prompt=()=> 'Offline one'"); await pg.click("#btnLibSave"); await idle(pg); t=await toast(pg)
        check("could not reach the shared list" in t and len(M.rows)==n0 and await pg.evaluate("designDB.kind")=="cloud", f"5a a save offline says so and stays on the shared list: {t!r}")
        await pg.reload(); await pg.wait_for_timeout(300); await idle(pg); t=await toast(pg)
        check(await pg.evaluate("designDB.kind")!="cloud" and "showing this browser's list" in t, f"5b offline at the start: this browser's list: {t!r}")
        check(await pg.evaluate("localStorage.getItem('palletlab.cloud.session')") is not None, "5c … and the session is kept for later")
        await ctx.unroute(API_URL+"/**")
        await pg.reload(); await pg.wait_for_timeout(300); await idle(pg)
        check(await pg.evaluate("designDB.kind")=="cloud", "5d back online: the shared list again")

        # ---------- 6. copy this browser's list, sign out ----------
        await pg.click("#btnCloudOut"); await idle(pg); t=await toast(pg)
        check(t=="Signed out — this is this browser's list" and await pg.evaluate("localStorage.getItem('palletlab.cloud.session')") is None, f"6a sign out: {t!r}")
        await pg.evaluate("window.prompt=()=> 'Only here'"); await pg.click("#btnLibSave"); await idle(pg)
        check("Only here" not in names(), "6b signed out, a save stays in this browser")
        await sign_in(pg,"ana@test.local","pw-ana-1")
        await pg.evaluate("window.confirm=()=>false; 0"); await pg.click("#btnCloudCopy"); await idle(pg)
        check("Only here" not in names(), "6c copying asks first, and a no copies nothing")
        await pg.evaluate("window.confirm=()=>true; 0"); await pg.click("#btnCloudCopy"); await idle(pg); t=await toast(pg)
        check("Only here" in names() and t.startswith("Copied"), f"6d copy this browser's list to the shared list: {t!r}")
        check(not errs, f"page errors {errs}")
        await ctx.close(); await b.close()
    api.shutdown(); web.shutdown()
    print("\nSHARED LIST:", "PASS" if not fails else f"{len(fails)} FAIL")
asyncio.run(main())
sys.exit(1 if fails else 0)
