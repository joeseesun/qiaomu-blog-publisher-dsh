import React,{useEffect,useRef} from 'react';
import {EditorView,keymap,drawSelection,lineNumbers} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap,history,historyKeymap} from '@codemirror/commands';
import {markdown} from '@codemirror/lang-markdown';
import {configureNativeHost,enhance,Modal,Menu,TFile,watchHostTheme,disposeSurfaces,bytesToBase64} from './harness-ui';
import {createWorkspace} from './native-workspace';
import {persistNoteDraft} from './native-save';
import QmblogPublisher from './original/main';
import {DEFAULT_SETTINGS,QmblogSettingTab} from './original/settings';

export function App({api,actions,language='zh'}){
 const root=useRef(null);
 useEffect(()=>{let disposed=false,cleanup=()=>{};
 (async()=>{
  const [state,inventory,info]=await Promise.all([api.load(),api.inventory(),api.info()]);if(disposed)return;
  const disconnect=configureNativeHost(api,info,language),stopTheme=watchHostTheme();
  let lane=Promise.resolve(),noteLane=Promise.resolve(),dirty=false,muted=false,timer,editor,workspace,secret='';
  const save=()=>{const snapshot=structuredClone(state.data);const task=lane.catch(()=>{}).then(async()=>{const result=await api.save({revision:state.revision,data:snapshot});state.revision=result.revision;});lane=task;return task;};
  const host=enhance(root.current);host.empty();const bar=host.createDiv('qblog-dsh-filebar');
  const pathInput=bar.createEl('input',{value:state.data.draft?.path||'博客笔记.md',attr:{'aria-label':'Markdown 文件路径'}});
  const choose=bar.createEl('select',{attr:{'aria-label':'打开笔记'}});
  const choices=()=>{const value=choose.value;choose.empty();choose.createEl('option',{text:'打开笔记…',attr:{value:''}});for(const f of workspace.files.values())if(f.extension==='md')choose.createEl('option',{text:f.path,attr:{value:f.path}});choose.value=value;};
  const saveButton=bar.createEl('button',{text:'保存'}),importButton=bar.createEl('button',{text:'导入'}),publishButton=bar.createEl('button',{text:'发布到博客'}),settingsButton=bar.createEl('button',{text:'设置'});
  const source=host.createDiv('qblog-dsh-source');const status=host.createEl('button',{cls:'qblog-dsh-file-status',text:'Qiaomu Blog',attr:{title:'发布当前笔记'}});
  const setEditor=text=>{muted=true;editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:text}});muted=false;};
  const stash=()=>{state.data.draft={path:pathInput.value,text:editor.state.doc.toString(),etag:workspace.view.file?.path===pathInput.value?workspace.view.file.etag??null:null};return save();};
  const markDirty=()=>{dirty=true;saveButton.setText('保存 *');clearTimeout(timer);timer=setTimeout(()=>void stash().catch(e=>status.setText(e.message)),300);};
  const saveNote=()=>{const task=noteLane.catch(()=>{}).then(async()=>{clearTimeout(timer);const target=pathInput.value.trim();if(!target)throw Error('请输入 Markdown 文件路径');const current=workspace.view.file;const {file,changed}=await persistNoteDraft(api,current,target,()=>({file:workspace.view.file,path:pathInput.value.trim(),text:editor.state.doc.toString()}));workspace.files.set(target,file);if(workspace.view.file===current)workspace.view.file=file;dirty=changed;saveButton.setText(changed?'保存 *':'保存');await stash();choices();status.setText(changed?'已保存；仍有新修改':'已保存 · '+target);});noteLane=task;return task;};
  const openFile=async file=>{if(dirty){await saveNote();if(dirty)throw Error('保存期间有新修改，请保存后再切换');}const saved=await api.noteRead({path:typeof file==='string'?file:file.path});const next=workspace.files.get(saved.path)||new TFile(saved);Object.assign(next,saved);workspace.files.set(saved.path,next);workspace.view.file=next;pathInput.value=saved.path;setEditor(saved.text);dirty=false;saveButton.setText('保存');await stash();};
  workspace=createWorkspace(api,inventory,{state,save,saveNote,setEditor,openFile});choices();cleanup=()=>{clearTimeout(timer);editor?.destroy();workspace.dispose();stopTheme();disconnect();disposeSurfaces();};
  let settingsLane=Promise.resolve();
  const persistSettings=settings=>{const snapshot={...settings};const task=settingsLane.catch(()=>{}).then(async()=>{if(snapshot.apiToken!==secret){await api.secretSet({id:'blog-api-token',value:snapshot.apiToken});secret=snapshot.apiToken;}state.data.settings={apiUrl:snapshot.apiUrl};await save();});settingsLane=task;return task;};
  const plugin=new QmblogPublisher(workspace.app,persistSettings,text=>status.setText(text));plugin.settings={...DEFAULT_SETTINGS,...state.data.settings,apiToken:''};
  try{secret=await api.secretGet({id:'blog-api-token'});plugin.settings.apiToken=secret;}catch(e){status.setText('无法读取已保存凭据：'+e.message);}
  if(disposed){stopTheme();disconnect();workspace.dispose();return;}
  const file=workspace.files.get(pathInput.value)||new TFile({path:pathInput.value});const disk=file.text||'';Object.assign(file,{text:state.data.draft?.text??disk,etag:state.data.draft?.etag??file.etag??null});workspace.files.set(file.path,file);workspace.view.file=file;
  editor=new EditorView({parent:source,state:EditorState.create({doc:file.text,extensions:[lineNumbers(),history(),drawSelection(),markdown(),EditorView.lineWrapping,keymap.of([{key:'Mod-s',run:()=>{void saveNote().catch(e=>status.setText(e.message));return true;}},...defaultKeymap,...historyKeymap]),EditorView.updateListener.of(update=>{if(!update.docChanged||muted)return;workspace.view.file.text=update.state.doc.toString();markDirty();})]})});
  workspace.view.editor={getValue:()=>editor.state.doc.toString(),getSelection:()=>editor.state.sliceDoc(editor.state.selection.main.from,editor.state.selection.main.to)};
  dirty=file.text!==disk;saveButton.setText(dirty?'保存 *':'保存');
  const publish=async()=>{await settingsLane;await saveNote();if(disposed)return;if(dirty)throw Error('保存期间有新修改，请保存后再发布');await plugin.publishCurrentNote();};
  const openSettings=()=>{const modal=new Modal(workspace.app);modal.modalEl.setAttribute('aria-label','Qiaomu Blog Publisher');modal.modalEl.addClass('qblog-dsh-settings-modal');const tab=new QmblogSettingTab(workspace.app,plugin);tab.containerEl=modal.contentEl;modal.onOpen=()=>tab.display();modal.open();};
  const run=fn=>()=>Promise.resolve().then(fn).catch(e=>status.setText(e.message));
  saveButton.onclick=run(saveNote);publishButton.onclick=run(publish);status.onclick=run(publish);settingsButton.onclick=openSettings;pathInput.oninput=markDirty;choose.onchange=run(()=>choose.value&&openFile(choose.value));
  const context=e=>{e.preventDefault();new Menu().addItem(item=>item.setTitle('发布到 Qiaomu Blog').setIcon('upload-cloud').onClick(publish)).showAtMouseEvent(e);};source.addEventListener('contextmenu',context);
  importButton.onclick=()=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.md,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.ico,.mp3,.wav,.ogg,.m4a,.flac,.aac,.mp4,.webm,.mov,.avi,.mkv';input.onchange=run(async()=>{for(const selected of input.files||[]){if(selected.size>32*1024*1024)throw Error('导入文件超过 32 MB');if(selected.name.endsWith('.json')){const raw=JSON.parse(await selected.text());if(typeof raw.apiUrl!=='string'||typeof raw.apiToken!=='string')throw Error('请选择原博客插件 data.json');plugin.settings={apiUrl:raw.apiUrl.replace(/\/+$/,''),apiToken:raw.apiToken};await plugin.saveSettings();status.setText('原博客配置已导入，Token 已保存到系统凭据库');}else if(selected.name.endsWith('.md')){const saved=await api.noteWrite({path:selected.name,etag:null,text:await selected.text()});workspace.files.set(saved.path,Object.assign(new TFile(saved),saved));choices();await openFile(saved.path);}else{const saved=await api.assetWrite({path:'attachments/'+selected.name,base64:bytesToBase64(new Uint8Array(await selected.arrayBuffer()))});workspace.files.set(saved.path,new TFile(saved));status.setText('已导入 · '+saved.path);}}});input.click();};
  const unsubscribe=actions?.subscribe(id=>id==='settings'?openSettings():run(publish)());
  let refreshing=false;const refresh=setInterval(async()=>{const active=workspace.view.file;if(disposed||dirty||refreshing||!active.etag)return;refreshing=true;try{const latest=await api.noteRead({path:active.path});if(disposed||dirty||workspace.view.file!==active||latest.etag===active.etag)return;Object.assign(active,latest);setEditor(latest.text);await stash();status.setText('已同步外部修改 · '+active.path);}catch(e){if(!disposed)status.setText(e.message);}finally{refreshing=false;}},3000);
  cleanup=()=>{clearTimeout(timer);clearInterval(refresh);unsubscribe?.();void stash().catch(()=>{});editor.destroy();workspace.dispose();stopTheme();disconnect();disposeSurfaces();document.getElementById('qmblog-modal-styles')?.remove();};if(disposed)cleanup();
 })().catch(e=>{cleanup();if(!disposed){const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=e.message;root.current?.replaceChildren(message);}});
 return()=>{disposed=true;cleanup();};
 },[api,language]);
 return <div className="qblog-dsh-surface qblog-dsh-workspace" ref={root}/>;
}
