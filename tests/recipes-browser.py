"""Actual browser recipe outputs, independently reopened with Pillow/zipfile.
Run with --in-memory where local HTTP is blocked. This mode does not test HTTP/CSP.
"""
from browser_harness import *
import zipfile
from PIL import ImageDraw
ENGINE=os.environ.get('BROWSER_ENGINE','chromium')  # chromium | firefox | webkit; results for non-Chromium engines get a suffix

def png(w,h,color=(0,0,0,0),rects=()):
    im=Image.new('RGBA',(w,h),color);draw=ImageDraw.Draw(im)
    for box,fill in rects:draw.rectangle(box,fill=fill)
    b=io.BytesIO();im.save(b,'PNG');return b.getvalue()
def open_tool(context,path,files):
    page=mount(context,'/en/'+path+'/')
    page.locator('#fileInput').set_input_files([{'name':name,'mimeType':'image/png','buffer':buffer} for name,buffer in files]);idle(page)
    return page
def options(page,values):
    if not page.locator('#panel').is_visible():click(page,'intent-settings')
    if page.locator('#kitAdvanced').count():page.locator('#kitAdvanced').evaluate('(e)=>e.open=true')
    for key,value in values.items():
        el=page.locator('#kit-'+key)
        el.evaluate('(e)=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true}')
        tag=el.evaluate('(e)=>e.tagName');typ=el.get_attribute('type')
        if typ=='checkbox':el.set_checked(value)
        elif tag=='SELECT':el.select_option(value=str(value))
        else:el.fill(str(value));el.dispatch_event('change')
    page.wait_for_timeout(40)
def output(page,name):
    click(page,'intent-run');assert page.locator('[data-action="intent-download"]').count(),page.locator('#message').inner_text()
    return download(page,name)
def archive(path):
    z=zipfile.ZipFile(path);assert z.testzip() is None;return z

def rgba_image(z,name):return Image.open(io.BytesIO(z.read(name))).convert('RGBA')

