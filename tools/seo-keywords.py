"""Keyword demand evidence for docs/SEO-KEYWORDS.md: autocomplete suggestions per language.

Sources (public suggestion endpoints, the same ones the search boxes use; no volumes, no ranking):
  google  suggestqueries.google.com (client=firefox, hl=<lang>, gl=<country>)
  bing    api.bing.com/osjson.aspx (market=<lang>-<COUNTRY>)
  naver   ac.search.naver.com (Korean only)

Usage:  python tools/seo-keywords.py OUT.json [--delay 1.2]
A suggestion list is evidence that people type the phrase (evidence type "AC"). It says nothing
about how many do. Seeds are the phrases a page family could target; see docs/SEO-KEYWORDS.md.
Requests are spaced by --delay seconds and cached in OUT.json, so a rerun only asks what is new.
"""
import json, sys, time, urllib.parse, urllib.request

SEEDS = {
 'en': ['sprite editor','sprite studio','sprite editor online','sprite sheet editor','sprite animation editor','sprite animator online',
        'pixel art editor','pixel art editor online','sprite sheet maker','sprite sheet cutter','sprite sheet slicer','sprite sheet splitter',
        'sprite sheet to','gif to sprite sheet','sprite sheet to gif','png to sprite sheet','video to sprite sheet','sprite sheet frame size',
        'texture packer','texture packer alternative','free texture packer','texture atlas generator','sprite atlas generator','sprite atlas packer',
        'texture atlas padding','texture bleeding','tilemap editor','tilemap editor online','tileset editor','tileset generator','autotile generator',
        'autotile','47 tile tileset','blob tileset','dual grid tileset','wang tiles','tileset collision',
        'normal map generator','normal map generator 2d','normal map sprite','normal map from height map','height map to normal map',
        'normal map opengl directx','normal map green channel','2d lighting normal map','specular map 2d',
        'bitmap font generator','pixel font generator','9 slice','nine patch generator',
        'aseprite to','aseprite alternative','aseprite online','open aseprite file','aseprite file to png','aseprite to gif','import sprite sheet into aseprite',
        'godot sprite sheet','godot 4 spritesheet','godot animatedsprite2d','godot 4 tileset','godot 4 terrain','godot 4 autotile','godot pixel art',
        'godot 4 pixel art blurry','godot normal map','godot 2d lighting','godot tileset collision','godot 3 autotile','godot 4 tileset from image',
        'unity sprite sheet','unity pixel art','unity pixel art blurry','unity rule tile','unity 2d normal map','unity 2d lights normal map','unity tilemap gaps',
        'phaser atlas','phaser spritesheet','phaser texture atlas','phaser tilemap','phaser aseprite','pixijs spritesheet','pixi spritesheet json',
        'defold atlas','love2d sprite sheet','love2d quads','gamemaker sprite strip','gamemaker autotile','spine atlas','libgdx texture packer',
        'tiled terrain','tiled wang set','ldtk auto layer','rpg maker autotile','rpg maker autotile to godot',
        'sprite fusion','tilesetter','laigter','sprite illuminator','normalmap online','ezgif sprite','free tex packer','piskel alternative',
        'sparrow xml','fnf spritesheet','spritesheet and xml generator','sprite pivot','hitbox editor','collision polygon generator',
        'pixel art jitter','sprite jitter','sprite sheet misaligned','pixel art upscaler','seamless texture'],
 'ko': ['스프라이트 시트','스프라이트 에디터','스프라이트 편집','스프라이트 편집기','스프라이트 애니메이션','스프라이트 만들기','스프라이트 자르기',
        '도트 에디터','도트 그리기','도트 애니메이션','도트 프로그램','픽셀아트 에디터','픽셀아트','도트 툴',
        '텍스처 패커','텍스쳐 패커','텍스처 아틀라스','스프라이트 아틀라스','아틀라스 만들기',
        '타일셋','타일맵','타일맵 에디터','오토타일','오토 타일','타일셋 만들기','47 타일',
        '노멀맵','노말맵','노멀맵 생성','노말맵 만들기','노말맵 추출','하이트맵 노말맵','노말맵 opengl directx',
        '비트맵 폰트','비트맵 폰트 만들기','9슬라이스','나인패치','나인 슬라이스',
        'aseprite','에이스프라이트','aseprite 무료','aseprite 대체',
        '고도 엔진 스프라이트','고도 엔진 타일맵','고도 오토타일','godot 스프라이트 시트','godot 타일맵','godot 오토타일','godot 도트',
        '유니티 스프라이트','유니티 스프라이트 시트','유니티 도트','유니티 룰타일','유니티 타일맵','유니티 노말맵 2d','유니티 2d 라이트',
        'phaser 스프라이트','쯔꾸르 오토타일','알만툴 오토타일','rpg 만들기 타일',
        'gif 스프라이트','gif 스프라이트 시트','스프라이트 시트 gif','움짤 스프라이트',
        '게임 에셋 툴','게임 리소스 툴','스프라이트 피벗','히트박스','텍스처 번짐','픽셀아트 흐림','도트 흐릿'],
 'ja': ['スプライトシート','スプライト エディタ','スプライトエディター','スプライト アニメーション','スプライトシート 作成','スプライトシート 分割',
        'ドット絵 エディタ','ドット絵 ツール','ドット絵 アニメーション','ドット絵 ソフト','ピクセルアート エディタ',
        'テクスチャパッカー','テクスチャアトラス','スプライトアトラス','アトラス 作成',
        'タイルセット','タイルマップ','タイルマップ エディタ','オートタイル','オートタイル 作り方','タイルセット 作成',
        'ノーマルマップ','ノーマルマップ 作成','法線マップ','法線マップ 作成','ハイトマップ ノーマルマップ','ノーマルマップ directx opengl',
        'ビットマップフォント','ビットマップフォント 作成','9スライス','ナインパッチ',
        'aseprite','aseprite 無料','aseprite 代わり',
        'godot スプライト','godot スプライトシート','godot タイルマップ','godot オートタイル','godot ドット絵','godot ノーマルマップ',
        'unity スプライト','unity スプライトシート','unity ドット絵','unity ドット絵 ぼやける','unity ルールタイル','unity タイルマップ','unity 2d ライト',
        'phaser スプライト','ツクール オートタイル','ツクール タイルセット','ウディタ オートタイル',
        'gif スプライトシート','スプライトシート gif','ゲーム素材 ツール','スプライト ピボット','当たり判定 エディタ','テクスチャ にじみ','ドット絵 ぼやける']
}
MARKET = {'en': ('en', 'us', 'en-US'), 'ko': ('ko', 'kr', 'ko-KR'), 'ja': ('ja', 'jp', 'ja-JP')}
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'en'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', 'replace')

