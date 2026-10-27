import {TFile,MarkdownView,Notice} from './harness-ui';
import {parse} from 'yaml';
export class Events {
 listeners=new Map<string,Set<(...args:any[])=>void>>();
 on(name:string,fn:(...args:any[])=>void){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name)!.add(fn);return{dispose:()=>this.listeners.get(name)?.delete(fn)};}
 emit(name:string,...args:any[]){for(const fn of this.listeners.get(name)||[])fn(...args);}
}
export function createWorkspace(api:any,inventory:any,options:any){
 const files=new Map<string,any>(inventory.files.map((item:any)=>[item.path,Object.assign(new TFile(item),item)]));
 const urls=new Map<string,string>(),pending=new Map<string,Promise<string>>();let disposed=false;const events=new Events();const view=new MarkdownView();const secrets=new Map<string,string>();
 const canonical=(value:string)=>{const parts:string[]=[];for(const part of value.replaceAll('\\','/').split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}return parts.join('/');};
 const resolve=(link:string,source:string)=>{const folder=source.split('/').slice(0,-1).join('/');for(const candidate of [canonical(folder+'/'+link),canonical(link)])for(const suffix of ['', '.md'])if(files.has(candidate+suffix))return files.get(candidate+suffix);const matches=[...files.values()].filter(file=>file.name===link||file.basename===link);return matches.length===1?matches[0]:null;};
 const metadata=(file:any)=>{const match=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/.exec(file.text||'');let frontmatter={};if(match){const parsed=parse(match[1],{maxAliasCount:20});if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))frontmatter=parsed;}return{frontmatter,embeds:[]};};
 const app:any={
  vault:{configDir:'.native',on:events.on.bind(events),getFiles:()=>[...files.values()],getAbstractFileByPath:(path:string)=>files.get(path)||null,
   read:async(file:any)=>file.text??(await api.noteRead({path:file.path})).text,
   cachedRead:async(file:any)=>file.text??(await api.noteRead({path:file.path})).text,
   readBinary:async(file:any)=>{const result=await api.asset({path:file.path});return Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)).buffer;},
   getResourcePath:(file:any)=>urls.get(file.path)||`qiaomu-asset:${encodeURIComponent(file.path)}`,
   resource:async(file:any)=>{if(disposed)throw Error('Workspace disposed');if(urls.has(file.path))return urls.get(file.path);if(pending.has(file.path))return pending.get(file.path);const work=api.asset({path:file.path}).then((result:any)=>{if(disposed)throw Error('Workspace disposed');const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:result.mime}));urls.set(file.path,url);pending.delete(file.path);return url;}).catch((error:any)=>{pending.delete(file.path);throw error;});pending.set(file.path,work);return work;},
   adapter:{exists:async(path:string)=>Object.hasOwn(options.state.data.metadata||{},path),read:async(path:string)=>options.state.data.metadata[path],write:async(path:string,value:string)=>{options.state.data.metadata??={};options.state.data.metadata[path]=value;await options.save();}},
  },
  metadataCache:{getFileCache:metadata,getFirstLinkpathDest:resolve},
  workspace:{on:events.on.bind(events),getActiveFile:()=>view.file,getActiveViewOfType:()=>view,getLastOpenFiles:()=>[view.file?.path].filter(Boolean),getLeavesOfType:(type:string)=>type==='markdown'?[{view}]:[],getMostRecentLeaf:()=>({openFile:options.openFile}),getLeaf:()=>({openFile:options.openFile}),onLayoutReady:(fn:any)=>queueMicrotask(fn)},
  secretStorage:{getSecret:(id:string)=>secrets.get(id)||'',setSecret:async(id:string,value:string)=>{await api.secretSet({id,value});secrets.set(id,value);}},
  loadLocalStorage:(key:string)=>options.state.data.local?.[key],saveLocalStorage:(key:string,value:any)=>{options.state.data.local??={};options.state.data.local[key]=value;void options.save().catch((e:any)=>new Notice(e.message));},
  fileManager:{processFrontMatter:async(file:any,fn:any)=>{if(view.file===file)await options.saveNote();const value=metadata(file).frontmatter;fn(value);const before=file.text;const saved=await api.frontmatter({path:file.path,etag:file.etag,frontmatter:value});if(file.text!==before){new Notice('发布记录已写入磁盘；笔记在此期间有新修改，请保留编辑内容并重新打开文件后合并。');return;}Object.assign(file,saved);if(view.file===file)options.setEditor(saved.text);events.emit('modify',file);}},
 };
 return{app,view,files,events,secrets,metadata,dispose:()=>{disposed=true;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();events.listeners.clear();}};
}
