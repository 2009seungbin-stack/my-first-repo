import urllib.request, os, sys, glob, json
sys.stdout.reconfigure(encoding='utf-8')
D = r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\ninepatch\aosp'
os.makedirs(D, exist_ok=True)
BASE = 'https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/res/res/'
FILES = ['drawable-mdpi/btn_default_normal.9.png', 'drawable-xhdpi/textfield_default_mtrl_alpha.9.png', 'drawable-mdpi/toast_frame.9.png',
         'drawable-xxhdpi/btn_default_mtrl_shape.9.png', 'drawable-hdpi/popup_background_mtrl_mult.9.png', 'drawable-xhdpi/btn_default_normal_holo_light.9.png',
         'drawable-mdpi/spinner_default_holo_light.9.png', 'drawable-xxhdpi/abc_btn_default_mtrl_shape.9.png']
got = []
for f in FILES:
    n = f.replace('/', '_')
    try:
        data = urllib.request.urlopen(BASE + f, timeout=30).read()
        open(os.path.join(D, n), 'wb').write(data); got.append((n, BASE + f)); print('ok', n, len(data))
    except Exception as e:
        print('fail', f, e)
json.dump(got, open(os.path.join(D, '_sources.json'), 'w'), indent=1)
for p in [os.path.expandvars(r'%LOCALAPPDATA%\Android'), r'C:\Android', os.path.expandvars(r'%ProgramFiles%\Android'), os.environ.get('ANDROID_HOME', ''), os.environ.get('ANDROID_SDK_ROOT', '')]:
    if p and os.path.exists(p): print('android dir', p)
print('draw9patch found:', glob.glob(os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\tools\**\draw9patch*'), recursive=True))
