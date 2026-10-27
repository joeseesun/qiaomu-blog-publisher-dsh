import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import path from "node:path";
import { homedir } from "node:os";
import { StateStore } from "./storage.js";
import { NAME, SERVICE } from "./meta.js";
import {WorkspaceStore} from './workspace-store.js';
import {CredentialStore} from './credential-store.js';
import {boundedHttpRequest} from './network.js';
export const Config = {
  "~standard": {
    version: 1,
    vendor: NAME,
    validate(value) {
      if (value == null) return { value: {} };
      if (
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some((k) => !['dataDir','notesDir'].includes(k)) ||
        (value.notesDir !== undefined && (typeof value.notesDir !== 'string' || !path.isAbsolute(value.notesDir))) ||
        (value.dataDir !== undefined &&
          (typeof value.dataDir !== "string" ||
            !path.isAbsolute(value.dataDir)))
      )
        return {
          issues: [{ message: "dataDir must be an absolute directory" }],
        };
      return { value };
    },
  },
};
export default class PluginService extends TypertRemoteService {
  constructor(ctx, config = {}) {
    super(ctx, SERVICE);
    this.store = new StateStore(
      config.dataDir ||
        path.join(
          process.env.DSH_HOME || path.join(homedir(), ".dsh"),
          "qiaomu",
          NAME,
        ),
    );
    this.notes=new WorkspaceStore(config.notesDir||path.join(path.dirname(this.store.file),'notes'));
    this.credentials=new CredentialStore();
  }
  load() {
    return this.store.load();
  }
  save(request) {
    return this.store.save({...request,data:{...request.data,settings:{apiUrl:typeof request.data?.settings?.apiUrl==='string'?request.data.settings.apiUrl:'https://your-domain.com'}}});
  }
  info(){return{platform:process.platform,notesRoot:this.notes.root};}
  inventory(){return this.notes.inventory();}
  noteRead(request){return this.notes.read(request.path);}
  noteWrite(request){return this.notes.write(request);}
  noteRename(request){return this.notes.renameNote(request);}
  frontmatter(request){return this.notes.saveFrontmatter(request);}
  asset(request){return this.notes.asset(request.path);}
  assetWrite(request){return this.notes.putAsset(request);}
  request(request){return boundedHttpRequest(request);}
  secretGet(request){return this.credentials.get(request.id);}
  secretSet(request){return this.credentials.set(request.id,request.value);}

}
for (const name of ["load", "save","info","inventory","noteRead","noteWrite","noteRename","frontmatter","asset","assetWrite","request","secretGet","secretSet"])
  Remote(name)(PluginService.prototype[name], {
    name,
    private: false,
    static: false,
    addInitializer(fn) {
      fn.call(Object.create(PluginService.prototype));
    },
  });
