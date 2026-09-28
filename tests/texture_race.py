"""Force worker completion across asset selection instead of depending on machine speed."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

GATE = r'''(() => {
 const NativeWorker=window.Worker;
 const gate=window.textureWorkerGate={hold:new Set(),held:[],released:0};
 gate.release=op=>{
  const hits=gate.held.filter(x=>x.op===op);gate.held=gate.held.filter(x=>x.op!==op);
  gate.hold.delete(op);
  for(const x of hits){x.worker.onmessage(x.event);gate.released++;}
 };
 window.Worker=class extends NativeWorker {
  constructor(url,options){
   super(url,options);this.texture=String(url).includes('/texture-worker.js');this.ops=new Map();
   if(this.texture)this.addEventListener('message',event=>{
    const op=this.ops.get(event.data.id);this.ops.delete(event.data.id);
    if(gate.hold.has(op)){event.stopImmediatePropagation();gate.held.push({op,worker:this,event});}
   });
  }
  postMessage(message,...rest){if(this.texture)this.ops.set(message.id,message.op);return super.postMessage(message,...rest);}
 };
})();'''

def run_texture_races(browser, base, fixtures):
    context=browser.new_context(viewport={'width':1440,'height':900})
    context.add_init_script(GATE)
    p=context.new_page()
    try:
        p.goto(base+'/en/game/studio/?ws=texture')
        p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"')
        p.set_input_files('input[type=file][multiple]',[str(fixtures/'bricks_Color.png'),str(fixtures/'torch_sheet.png')])
        p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===2')
        p.evaluate('async()=>{const S=window.nerulioStudio;await S.showAsset(S.doc.assets.find(a=>a.name==="bricks_Color.png").id);}');
        p.wait_for_function('()=>window.nerulioTexture.S.gen&&!window.nerulioTexture.S.busy')
        # Keep an old generation response in flight, then delay the new picture's load.
        p.evaluate('''async()=>{
          textureWorkerGate.hold.add('generate');
          const S=window.nerulioStudio,T=window.nerulioTexture;
          const St=await import('/src/studio/workspaces/texture/state.js');
          const {edit}=await import('/src/studio/core/history.js');
          S.history.execute(edit('Race fixture',d=>St.withTexState(d,s=>St.setParams(s,T.S.assetId,{bevel:{depth:T.entry().params.bevel.depth+1}},{w:T.S.pic.w,h:T.S.pic.h}))));
        }''')
        p.wait_for_function('()=>textureWorkerGate.held.some(x=>x.op==="generate")')
        p.evaluate('''()=>{
          textureWorkerGate.hold.add('put');
          const S=window.nerulioStudio,T=window.nerulioTexture;
          window.textureSelection=T.select(S.doc.assets.find(a=>a.name==='torch_sheet.png').id);
        }''')
        p.wait_for_function('()=>textureWorkerGate.held.some(x=>x.op==="put")')
        p.evaluate('()=>textureWorkerGate.release("generate")')
        p.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        state=p.evaluate('()=>{const T=window.nerulioTexture;return {hasGeneration:!!T.S.gen,detect:T.S.detect};}')
        assert state=={'hasGeneration':False,'detect':None}, f'Old generation landed during new asset load: {state}'
        p.evaluate('()=>textureWorkerGate.release("put")')
        p.evaluate('()=>window.textureSelection')
        p.wait_for_function('()=>{const T=window.nerulioTexture;return T.S.gen&&!T.S.busy&&T.S.pic.assetId===T.S.assetId;}')
        assert p.locator('[data-tex="conv-warn"]').count()==0
        return 2
    finally:
        context.close()

if __name__=='__main__':
    with sync_playwright() as pw:
        browser=pw.chromium.launch(args=['--ignore-gpu-blocklist'])
        try:
            count=run_texture_races(browser,os.environ.get('TEST_URL','http://127.0.0.1:4173'),Path(__file__).parent/'fixtures'/'texture')
            print(f'{count} deterministic texture race checks passed')
        finally:
            browser.close()
