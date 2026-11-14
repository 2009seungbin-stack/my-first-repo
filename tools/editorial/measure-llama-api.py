"""Reproduce a small C++ declaration check of pinned llama.cpp 0.9/1.0 headers.

Only syntax is checked. No library linking, model loading, inference or speed test.
The original probes/script are CC0-1.0; upstream headers retain their own license
and are downloaded from pinned official commits rather than included in a ZIP.
Run from a configured C++ developer shell, or pass --system-include as needed.
"""
from pathlib import Path
import argparse,hashlib,json,locale,os,platform,shutil,subprocess,sys,urllib.request
from datetime import datetime,timezone

HERE=Path(__file__).resolve().parent
CASES={
 'control-current':('void check() { (void)&llama_model_default_params; (void)&llama_batch_init; }',True,True),
 'legacy-model-load':('void check() { (void)&llama_load_model_from_file; }',True,False),
 'current-model-load':('void check() { (void)&llama_model_load_from_file; }',True,True),
 'legacy-context-create':('void check() { (void)&llama_new_context_with_model; }',True,False),
 'current-context-create':('void check() { (void)&llama_init_from_model; }',True,True),
 'legacy-model-free':('void check() { (void)&llama_free_model; }',True,False),
 'current-model-free':('void check() { (void)&llama_model_free; }',True,True),
 'legacy-token-count':('void check() { (void)&llama_n_vocab; }',True,False),
 'current-token-count':('void check() { (void)&llama_vocab_n_tokens; }',True,True),
 'legacy-warmup':('void check() { (void)&llama_set_warmup; }',True,False),
 'legacy-defrag-field':('void check(llama_context_params &p) { p.defrag_thold = 0.0f; }',True,False),
}
def sha256(data):return hashlib.sha256(data).hexdigest()
def decode(data):
 try:return data.decode('utf-8')
 except UnicodeDecodeError:return data.decode(locale.getencoding(),errors='replace')
def protocol_source():
 files=[Path(__file__).resolve(),HERE/'llama-api-source-pins.json'];result={'files':[{'name':p.name,'sha256':sha256(p.read_bytes())} for p in files],'commit':None,'sourceModifiedAfterCommit':None}
 try:
  root=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],cwd=HERE,stderr=subprocess.DEVNULL).decode().strip());commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip();modified=False
  for file in files:
   committed=subprocess.check_output(['git','show',f'{commit}:{file.relative_to(root).as_posix()}'],cwd=root,stderr=subprocess.DEVNULL).decode('utf-8').replace('\r\n','\n')
   modified|=file.read_text(encoding='utf-8').replace('\r\n','\n')!=committed
  result.update(commit=commit,sourceModifiedAfterCommit=modified)
 except (OSError,ValueError,subprocess.CalledProcessError):pass
 return result
class OfficialSourceRedirects(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if not newurl.startswith('https://raw.githubusercontent.com/ggml-org/llama.cpp/'):raise RuntimeError('Unexpected source redirect')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=Path('test-results/editorial-llama-api'));parser.add_argument('--compiler',default=shutil.which('cl') or shutil.which('clang++') or shutil.which('g++'));parser.add_argument('--compiler-label');parser.add_argument('--system-include',action='append',type=Path,default=[]);args=parser.parse_args()
 if not args.compiler:parser.error('Pass a configured C++ compiler with --compiler')
 compiler=Path(shutil.which(args.compiler) or args.compiler).resolve()
 if not compiler.is_file():parser.error('Compiler does not exist')
 out=args.output.resolve()
 if out.exists() and any(out.iterdir()):parser.error('Use a new empty output directory to preserve existing evidence')
 out.mkdir(parents=True,exist_ok=True);pins=json.loads((HERE/'llama-api-source-pins.json').read_text(encoding='utf-8'));upstream=out/'_upstream';opener=urllib.request.build_opener(OfficialSourceRedirects());sources=[]
 assert pins['repository']=='ggml-org/llama.cpp' and len(pins['files'])==14
 for item in pins['files']:
  relative=Path(item['path']);assert not relative.is_absolute() and '..' not in relative.parts
  revision=pins['revisions'][item['version']];assert len(revision)==40 and all(c in '0123456789abcdef' for c in revision)
  url=f'https://raw.githubusercontent.com/ggml-org/llama.cpp/{revision}/{relative.as_posix()}'
  with opener.open(urllib.request.Request(url,headers={'User-Agent':'Nerulio-reproducible-header-check/1'}),timeout=30) as response:data=response.read(2_000_001)
  assert len(data)==item['bytes'] and hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==item['gitBlobSHA1'],('Upstream source changed',url)
  file=upstream/item['version']/relative;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(data);sources.append({**item,'commit':revision,'url':url,'sha256':sha256(data)})
 msvc=compiler.name.lower() in ['cl','cl.exe'];rows=[]
 for version in pins['revisions']:
  for name,(body,old_expected,new_expected) in CASES.items():
   file=out/(name+'.cpp');file.write_text('#include "llama.h"\n'+body+'\n',encoding='utf-8');include=[upstream/version/'include',upstream/version/'ggml/include',*args.system_include]
   flags=['/nologo','/TP','/std:c++17','/Zs','/diagnostics:caret','/utf-8',*[f'/I{p}' for p in include]] if msvc else ['-std=c++17','-fsyntax-only',*[f'-I{p}' for p in include]]
   result=subprocess.run([str(compiler),*flags,str(file)],cwd=out,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
   diagnostic=decode(result.stdout).replace(str(out),'EVIDENCE_ROOT').replace(out.as_posix(),'EVIDENCE_ROOT');log=out/f'{version}-{name}.txt';log.write_text(diagnostic,encoding='utf-8');expected=old_expected if version=='v0.9.0' else new_expected
   rows.append({'version':version,'case':name,'exitCode':result.returncode,'expectedDeclarationAccepted':expected,'declarationAccepted':result.returncode==0,'log':log.name,'logSHA256':sha256(log.read_bytes()),'source':file.name,'sourceSHA256':sha256(file.read_bytes())});print(version,name,result.returncode,flush=True)
 report={'recordedAtUTC':datetime.now(timezone.utc).isoformat(),'scope':'Only the recorded C++ declaration probes and two pinned header versions. No DLL link, ABI compatibility, model loading, inference, GPU or speed test.','protocol':protocol_source(),'environment':{'os':platform.platform(),'python':platform.python_version(),'compiler':compiler.name,'compilerLabel':args.compiler_label,'compilerBinarySHA256':sha256(compiler.read_bytes()),'compilerMode':'MSVC C++17 /Zs' if msvc else 'C++17 -fsyntax-only','systemIncludeLabels':[p.name for p in args.system_include]},'upstream':sources,'cases':rows}
 (out/'measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 mismatches=[r for r in rows if r['declarationAccepted']!=r['expectedDeclarationAccepted']]
 assert not mismatches,('Unexpected declaration result; inspect logs, including the positive controls',mismatches)
 print(f'All {len(rows)} declaration probes match expectations; positive controls passed in both versions.')
if __name__=='__main__':main()
