import {test} from 'node:test';
import assert from 'node:assert/strict';
import {persistNoteDraft} from '../src/native-save.ts';

test('edits during a delayed write stay dirty and retain the new disk etag',async()=>{
 const file={path:'article.md',etag:'old',text:'first'};
 let resolve,request;const api={noteWrite:r=>{request=r;return new Promise(done=>resolve=done);}};
 const draft={file,path:file.path,text:'first'};
 const saving=persistNoteDraft(api,file,file.path,()=>({...draft}));
 draft.text='newer';file.text='newer';
 resolve({path:file.path,etag:'next',text:'first'});
 const result=await saving;
 assert.equal(request.text,'first');assert.equal(result.changed,true);
 assert.equal(file.text,'newer');assert.equal(file.etag,'next');
 let next;await persistNoteDraft({noteWrite:async r=>{next=r;return {...r,etag:'final'};}},file,file.path,()=>({...draft}));
 assert.equal(next.etag,'next');assert.equal(next.text,'newer');
});

test('changing target during a pending save never marks the new target saved',async()=>{
 const file={path:'a.md',etag:'a',text:'A'};const draft={file,path:'a.md',text:'A'};
 let done;const pending=persistNoteDraft({noteWrite:()=>new Promise(resolve=>done=resolve)},file,'a.md',()=>({...draft}));
 draft.path='b.md';done({path:'a.md',etag:'b',text:'A'});
 assert.equal((await pending).changed,true);
});
