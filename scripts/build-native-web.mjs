import {build} from 'esbuild';
import {mkdir, readFile, writeFile, readdir, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'web');
const target=path.join(root,'macos','Freezlit','Web');
await mkdir(target,{recursive:true});
await build({entryPoints:[path.join(source,'app.js')],outfile:path.join(target,'app-native.js'),
  bundle:true,format:'iife',platform:'browser',target:['safari16'],legalComments:'eof',minify:false});
for(const file of await readdir(source)) {
  if(/\.(css|svg|png|jpg|jpeg|webp|gif|woff2?)$/i.test(file)) await copyFile(path.join(source,file),path.join(target,file));
}
let html=await readFile(path.join(source,'index.html'),'utf8');
html=html.replace(/<script\b[^>]*\bsrc=["']app\.js["'][^>]*>\s*<\/script>/i,'<script defer src="app-native.js"></script>');
if(!html.includes('app-native.js')) throw Error('Could not replace the app module with the native classic bundle.');
const policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'";
html=html.replace(/<head>/i,`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
await writeFile(path.join(target,'index.html'),html);
console.log('Built offline classic JavaScript for macOS WKWebView.');
