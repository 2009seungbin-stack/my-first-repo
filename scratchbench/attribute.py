import json,subprocess,sys
from pathlib import Path
for name in sys.argv[1:]:
    f=str(Path(name))
    print('==',f,Path(f).stat().st_size)
    for st in ['v','a']:
        pk=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams',st,'-show_entries','packet=size','-of','json',f]))['packets']
        print(' ',st,'packets',len(pk),'bytes',sum(int(p['size']) for p in pk))
    print(' ',json.dumps(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,codec_type,bit_rate','-show_entries','format=duration,size,bit_rate','-of','json',f]))))