with sync_playwright() as pw:
    browser=(pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']) if ENGINE=='chromium' else getattr(pw,ENGINE).launch(headless=True))
    ctx=browser.new_context(locale='en-US',viewport={'width':1440,'height':1000},accept_downloads=True)
    fixture=png(80,60,'white',[((20,10,59,49),(255,0,0,255))])
    home=mount(ctx,'/en/')
    ok('home lists the game-asset tools by name',home.locator('.tool-card[data-tool="sprite-slicer"]').count()==1 and home.locator('.tool-card').count()>=35)
    home.close();home=mount(ctx,'/en/image/editor/')
    home.screenshot(path=str(OUT/'expanded-home-desktop.png'),full_page=False)
    home.keyboard.press('Control+k');ok('command palette opens and focuses search',home.locator('#toolsDialog').is_visible() and home.locator('#toolSearch').evaluate('(e)=>e===document.activeElement'))
    home.locator('#toolSearch').fill('sprite');ok('search finds sprite niche tools',home.locator('#toolResults .kit-tool-row').count()>=3)
    click(home,'kit-star:sprite-slicer');home.locator('#toolSearch').fill('');ok('favorites are inside Explore',home.locator('#toolResults h3').first.inner_text()=='Favorites')
    click(home,'kit-close');ok('catalog is hidden when dismissed',not home.locator('#toolsDialog').is_visible());home.close()

    p=open_tool(ctx,'game-asset-pixelizer',[('subject.png',fixture)])
    options(p,{'cleanup':True,'n':32,'colors':8,'padding':2})
    path=output(p,'refined32.png');im=Image.open(path).convert('RGBA')
    ok('refiner outputs a true 32x32 PNG with transparent padding',im.size==(32,32) and im.getpixel((0,0))[3]==0)
    ok('refiner palette is bounded on opaque pixels',len({c for c in im.getdata() if c[3]})<=8)
    old=path.read_bytes();lang(p,'ja');path2=download(p,'refined32-ja.png');ok('language switch preserves exact result bytes',old==path2.read_bytes());assert_no_korean(p,'Japanese recipe UI contains no Korean')
    p.screenshot(path=str(OUT/'refiner-desktop-ja.png'),full_page=False)
    options(p,{'n':47,'pack':True});z=archive(output(p,'game-pack.zip'))
    ok('game pack ZIP preserves folder paths and all requested dimensions',all(rgba_image(z,f'{n}x{n}/asset.png').size==(n,n) for n in [16,32,64,128,47]))
    p.close()

    sheet=png(36,20,rects=[((1,2,5,8),'red'),((20,4,27,15),'green')])
    p=open_tool(ctx,'sprite-slicer',[('sheet.png',sheet)]);click(p,'intent-run')
    ok('sprite detection yields two editable candidates before download',p.locator('[data-action^="kit-frame:"]').count()==2 and not p.locator('[data-action="intent-download"]').count())
    lang(p,'ko');ok('language switch preserves candidate order',p.locator('[data-action^="kit-frame:"]').count()==2)
    click(p,'kit-frame:1');options(p,{'rect-w':6})
    z=archive(output(p,'sliced.zip'));meta=json.loads(z.read('metadata.json'))
    ok('edited frame crop controls actual exported pixels',rgba_image(z,'frames/frame-002.png').size==(6,12) and meta['frames'][1]['w']==6)
    p.screenshot(path=str(OUT/'sprite-slicer-desktop.png'),full_page=False);p.close()

    frames=[('tall.png',png(20,20,rects=[((2,2,5,9),'red')])),('wide.png',png(12,12,rects=[((3,2,8,4),'blue')]))]
    p=open_tool(ctx,'normalize-sprite-frames',frames);z=archive(output(p,'normalized.zip'))
    a,b=[rgba_image(z,f'frames/frame-{i:03}.png') for i in [1,2]]
    ok('frame normalization uses common canvas and identical bottom anchor',a.size==b.size==(6,8) and a.getbbox()[3]==b.getbbox()[3]==8);p.close()
    p=open_tool(ctx,'sprite-sheet-maker',frames);options(p,{'columns':2,'padding':2});p.locator('.kit-inputs').evaluate('(e)=>e.closest("details").open=true');click(p,'kit-input:1:-1')
    z=archive(output(p,'sprite-sheet.zip'));im=rgba_image(z,'sprite-sheet.png');meta=json.loads(z.read('metadata.json'))
    ok('sprite sheet dimensions and JSON coordinates agree',im.size==(20,12) and meta['width']==20 and meta['frames'][1]['x']==12)
    ok('touch-accessible reorder changes actual frame order',im.getpixel((2,9))[:3]==(0,0,255));p.close()

    p=open_tool(ctx,'palette-swap',[('red.png',png(2,2,'red'))]);options(p,{'from':'#ff0000','to':'#00ff00','tolerance':0})
    im=Image.open(output(p,'palette-swap.png')).convert('RGBA');ok('palette swap changes actual PNG RGB bytes',set(im.getdata())=={(0,255,0,255)});p.close()
    p=open_tool(ctx,'marketplace-image-pack',[('product.png',fixture)])
    z=archive(output(p,'marketplace.zip'))
    ok('marketplace ZIP has correct Etsy/Shopify paths and real sizes',Image.open(io.BytesIO(z.read('Etsy/001-product.jpg'))).size==(3000,2000) and Image.open(io.BytesIO(z.read('Shopify/001-product.jpg'))).size==(2048,2048))
    p.screenshot(path=str(OUT/'marketplace-desktop.png'),full_page=False);p.close()
    p=open_tool(ctx,'etsy-print-size-generator',[('art.png',fixture)]);options(p,{'longSide':160});z=archive(output(p,'print-ratios.zip'))
    for name,ratio in [('2x3',2/3),('3x4',3/4),('4x5',4/5),('11x14',11/14),('A-series',1/2**.5)]:
        im=Image.open(io.BytesIO(z.read(name+'/001-art.jpg')));ok('print ratio '+name+' uses measured pixel dimensions',im.size==(round(160*ratio),160))
    p.close()
    logo=png(9,9,'white',[((1,1,7,7),'black'),((3,3,5,5),'white')]);p=open_tool(ctx,'remove-white-background-from-logo',[('logo.png',logo)])
    im=Image.open(output(p,'logo-transparent.png')).convert('RGBA');ok('connected background removal retains enclosed white logo detail',im.getpixel((0,0))[3]==0 and im.getpixel((4,4))==(255,255,255,255));p.close()
    p=open_tool(ctx,'bitmap-font-maker',[('font.png',png(16,8,'white'))]);options(p,{'cellW':8,'cellH':8,'chars':'Aあ','baseline':6});z=archive(output(p,'bitmap-font.zip'))
    meta=json.loads(z.read('font.json'));fnt=z.read('font.fnt').decode()
    ok('BMFont and JSON contain exact Unicode glyph coordinates','char id=12354 x=8 y=0 width=8 height=8' in fnt and meta['glyphs'][1]['codepoint']==12354 and rgba_image(z,'font.png').size==(16,8));p.close()
    masks=[(f'{n}.png',png(2,2,(n,n,n,255))) for n in [10,80,220]];p=open_tool(ctx,'texture-mask-packer',masks)
    options(p,{'channel-0':'input2','channel-1':'input0','channel-2':'input1','channel-3':'zero'})
    im=Image.open(output(p,'packed-mask.png')).convert('RGBA');ok('mask PNG preserves channel bytes even under zero alpha',set(im.getdata())=={(220,10,80,0)});p.close()
    atlas=png(2,1,rects=[((0,0,0,0),'red'),((1,0,1,0),'lime')]);p=open_tool(ctx,'atlas-padding',[('atlas.png',atlas)])
    options(p,{'cellW':1,'cellH':1,'padding':1});z=archive(output(p,'atlas.zip'));im=rgba_image(z,'padded-atlas.png')
    ok('extruded atlas has isolated edge pixels and correct dimensions',im.size==(6,3) and im.getpixel((2,1))==(255,0,0,255) and im.getpixel((3,1))==(0,255,0,255));p.close()
    p=open_tool(ctx,'normal-map-generator',[('flat.png',png(2,2,(50,50,50,255)))])
    im=Image.open(output(p,'normal.png')).convert('RGBA');ok('flat height map generates an independently decoded flat normal',set(im.getdata())=={(128,128,255,255)});p.close()
    p=open_tool(ctx,'tile-grid-slicer',[('tiles.png',png(4,2,'red'))]);options(p,{'cellW':2,'cellH':2});z=archive(output(p,'tiles.zip'))
    ok('grid tile output count and dimensions',len(json.loads(z.read('metadata.json'))['frames'])==2 and rgba_image(z,'frames/frame-002.png').size==(2,2));p.close()
    p=open_tool(ctx,'split-scanned-images',[('spread.png',png(9,4,'white'))]);options(p,{'order':'RL'});z=archive(output(p,'spread.zip'))
    ok('scan splitter respects divider rounding and right-first order',rgba_image(z,'frames/frame-001.png').size==(4,4) and rgba_image(z,'frames/frame-002.png').size==(5,4));p.close()
    p=open_tool(ctx,'auto-crop-image-margins',[('scan.png',png(10,10,'white',[((3,2,6,7),'black')]))]);options(p,{'padding':0})
    im=Image.open(output(p,'margin.png'));ok('auto margin crop exports the measured content rectangle',im.size==(4,6));p.close()
    p=open_tool(ctx,'favicon-generator',[('logo.png',fixture)]);z=archive(output(p,'favicon.zip'))
    ico=Image.open(io.BytesIO(z.read('favicon.ico')));ok('Pillow independently decodes all real ICO sizes',ico.ico.sizes()=={(16,16),(32,32),(48,48)})
    manifest=json.loads(z.read('site.webmanifest'));ok('manifest icons have matching files and actual dimensions',all(rgba_image(z,v['src']).size==tuple(map(int,v['sizes'].split('x'))) for v in manifest['icons']))
    p.close()

    for locale in ['ko','en','ja']:
        mobile=browser.new_context(locale={'ko':'ko-KR','en':'en-US','ja':'ja-JP'}[locale],viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
        p=mount(mobile,'/'+locale+'/game-asset-pixelizer/');upload(p,buffer=fixture);options(p,{'n':32});path=output(p,f'mobile-{locale}.png')
        ok(locale+' recipe mobile has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        ok(locale+' recipe output is a real PNG',Image.open(path).size==(32,32))
        p.screenshot(path=str(OUT/f'refiner-mobile-{locale}.png'),full_page=False)
        with p.expect_download() as event:click(p,'kit-share')
        card=OUT/f'share-{locale}.png';event.value.save_as(card);ok(locale+' share card has exact 1200x630 dimensions',Image.open(card).size==(1200,630))
        mobile.close()
    ok('no uncaught recipe browser exceptions',not errors)
    ctx.close();browser.close()
report={'mode':'in-memory' if args.in_memory else 'http','checks':checks,'count':len(checks),'page_errors':errors,'decoders':['Pillow','Python zipfile','JSON'], 'http_csp_tested':not args.in_memory}
(OUT/('recipes-browser-results'+('' if ENGINE=='chromium' else '-'+ENGINE)+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PASS RECIPE TOTAL',len(checks))
