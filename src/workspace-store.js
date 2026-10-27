import {NotesStore} from './notes.js';
import {readdir,lstat,readFile,writeFile,mkdir,link,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parse,stringify} from 'yaml';
export class WorkspaceStore extends NotesStore {
 renameNote({path:relative,to,etag}){const task=this.queue.catch(()=>{}).then(async()=>{const current=await this.read(relative);if(current.etag!==etag)throw Error('Note changed before rename');const source=await this.resolve(relative),target=await this.resolve(to);if(source===target)return current;await mkdir(path.dirname(target),{recursive:true,mode:0o700});await this.resolve(to);await link(source,target);try{await unlink(source);}catch(error){await unlink(target).catch(()=>{});throw error;}return{...current,path:to};});this.queue=task;return task;}
 async inventory(){
  await this.ready;const files=[];let bytes=0;
  const visit=async(dir,depth)=>{if(depth>20)throw Error('Notes nesting exceeds limit');for(const entry of await readdir(dir,{withFileTypes:true})){
   if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
   const absolute=path.join(dir,entry.name),relative=path.relative(this.root,absolute).replaceAll(path.sep,'/');
   if(entry.isDirectory()){await visit(absolute,depth+1);continue;}
   if(!entry.isFile())continue;if(files.length>=10000)throw Error('Notes workspace exceeds 10000 files');
   const stat=await lstat(await this.resolve(relative,{directory:true}));
   const info={path:relative,stat:{mtime:stat.mtimeMs,ctime:stat.birthtimeMs,size:stat.size}};
   if(relative.toLowerCase().endsWith('.md')){if(stat.size>2*1024*1024)throw Error('Note exceeds 2 MB');bytes+=stat.size;if(bytes>32*1024*1024)throw Error('Markdown workspace exceeds 32 MB');const note=await this.read(relative);Object.assign(info,note,{frontmatter:this.frontmatter(note.text)});}
   files.push(info);
  }};await visit(this.root,0);return{root:this.root,files};
 }
 frontmatter(text){const match=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/.exec(text);if(!match)return{};const value=parse(match[1],{maxAliasCount:20});if(value==null)return{};if(typeof value!=='object'||Array.isArray(value))throw Error('Frontmatter must be a mapping');return value;}
 async asset(relative){const file=await this.resolve(relative,{directory:true}),stat=await lstat(file);if(!stat.isFile()||stat.size>32*1024*1024)throw Error('Attachment exceeds 32 MB or is not a file');const extension=path.extname(file).toLowerCase();const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.avif':'image/avif','.bmp':'image/bmp','.woff2':'font/woff2'}[extension]||'application/octet-stream';return{base64:(await readFile(file)).toString('base64'),mime};}
 async saveFrontmatter({path:relative,etag,frontmatter}){const note=await this.read(relative);if(note.etag!==etag)throw Error('Note changed before frontmatter update');if(!frontmatter||typeof frontmatter!=='object'||Array.isArray(frontmatter))throw Error('Invalid frontmatter');const body=note.text.replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/,'');return this.write({path:relative,etag,text:`---\n${stringify(frontmatter)}---\n${body}`});}
 async putAsset({path:relative,base64}){if(typeof base64!=='string'||base64.length>44*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('Invalid attachment');if(!/\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|mp3|wav|ogg|m4a|flac|aac|mp4|webm|mov|avi|mkv)$/i.test(relative))throw Error('Unsupported attachment');const target=await this.resolve(relative,{directory:true});await mkdir(path.dirname(target),{recursive:true,mode:0o700});await this.resolve(relative,{directory:true});await writeFile(target,Buffer.from(base64,'base64'),{flag:'wx',mode:0o600});return{path:relative};}
}
