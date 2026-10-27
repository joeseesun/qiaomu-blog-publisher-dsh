import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {JSDOM} from 'jsdom';
import {boundedHttpRequest} from '../src/network.js';
const win=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/'}).window;
for(const key of ['document','window','Element','HTMLElement','Node','MutationObserver','getComputedStyle'])globalThis[key]=key==='window'?win:typeof win[key]==='function'&&key==='getComputedStyle'?win[key].bind(win):win[key];
const {configureNativeHost,TFile,disposeSurfaces}=await import('../src/harness-ui.ts');
const {createWorkspace}=await import('../src/native-workspace.ts');
const {default:Publisher}=await import('../src/original/main.ts');
const {PublishModal}=await import('../src/original/publish-modal.ts');

test('original publisher uploads local image/audio/video and remote image, rewrites repeated embeds, keeps category/status',async()=>{
 const calls=[];const server=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);calls.push({path:req.url,auth:req.headers.authorization,type:req.headers['content-type'],body});res.setHeader('content-type','application/json');if(req.url.startsWith('/api/uploads'))res.end(JSON.stringify({success:true,url:'/media/'+calls.filter(c=>c.path.startsWith('/api/uploads')).length+'.bin'}));else if(req.url.startsWith('/api/posts'))res.end(JSON.stringify({success:true,slug:'fixture',id:1}));else if(req.url.startsWith('/api/admin'))res.end(JSON.stringify({categories:[{name:'技术',slug:'tech',post_count:2}]}));else{res.setHeader('content-type','image/png');res.end(Buffer.from([137,80,78,71]));}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const address=`http://127.0.0.1:${server.address().port}`;
 const api={request:request=>boundedHttpRequest(request),asset:async()=>({base64:Buffer.from('fixture media').toString('base64'),mime:'application/octet-stream'})};const disconnect=configureNativeHost(api);
 const workspace=createWorkspace(api,{files:[{path:'folder/note.md',text:''},{path:'folder/image.png'},{path:'folder/audio.mp3'},{path:'folder/movie.mp4'}]},{state:{data:{}},save:async()=>{}});
 const publisher=new Publisher(workspace.app,async()=>{},()=>{});publisher.settings={apiUrl:address,apiToken:'fixture-only'};
 const source='---\r\ntitle: "测试标题"\r\n---\r\n# Head\n![one](image.png)\n![two](image.png)\n![[audio.mp3]]\n![[movie.mp4]]\n![remote](https://fixture.invalid/photo.png)';
 // Remote fixture host is mapped inside the transport; no public network or account is used.
 api.request=request=>boundedHttpRequest({...request,url:request.url.replace('https://fixture.invalid',address)});
 try{
  assert.equal(publisher.extractTitle(source,new TFile({path:'folder/note.md'})),'测试标题');
  const progress=[];const result=await publisher.doPublish(workspace.files.get('folder/note.md'),source,{title:'测试标题',status:'draft',category:'技术'},m=>progress.push(m));
  assert.equal(result.success,true);assert.equal(result.failedCount,0);assert.equal(calls.filter(c=>c.path.startsWith('/api/uploads')).length,4);
  const post=JSON.parse(calls.find(c=>c.path.startsWith('/api/posts')).body.toString());assert.equal(post.category,'技术');assert.equal(post.status,'draft');assert(!post.content.startsWith('---'));assert(!post.content.includes('[[audio'));assert(!post.content.includes('(image.png)'));assert.equal((post.content.match(/\/media\/1.bin/g)||[]).length,2);
  assert(calls.filter(c=>c.path.startsWith('/api/')).every(c=>c.auth==='Bearer fixture-only'));assert.equal(calls.find(c=>c.path==='/photo.png').auth,undefined);
  assert(calls.filter(c=>c.path.startsWith('/api/uploads')).some(c=>c.body.includes(Buffer.from('audio/mpeg'))));assert(calls.filter(c=>c.path.startsWith('/api/uploads')).some(c=>c.body.includes(Buffer.from('video/mp4'))));assert(progress.at(-1).includes('创建文章'));
  const modal=new PublishModal(workspace.app,publisher,'测试标题',async()=>result);modal.open();await new Promise(done=>setTimeout(done,30));assert.equal(modal.contentEl.querySelector('input[aria-label="文章标题"]').value,'测试标题');assert.equal(modal.contentEl.querySelector('select[aria-label="发布状态"]').value,'draft');assert([...modal.contentEl.querySelectorAll('option')].some(o=>o.textContent==='技术 (2)'));modal.close();
 }finally{workspace.dispose();disconnect();disposeSurfaces();await new Promise(done=>server.close(done));}
});

test('title fallback, mime support and API failures retain original behavior',async()=>{
 const publisher=new Publisher({},async()=>{},()=>{});const file=new TFile({path:'folder/Filename.md'});assert.equal(publisher.extractTitle('# Heading\nBody',file),'Heading');assert.equal(publisher.extractTitle('Body',file),'Filename');
 for(const ext of ['mp3','wav','ogg','m4a','flac','aac','mp4','webm','mov','avi','mkv','png','jpeg','gif','svg','bmp','ico'])assert.notEqual(publisher.getMimeType(ext),'application/octet-stream');
 const disconnect=configureNativeHost({request:async()=>({status:401,headers:{},base64:Buffer.from('{}').toString('base64')})});publisher.settings={apiUrl:'https://example.invalid',apiToken:'fixture'};try{await assert.rejects(publisher.createPost('T','C'),/HTTP 401/);}finally{disconnect();}
});
