"""End-to-end local avatar gate with Pillow as an independent output reader."""
import json
import os
import time
from pathlib import Path
from PIL import Image,ImageSequence
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'/'avatar'
OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('AVATAR_URL','http://127.0.0.1:4173')
PATH='/en/game/pixel-avatar-maker/'
ORIGINAL=ROOT/'docs/avatar-prototype/output/avatar-1-16.png'
CC0=ROOT/'tests/fixtures/kenney/pixel-platformer-characters.png'

def saved(page,action,path):
    start=time.perf_counter()
    with page.expect_download(timeout=30000) as download:
        page.locator(f'[data-action="{action}"]').click()
    obj=download.value
    obj.save_as(path)
    return round((time.perf_counter()-start)*1000)

result={}
with sync_playwright() as p:
    for engine in ['chromium','firefox']:
        browser=getattr(p,engine).launch()
        page=browser.new_page(accept_downloads=True,viewport={'width':1440,'height':900})
        errors=[];posts=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda req:posts.append(req.url) if req.method not in ('GET','HEAD') else None)
        page.goto(BASE+PATH)
        page.locator('#avatarCanvas').wait_for()
        assert page.locator('#taskTitle').inner_text()=='Pixel Avatar Maker'
        page.screenshot(path=OUT/f'{engine}-desktop.png',full_page=True)
        times={}
        with Image.open(ORIGINAL) as original:
            for size in [32,48,64]:
                page.locator('#avatarSize').select_option(str(size))
                path=OUT/f'{engine}-{size}.png'
                times[f'png{size}']=saved(page,'png',path)
                with Image.open(path) as png:
                    assert png.mode=='RGBA' and png.size==(size,size)
                    assert png.getpixel((0,0))[3]==0
                    for y in range(size):
                        for x in range(size):
                            assert png.getpixel((x,y))==original.getpixel((x//(size//16),y//(size//16)))
        page.locator('#avatarSize').select_option('4096')
        times['png4096']=saved(page,'png',OUT/f'{engine}-4096.png')
        with Image.open(OUT/f'{engine}-4096.png') as png,Image.open(ORIGINAL) as original:
            assert png.size==(4096,4096) and png.mode=='RGBA'
            for x,y in [(0,0),(4095,4095),(5*256+8,7*256+8),(10*256+100,14*256+100)]:
                assert png.getpixel((x,y))==original.getpixel((x//256,y//256))
        page.locator('#avatarSize').select_option('256')
        times['gif256']=saved(page,'gif',OUT/f'{engine}-blink.gif')
        with Image.open(OUT/f'{engine}-blink.gif') as gif:
            assert gif.size==(256,256) and gif.n_frames==8 and gif.info.get('loop')==0
            frames=[]
            for frame in ImageSequence.Iterator(gif):
                assert frame.info.get('duration')==130 and frame.disposal_method==2
                frames.append(frame.convert('RGBA').tobytes())
            assert frames[0]==frames[1]==frames[2]==frames[5]==frames[6]==frames[7]
            assert frames[3]==frames[4]!=frames[0]
        page.locator('#avatarMotion').select_option('breathe')
        page.locator('#avatarDelay').select_option('200')
        assert 'motion=breathe' in page.url and 'delay=200' in page.url
        times['breatheGif256']=saved(page,'gif',OUT/f'{engine}-breathe.gif')
        with Image.open(OUT/f'{engine}-breathe.gif') as gif:
            assert gif.n_frames==8 and gif.info.get('loop')==0
            assert all(frame.info.get('duration')==200 for frame in ImageSequence.Iterator(gif))
        assert (OUT/f'{engine}-blink.gif').read_bytes()!=(OUT/f'{engine}-breathe.gif').read_bytes()
        page.locator('[data-action="card"]').focus()
        start=time.perf_counter()
        with page.expect_download(timeout=30000) as download:page.keyboard.press('Enter')
        download.value.save_as(OUT/f'{engine}-card.png')
        times['cardKeyboard']=round((time.perf_counter()-start)*1000)
        with Image.open(OUT/f'{engine}-card.png') as card:assert card.size==(1200,630) and card.mode=='RGBA'
        page.locator('[data-tab="face"]').click()
        page.locator('[data-category="face"][data-choice="angular"]').click()
        assert 'face=angular' in page.url
        page.locator('[data-action="undo"]').click()
        assert 'face=round' in page.url
        page.locator('[data-action="redo"]').click()
        assert 'face=angular' in page.url
        page.locator('[data-action="lock"]').click()
        page.locator('[data-action="random"]').click()
        assert 'face=angular' in page.url
        page.locator('[data-tab="hair"]').click()
        page.locator('[data-category="hair"][data-choice="bob"]').click()
        page.locator('[data-tab="hair"]').focus()
        page.keyboard.press('Enter')
        assert page.locator('[data-tab="hair"]').get_attribute('aria-pressed')=='true'
        page.locator('[data-category="hair"][data-choice="swept"]').focus()
        page.keyboard.press('Space')
        assert 'hair=swept' in page.url
        page.keyboard.press('Control+z')
        assert 'hair=bob' in page.url
        replay=page.url
        other=browser.new_page(viewport={'width':390,'height':844})
        other.on('request',lambda req:posts.append(req.url) if req.method not in ('GET','HEAD') else None)
        other.goto(replay)
        assert other.locator('[data-category="face"][data-choice="angular"]').get_attribute('aria-pressed')=='true'
        assert other.evaluate('document.documentElement.scrollWidth-innerWidth')==0
        other.screenshot(path=OUT/f'{engine}-mobile.png',full_page=True)
        other.locator('#fileInput').set_input_files(str(CC0))
        other.locator('.avatar-background span').wait_for()
        assert 'pixel-platformer-characters' in other.locator('.avatar-background span').inner_text()
        saved(other,'png',OUT/f'{engine}-local-bg.png')
        with Image.open(OUT/f'{engine}-local-bg.png') as image:assert image.size==(256,256)
        other.reload()
        assert other.locator('.avatar-background span').count()==0
        assert other.locator('[data-category="face"][data-choice="angular"]').get_attribute('aria-pressed')=='true'
        for language,title in [('ko','픽셀 아바타 만들기'),('ja','ピクセルアバター作成')]:
            other.goto(BASE+f'/{language}/game/pixel-avatar-maker/')
            assert other.locator('#taskTitle').inner_text()==title
            assert other.evaluate('document.documentElement.scrollWidth-innerWidth')==0
        reduced=browser.new_page(reduced_motion='reduce')
        reduced.goto(BASE+PATH)
        assert reduced.locator('[data-action="toggle-motion"]').is_disabled()
        assert not errors,errors
        assert not posts,posts
        result[engine]={'timesMs':times,'mobileOverflow':0,'pngSizes':[32,48,64,4096],'gifFrames':8,'localBackground':True,'urlRoundTrip':True}
        browser.close()
(OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
