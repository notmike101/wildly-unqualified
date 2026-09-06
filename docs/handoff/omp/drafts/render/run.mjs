import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,readdir,access} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=fileURLToPath(new URL('./',import.meta.url)),repo=resolve(here,'../../../..'),source=resolve(repo,'../routines'),inputs=resolve(here,'../task-5-programmatic-captures'),output=resolve(here,'output');await mkdir(output,{recursive:true});
const sourceHashes={};for(const file of ['view.ts','main.ts','level.ts','wildlife.ts','forest-view.ts'])sourceHashes[file]=createHash('sha256').update(await readFile(resolve(source,file))).digest('hex');await writeFile(resolve(output,'source-hashes.json'),JSON.stringify({source,sourceHashes},null,2));
const client=resolve(here,'client.ts').replaceAll('\\','/');
const server=await createServer({configFile:false,root:source,publicDir:resolve(source,'public'),server:{host:'127.0.0.1',port:4322,strictPort:true,fs:{allow:[source,repo]}},plugins:[{name:'render-check-page',configureServer(s){s.middlewares.use('/render-check',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/render-check',`<!doctype html><html><body style="margin:16px;background:#17372b;color:#fff;font:16px sans-serif"><h1>Production frozen render check</h1><img width="640" height="360"><script type="module" src="/@fs/${client}"></script></body></html>`));});}}]});
await server.listen();const browser=await chromium.launch({channel:'msedge',headless:false,ignoreDefaultArgs:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1320,height:980}}),results=[],errors=[],done=new Set();page.on('pageerror',e=>errors.push(String(e)));
try{await page.goto('http://127.0.0.1:4322/render-check');await page.waitForFunction(()=>window.renderReady,null,{timeout:60000});
 const end=Date.now()+30*60*1000;
 while(Date.now()<end){
  for(const file of (await readdir(inputs).catch(()=>[])).filter(n=>n.endsWith('.json')&&!done.has(n))){const raw=await readFile(resolve(inputs,file)),data=JSON.parse(raw);if(!data.world||!data.frame||!data.snapshot){done.add(file);continue;}const name=basename(file,'.json');if(!/^[a-zA-Z0-9_-]+$/.test(name))throw Error('Unsafe case filename');
   try{const result=await page.evaluate(data=>window.renderCase(data),data);await writeFile(resolve(output,name+'.jpg'),Buffer.from(result.jpeg));delete result.jpeg;await page.screenshot({path:resolve(output,name+'.png')});result.name=data.name;result.input=file;result.inputHash=createHash('sha256').update(raw).digest('hex');result.verdict=data.verdict;await writeFile(resolve(output,name+'.json'),JSON.stringify(result,null,2));results.push(result);console.log('RENDERED '+name+' '+result.bytes+' bytes repeat='+result.repeatIdentical+' alignment='+JSON.stringify(result.alignment.map(a=>({id:a.id,points:a.points?.map(p=>p.error)}))));}
   catch(e){errors.push(file+': '+String(e));console.error(file,e);}done.add(file);await writeFile(resolve(output,'results.json'),JSON.stringify({results,errors},null,2));
  }
  if(await access(resolve(inputs,'COMPLETE')).then(()=>true,()=>false))break;
  if(await access(resolve(here,'STOP')).then(()=>true,()=>false))break;
  await new Promise(r=>setTimeout(r,3000));
 }
}catch(e){errors.push(String(e));console.error(e);process.exitCode=1;}finally{await writeFile(resolve(output,'results.json'),JSON.stringify({results,errors},null,2));await page.evaluate(()=>window.closeRender?.()).catch(()=>{});await browser.close();await server.close();}
