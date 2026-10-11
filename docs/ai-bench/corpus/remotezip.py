"""Read single members of a large remote ZIP/TAR over HTTP Range requests (no full download)."""
import io,zipfile,requests,tarfile
UA={'User-Agent':'nerulio-ai-bench/1.0 (https://nerulio.com; corpus builder)'}
class RangeFile(io.RawIOBase):
    def __init__(self,url,session=None):
        self.s=session or requests.Session();self.s.headers.update(UA)
        r=self.s.head(url,allow_redirects=True,timeout=60);r.raise_for_status()
        self.url=r.url;self.size=int(r.headers['Content-Length']);self.pos=0;self.cache={}
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.pos
    def seek(self,off,whence=0):
        self.pos={0:off,1:self.pos+off,2:self.size+off}[whence];return self.pos
    def read(self,n=-1):
        if n is None or n<0:n=self.size-self.pos
        if n==0 or self.pos>=self.size:return b''
        end=min(self.size,self.pos+n)-1
        for attempt in range(5):
            try:
                r=self.s.get(self.url,headers={'Range':f'bytes={self.pos}-{end}'},timeout=120)
                if r.status_code==206:break
            except requests.RequestException:pass
        else:raise IOError('range request failed')
        data=r.content;self.pos+=len(data);return data
    def readinto(self,b):
        d=self.read(len(b));b[:len(d)]=d;return len(d)
def open_zip(url):return zipfile.ZipFile(io.BufferedReader(RangeFile(url),buffer_size=1<<20))
