import { remoteApi } from "./remote.js";
import React, { useEffect, useState } from "react";
import { BookOpen, Palette, AudioLines, FileText } from "lucide-react";
import { NAME, ID, TITLE, EN_TITLE, SERVICE } from "./meta.js";
import { App } from "./native-app.jsx";
import hostCss from "./harness-ui.css";
const css=hostCss;
const ICON = NAME.includes("ui-learn")
  ? BookOpen
  : NAME.includes("cover")
    ? Palette
    : NAME.includes("audio")
      ? AudioLines
      : FileText;
export const inject = ["slots", "remote", "locale"];
export function apply(ctx) {
  let actionHandler=null,pendingAction=null;
  const actions={subscribe(fn){actionHandler=fn;if(pendingAction){const next=pendingAction;pendingAction=null;queueMicrotask(()=>fn(next));}return()=>{if(actionHandler===fn)actionHandler=null;};},send(id){if(actionHandler)actionHandler(id);else pendingAction=id;}};
  ctx.inject(['shortcuts','layout'],ready=>{
    for(const [id,label] of [['publish','发布到 Qiaomu Blog'],['settings','博客发布设置']])ready.effect(()=>ready.shortcuts.register({id:`${ID}.${id}`,label:()=>`${TITLE} · ${label}`,aliases:[label,'Qiaomu Blog Publisher'],defaults:{},regions:['page','editable'],modals:[],resolve:()=>({status:'handled',run:()=>{ready.layout.selectPanel(ID);actions.send(id);}})}));
  });
  const listeners = new Set();
  let api = null,
    error = "";
  const notify = () => listeners.forEach((f) => f());
  let disposed = false;
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.effect(() =>
    ctx.locale.register(ID, { zh: { title: TITLE,language:'zh' }, en: { title: EN_TITLE,language:'en' } }),
  );
  const codec = () => ({
    mode: "strict",
    typeSymbol: NAME + "#json",
    create: () => ({
      parse: (v) => v,
      safeParse: (v) => ({ success: true, data: v }),
    }),
  });
  const methods = ["load","save","info","inventory","noteRead","noteWrite","noteRename","frontmatter","asset","assetWrite","request","secretGet","secretSet"];
  const descriptors = methods.map((method) => ({
    id: `${NAME}#${SERVICE}/${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: "direct" },
    parameters: ["load", "info", "inventory"].includes(method)
      ? []
      : [{ name: "request", wire: "request", source: "json", codec: codec() }],
    result: { mode: "src-json" },
    cancellation: { parameter: "signal" },
  }));
  ctx.effect(() => () => {
    disposed = true;
    api = null;
    listeners.clear();
  });
  ctx.remote
    .$mount({ package: NAME, descriptors })
    .then(() => {
      if (disposed) return;
      ctx.inject(["remote." + SERVICE], (ready) => {
        api = remoteApi(ready.remote[SERVICE], methods);
        error = "";
        notify();
        return () => {
          api = null;
          notify();
        };
      });
    })
    .catch((e) => {
      error = e.message;
      notify();
    });
  function Panel() {
    const [, render] = useState(0);
    useEffect(() => {
      const f = () => render((x) => x + 1);
      listeners.add(f);
      return () => listeners.delete(f);
    }, []);
    return (
      <div className="qblog-dsh-host" data-plugin={NAME}>
        {api ? (
          <App api={api} actions={actions} language={ctx.locale.bind(ID)('language')} />
        ) : (
          <p role="status">{error || "正在连接本地服务 / Connecting…"}</p>
        )}
      </div>
    );
  }
  ctx.effect(() =>
    ctx.slots.inject("main", () =>
      ctx.slots.register({ name: "main", key: ID, locale: ID }, Panel),
    ),
  );
  ctx.effect(() =>
    ctx.slots.inject("sidebar.panellist", () =>
      ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: ID,
          order: 45,
          locale: ID,
          label: () => TITLE,
        },
        ICON,
      ),
    ),
  );
}