def google(q, lang):
    hl, gl, _ = MARKET[lang]
    return json.loads(get('https://suggestqueries.google.com/complete/search?client=firefox&hl=%s&gl=%s&q=%s' % (hl, gl, urllib.parse.quote(q))))[1]

def bing(q, lang):
    return json.loads(get('https://api.bing.com/osjson.aspx?market=%s&query=%s' % (MARKET[lang][2], urllib.parse.quote(q))))[1]

def naver(q, lang):
    d = json.loads(get('https://ac.search.naver.com/nx/ac?st=100&r_format=json&q_enc=UTF-8&r_enc=UTF-8&q=%s' % urllib.parse.quote(q)))
    return [x[0] for x in (d.get('items') or [[]])[0]]

SOURCES = {'google': google, 'bing': bing, 'naver': naver}

def main():
    out = sys.argv[1]
    delay = float(sys.argv[sys.argv.index('--delay') + 1]) if '--delay' in sys.argv else 1.2
    try:
        data = json.load(open(out, encoding='utf-8'))
    except Exception:
        data = {}
    if '--extra' in sys.argv:  # {"en": [...], "ko": [...], "ja": [...]}: more seeds for a second round
        for lang, more in json.load(open(sys.argv[sys.argv.index('--extra') + 1], encoding='utf-8')).items():
            SEEDS[lang] = SEEDS[lang] + [q for q in more if q not in SEEDS[lang]]
    for lang, seeds in SEEDS.items():
        for src in (['google', 'bing', 'naver'] if lang == 'ko' else ['google', 'bing']):
            for q in seeds:
                key = '%s|%s|%s' % (lang, src, q)
                if key in data and data[key].get('ok'):
                    continue
                try:
                    data[key] = {'ok': True, 'at': time.strftime('%Y-%m-%d'), 'suggestions': SOURCES[src](q, lang)}
                except Exception as e:
                    data[key] = {'ok': False, 'error': str(e)[:200]}
                json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
                time.sleep(delay)
    ok = sum(1 for v in data.values() if v.get('ok'))
    print('%d queries, %d answered' % (len(data), ok))

if __name__ == '__main__':
    main()
