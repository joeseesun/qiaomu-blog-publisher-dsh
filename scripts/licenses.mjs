import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const inputs=JSON.parse(await readFile('build-inputs.json','utf8'));
const roots=[...new Set(inputs.filter(p=>p.startsWith('node_modules/')).map(p=>{const parts=p.split('/');return parts.slice(0,parts[1].startsWith('@')?3:2).join('/');}))].sort();
let out='# Sources and licenses\n\nOriginal Qiaomu Blog Publisher source with inline modal stylesheet: https://github.com/joeseesun/qiaomu-blog-opensource at `5d41358f707320c2f56016bf62327eb60d8668b8` (MIT), preserved in src/original. Native Harness adapters written for this migration. React is supplied by Harness. Dependency versions are locked in package-lock.json.\n\n';
for(const root of roots){const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const candidates=(await readdir(root)).filter(name=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(name));let license='';for(const name of candidates){const file=path.join(root,name);if((await stat(file)).isFile())license+=await readFile(file,'utf8')+'\n';}if(!license&&pkg.name==='marked-footnote')license=await readFile('licenses/marked-footnote.txt','utf8');if(!license)throw Error(`Missing license text for bundled dependency: ${pkg.name}`);out+=`## ${pkg.name} ${pkg.version}\n\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license)}\n\n\x60\x60\x60text\n${license}\x60\x60\x60\n\n`;}
await writeFile('THIRD_PARTY_NOTICES.md',out);
console.log(`Bundled license notices: ${roots.length} dependencies`);
