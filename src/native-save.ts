import {TFile} from './harness-ui';

/** Persist a snapshot without declaring edits made during the write saved. */
export async function persistNoteDraft(api:any,current:any,target:string,read:()=>any){
 const before=read();
 const saved=await api.noteWrite({path:target,etag:current?.path===target?current.etag??null:null,text:before.text});
 const after=read();
 const changed=after.file!==before.file||after.path!==before.path||after.text!==before.text;
 const file=current?.path===target?current:new TFile(saved);
 Object.assign(file,saved);
 if(after.file===current&&changed)file.text=after.text;
 return{file,saved,changed};
}
