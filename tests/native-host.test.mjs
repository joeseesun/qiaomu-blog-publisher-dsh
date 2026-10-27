import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WorkspaceStore} from '../src/workspace-store.js';
import {boundedHttpRequest as request} from '../src/network.js';
test('workspace CAS preserves external edits and refuses traversal and symlinks',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'publish-notes-'));try{const store=new WorkspaceStore(root);const first=await store.write({path:'sub/article.md',text:'---\ntitle: First\n---\nBody'});assert.equal((await store.inventory()).files[0].frontmatter.title,'First');const next=await store.saveFrontmatter({path:first.path,etag:first.etag,frontmatter:{title:'Updated',wechat_media_id:'fixture'}});assert.match(next.text,/fixture/);await assert.rejects(store.write({...first,text:'stale'}),/changed/);await assert.rejects(store.asset('../private.png'),/relative/);await symlink('/etc',path.join(root,'external'));await assert.rejects(store.asset('external/passwd'),/Symbolic/);}finally{await rm(root,{recursive:true,force:true});}
});
test('network refuses credential redirects and bounds responses',async()=>{
 await assert.rejects(request({url:'https://example.com?access_token=secret'}, {fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://other.example/'}})}),/Cross-origin/);
 await assert.rejects(request({url:'https://example.com'}, {fetchImpl:async()=>new Response('x',{headers:{'content-length':String(40*1024*1024)}})}),/exceeds/);
 const result=await request({url:'https://example.com'}, {fetchImpl:async()=>new Response('{"ok":true}',{status:200})});assert.equal(Buffer.from(result.base64,'base64').toString(),'{"ok":true}');
});
test('rename never replaces an existing note and preserves content identity',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'publish-rename-'));try{const store=new WorkspaceStore(root);const first=await store.write({path:'first.md',text:'Original'});await store.write({path:'existing.md',text:'Keep'});await assert.rejects(store.renameNote({...first,to:'existing.md'}),{code:'EEXIST'});assert.equal((await store.read('first.md')).text,'Original');const moved=await store.renameNote({...first,to:'folder/moved.md'});assert.equal(moved.etag,first.etag);assert.equal((await store.read(moved.path)).text,'Original');await assert.rejects(store.read('first.md'),{code:'ENOENT'});}finally{await rm(root,{recursive:true,force:true});}
});
