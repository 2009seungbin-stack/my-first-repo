// Raw DevTools protocol driver for old Electron apps (Tilesetter Lite).
//   node cdp.mjs shot <file.png>
//   node cdp.mjs eval "<js expression>"
//   node cdp.mjs click <x> <y> [double]
//   node cdp.mjs key <key> [ctrl]
//   node cdp.mjs type "<text>"
//   node cdp.mjs files "<css selector>" <file1> [file2 ...]   (DOM.setFileInputFiles)
import {writeFileSync} from 'node:fs';
const PORT=process.env.CDP_PORT||9555;
const list=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const target=list.find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const [cmd,...a]=process.argv.slice(2);
if(cmd==='shot'){const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(a[0],Buffer.from(r.result.data,'base64'));console.log('saved',a[0]);}
else if(cmd==='eval'){const r=await send('Runtime.evaluate',{expression:a[0],returnByValue:true,awaitPromise:true});console.log(JSON.stringify(r.result?.result?.value??r.result??r).slice(0,8000));}
else if(cmd==='click'){const x=+a[0],y=+a[1],n=a[2]==='double'?2:1;
 for(let c=1;c<=n;c++){await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:c});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:c});}console.log('clicked',x,y);}
else if(cmd==='rclick'){const x=+a[0],y=+a[1];await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'right',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'right',clickCount:1});console.log('rclicked');}
else if(cmd==='shiftclick'||cmd==='ctrlclick'){const x=+a[0],y=+a[1],m=cmd==='shiftclick'?8:2;await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1,modifiers:m});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1,modifiers:m});console.log(cmd);}
else if(cmd==='wheel'){const x=+a[0],y=+a[1],dy=+a[2];await send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:dy,modifiers:a[3]==='ctrl'?2:0});console.log('wheel');}
else if(cmd==='drag'){const [x1,y1,x2,y2]=a.map(Number);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:x1,y:y1,button:'left',clickCount:1});
 for(let i=1;i<=10;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x1+(x2-x1)*i/10,y:y1+(y2-y1)*i/10,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x2,y:y2,button:'left',clickCount:1});console.log('dragged');}
else if(cmd==='key'){const mod=a[1]==='ctrl'?2:0;await send('Input.dispatchKeyEvent',{type:'keyDown',key:a[0],code:a[2]||a[0],modifiers:mod,windowsVirtualKeyCode:a[0].length===1?a[0].toUpperCase().charCodeAt(0):undefined});await send('Input.dispatchKeyEvent',{type:'keyUp',key:a[0],modifiers:mod});console.log('key',a[0]);}
else if(cmd==='type'){await send('Input.insertText',{text:a[0]});console.log('typed');}
else if(cmd==='files'){const doc=await send('DOM.getDocument',{});const q=await send('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector:a[0]});
 const r=await send('DOM.setFileInputFiles',{nodeId:q.result.nodeId,files:a.slice(1)});console.log(JSON.stringify(r).slice(0,300));}
ws.close();process.exit(0);
