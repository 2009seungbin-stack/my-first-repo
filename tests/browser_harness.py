"""FileForge intent + localization integration tests.

Normal mode uses http://127.0.0.1:4173 (run npm run dev first).
--in-memory mounts the same modules as Blob URLs when policy blocks HTTP.
Only module URLs, location/history and Storage are adapted in that mode.
It does NOT validate deployed HTTP/CSP, actual storage persistence, or CDN engines.
Requires Python Playwright, Pillow and `python -m playwright install chromium`.
HTTP subpath checks additionally need a server on port 4174 with BASE_PATH=/my-first-repo.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import argparse, re, json, io, hashlib, shutil, subprocess, os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--in-memory',action='store_true');args=p.parse_args()
checks=[];errors=[]
MODULES=['brand','search-terms','example-data','tool-registry','tool-messages','messages','i18n','intents','analytics','core','primitives','platform-presets','worker','audio-worker','recipe-worker','image','pdf','media','ui','examples','content','seo','site-content','recipes','presets','quota','entitlement','toolkit','experience','app']
SOURCES={n:(ROOT/'src'/f'{n}.js').read_text(encoding='utf-8') for n in MODULES}
def ok(name,condition=True):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def idle(page):
 page.locator('#workspace[aria-busy="false"]').wait_for(timeout=30000)
def click(page,action,scope=''):
 page.locator(f'{scope} [data-action="{action}"]:visible'.strip()).first.click()
 page.wait_for_timeout(50);idle(page)
def lang(page,value):
 page.locator('#languageSelect').select_option(value);page.wait_for_timeout(80);idle(page)
def mount(context,path='/',saved=None,blocked=False,base='/'):
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 if not args.in_memory:
  page.add_init_script('try { localStorage.removeItem("fileforge.language.v1"); } catch {}' if not saved else 'try { localStorage.setItem("fileforge.language.v1",'+json.dumps(saved)+'); } catch {}')
  page.goto(('http://127.0.0.1:4174' if base!="/" else os.environ.get('TEST_URL','http://127.0.0.1:4173'))+path,wait_until='networkidle')
  return page
 local_path=path.split('?')[0].removeprefix(base).strip('/')
 # Built HTML verifies the actual localized static document, not a test template.
 html_path=ROOT/'dist'/local_path/'index.html'
 if not html_path.exists():html_path=ROOT/'index.html'
 html=html_path.read_text(encoding='utf-8');html=re.sub(r'<script[^>]*>.*?</script>','',html);html=re.sub(r'<link[^>]*>','',html);html=re.sub(r'<base[^>]*>','',html)
 page.set_content(html);page.add_style_tag(content=''.join((ROOT/f).read_text(encoding='utf-8') for f in ['styles.css','experience.css','content.css','src/toolkit.css']))
 page.evaluate('''async ({sources,path,saved,blocked,base})=>{
  window.__testURL='https://fileforge.test'+path;
  const stack=[window.__testURL];let position=0;
  window.__history={
   pushState:(s,t,u)=>{stack.splice(position+1);stack.push(new URL(u,window.__testURL).href);window.__testURL=stack[++position];},
   replaceState:(s,t,u)=>{window.__testURL=new URL(u,window.__testURL).href;stack[position]=window.__testURL;},
   back:()=>{if(position>0){window.__testURL=stack[--position];window.dispatchEvent(new PopStateEvent('popstate'));}}
  };
  const data=new Map(saved?[['fileforge.language.v1',saved]]:[]);
  window.__testStorage={getItem:k=>{if(blocked)throw Error('denied');return data.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('denied');data.set(k,v);},removeItem:k=>{if(blocked)throw Error('denied');data.delete(k);}};
  const urls={};
  for(const[name,original]of Object.entries(sources)){
   let src=original;
   if(name==='app')src=src.replace("new URL('../',import.meta.url)","new URL("+JSON.stringify('https://fileforge.test'+base)+")");
   if(['app','experience','toolkit'].includes(name))src=src.replaceAll('location.pathname','new URL(window.__testURL).pathname').replaceAll('location.search','new URL(window.__testURL).search').replaceAll('location.href','window.__testURL').replaceAll('history.pushState','window.__history.pushState').replaceAll('history.replaceState','window.__history.replaceState').replaceAll('window.localStorage','window.__testStorage');
   for(const[dep,url]of Object.entries(urls)){
    src=src.replaceAll("new URL('./"+dep+".js',import.meta.url)",JSON.stringify(url));src=src.replaceAll("'./"+dep+".js'",JSON.stringify(url));
   }
   urls[name]=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
  }
  window.__testModules=urls;await import(urls.app);
 }''',{'sources':SOURCES,'path':path,'saved':saved,'blocked':blocked,'base':base})
 page.wait_for_function("document.querySelector('#navigation').children.length>0")
 return page
def visible_words(page):
 # Native language names are intentionally always written in their own language.
 return page.locator('body').inner_text().replace('한국어','').replace('日本語','')
def assert_no_korean(page,name):ok(name,not re.search('[가-힣]',visible_words(page)))
def image_bytes(w=80,h=60):
 im=Image.new('RGBA',(w,h),'white')
 for x in range(w//4,w*3//4):
  for y in range(h//4,h*3//4):im.putpixel((x,y),(255,80,80,255))
 stream=io.BytesIO();im.save(stream,format='PNG');return stream.getvalue()
def upload(page,name='fixture.png',buffer=None,mime='image/png'):
 page.locator('#fileInput').set_input_files({'name':name,'mimeType':mime,'buffer':buffer or image_bytes()});page.wait_for_timeout(60);idle(page)
def download(page,name):
 with page.expect_download() as event:click(page,'intent-download')
 path=OUT/name;event.value.save_as(path);return path
