import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const hostBuild=await build({
  entryPoints: ["src/host.js"],
  outfile: "index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  banner:{js:'import {createRequire as __createRequire} from "node:module";const require=__createRequire(import.meta.url);'},
  target: "node22",
  external: ["@deepseek-ai/dsh-typert-protocol", "@deepseek-ai/cordis"],
  legalComments: "eof",
  metafile:true,
});
const r = await build({
  entryPoints: ["src/client.jsx"],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "browser",
  target: "chrome120",
  external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  loader: { ".css": "text", ".woff2": "base64" },
  legalComments: "eof",
  metafile:true,
});
await writeFile(
  "client.js",
  `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;\n${r.outputFiles[0].text}\nreturn module.exports;}});\n`,
);
console.log(`Built ${pkg.name}@${pkg.version}`);
await writeFile('build-inputs.json',JSON.stringify([...new Set([...Object.keys(hostBuild.metafile.inputs),...Object.keys(r.metafile.inputs)])]));
await import('./licenses.mjs');
