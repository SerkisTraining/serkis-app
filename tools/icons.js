const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const jobs=[["any",192,"icon-192.png"],["any",512,"icon-512.png"],["maskable",512,"icon-maskable-512.png"],["apple",180,"apple-touch-icon.png"],["any",32,"favicon-32.png"]];
for(const [k,s,out] of jobs){const svg=fs.readFileSync(path.join(process.argv[2],'icons',k+'.svg'),'utf8');
await p.setViewportSize({width:s,height:s});await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ','<svg width="'+s+'" height="'+s+'" ')}</body></html>`);
await p.screenshot({path:path.join(process.argv[2],'icons',out),omitBackground:true,clip:{x:0,y:0,width:s,height:s}});}
await b.close();})();
