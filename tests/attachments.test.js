import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { zipSync, unzipSync } from 'fflate';
import { extractFile } from '../supabase/functions/process-attachments/extract.js';
import { recognizeLocal } from '../supabase/functions/process-attachments/local-ocr.js';
import { createProcessorHandler, processQueue } from '../supabase/functions/process-attachments/worker.js';
const encoder = new TextEncoder();
const dependencies={getDocument,unzipSync,recognize:()=>{throw new Error('Unexpected AI call');}};
const file=(name,content_type='application/octet-stream')=>({name,content_type});
function pdfBytes() {
  const stream='BT /F1 12 Tf 50 700 Td (Section 1 finished) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let text='%PDF-1.4\n', offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(text.length);text+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const start=text.length;
  text+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return encoder.encode(text);
}
test('text, real PDF and DOCX extract locally without paid requests', async()=>{
  assert.equal(await extractFile(file('progress.txt','text/plain'),encoder.encode('Section 1 done'),dependencies),'Section 1 done');
  assert.match(await extractFile(file('progress.pdf','application/pdf'),pdfBytes(),dependencies),/Section 1 finished/);
  const docx=zipSync({'word/document.xml':encoder.encode('<w:document><w:body><w:p><w:r><w:t>Section 2 &amp; review</w:t></w:r></w:p></w:body></w:document>')});
  assert.equal(await extractFile(file('progress.docx'),docx,dependencies),'Section 2 & review');
});
test('unsupported, empty and oversized content fails explicitly',async()=>{
  await assert.rejects(extractFile(file('video.mp4'),new Uint8Array(),dependencies),/not supported/);
  await assert.rejects(extractFile(file('empty.txt','text/plain'),encoder.encode('  '),dependencies),/No readable/);
  await assert.rejects(extractFile(file('big.txt','text/plain'),encoder.encode('x'.repeat(100001)),dependencies),/too much text/);
});
test('scanned PDF pages invoke recognition instead of being silently omitted', async()=>{
  let calls=0;
  const text=await extractFile(file('scan.pdf'),pdfBytes(),{...dependencies,getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async(n)=>({getTextContent:async()=>({items:n===1?[{str:'Some text'}]:[]}),cleanup(){}})}),destroy:async()=>{}}),recognize:async()=>{calls++;return 'Page 1: text. Page 2: screenshot.';}});
  assert.equal(calls,1);assert.match(text,/Page 2/);
});
test('local OCR sends raw bytes only to the configured worker with no LLM fallback', async()=>{
  const calls=[];
  const bytes=new Uint8Array([1,2]);
  const text=await recognizeLocal(bytes,'image/png',{getEnv:n=>({LOCAL_OCR_URL:'https://ocr.workroom.test/extract',LOCAL_OCR_SECRET:'worker-secret',GROQ_API_KEY:'unused'})[n],fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({text:'Section 1 finished'}));}});
  assert.equal(text,'Section 1 finished');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://ocr.workroom.test/extract');
  assert.equal(calls[0].init.body,bytes);
  assert.equal(calls[0].init.headers.Authorization,'Bearer worker-secret');
  await assert.rejects(recognizeLocal(bytes,'image/png',{getEnv:n=>n==='GROQ_API_KEY'?'key':undefined,fetchImpl:()=>{throw new Error('Must not call LLM');}}),/Local OCR is not configured/);
});
test('local OCR rejects insecure endpoints and hides worker errors',async()=>{
  await assert.rejects(recognizeLocal(new Uint8Array([1]),'image/png',{getEnv:n=>n==='LOCAL_OCR_URL'?'http://remote.test/extract':'secret'}),/HTTPS/);
  await assert.rejects(recognizeLocal(new Uint8Array([1]),'image/png',{getEnv:n=>n==='LOCAL_OCR_URL'?'https://ocr.test/extract':'secret',fetchImpl:async()=>new Response('private information',{status:503})}),error=>error.retryable && !error.message.includes('private information'));
});
function workerFixture(overrides = {}) {
  const bytes=encoder.encode('Saved progress');
  const jobs=[1,2].map(id=>({attachment_id:id,status:'queued',attempts:0,lease_token:`lease-${id}`}));
  const cache=new Map(); let downloads=0;
  const database={rpc:async()=>{const job=jobs.find(j=>j.status==='queued');if(job){job.status='processing';job.attempts++;}return {data:job?[{...job}]:[]};},storage:{from:()=>({download:async()=>{downloads++;return {data:new Blob([bytes])};}})},from(table){let values,filters={};const query={select(){return this},eq(key,value){filters[key]=value;return this},single(){return this},maybeSingle(){return this},update(v){values=v;return this},upsert(v){values=v;return this},then(resolve){if(table==='feedback_attachments')return Promise.resolve({data:{id:filters.id,name:'progress.txt',content_type:'text/plain',size:bytes.length,path:'private/file',...overrides}}).then(resolve);if(table==='attachment_content_cache'){if(values)cache.set(values.hash,values);return Promise.resolve({data:cache.get(filters.hash)||null}).then(resolve);}const job=jobs.find(j=>j.attachment_id===filters.attachment_id&&j.lease_token===filters.lease_token);if(job)Object.assign(job,values);return Promise.resolve({data:job}).then(resolve);}};return query;}};
  return {database,jobs,cache,get downloads(){return downloads;}};
}
test('upload jobs save content and identical files reuse one cache record',async()=>{
  const f=workerFixture();await processQueue(f.database,dependencies);
  assert.equal(f.jobs.filter(j=>j.status==='ready').length,2);
  assert.equal(f.cache.size,1);assert.equal(f.downloads,2);
  assert.equal(f.jobs[0].extracted_text,'Saved progress');
  await processQueue(f.database,dependencies);assert.equal(f.downloads,2);
});
test('only authenticated webhook starts background work and returns immediately',()=>{
  const tasks=[];const f=workerFixture();
  const handler=createProcessorHandler({database:f.database,secret:'worker-secret',waitUntil:task=>tasks.push(task),...dependencies});
  assert.equal(handler(new Request('https://worker.test',{method:'POST'})).status,401);
  assert.equal(tasks.length,0);
  assert.equal(handler(new Request('https://worker.test',{method:'POST',headers:{'x-processing-secret':'worker-secret'}})).status,202);
  assert.equal(tasks.length,1);
  return tasks[0];
});

test('duplicate images use one recognition request and then saved content',async()=>{
  const f=workerFixture({name:'screenshot.png',content_type:'image/png'});
  let calls=0;
  await processQueue(f.database,{...dependencies,getEnv:n=>({LOCAL_OCR_URL:'https://ocr.test/extract',LOCAL_OCR_SECRET:'secret'})[n],fetchImpl:async()=>{calls++;return new Response(JSON.stringify({text:'Team page'}));}});
  assert.equal(calls,1);assert.equal(f.cache.size,1);
  assert.equal(f.jobs.filter(job=>job.status==='ready').length,2);
});
