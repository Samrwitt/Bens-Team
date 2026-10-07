import { ExtractionError, extractFile, fileKind } from './extract.js';
import { recognizeLocal } from './local-ocr.js';
export async function processQueue(database, dependencies) {
  // At most two jobs per invocation, one active job across all workers.
  for (let n = 0; n < 2; n++) {
    const { data: jobs, error: claimError } = await database.rpc('claim_attachment_job');
    if (claimError || !jobs?.length) return;
    const job = jobs[0];
    const finish = async (values) => {
      const {error} = await database.from('attachment_processing').update({ ...values, lease_until:null, updated_at:new Date().toISOString() }).eq('attachment_id',job.attachment_id).eq('lease_token',job.lease_token);
      if (error) throw new Error('Unable to save processing status.');
    };
    try {
      const { data: file, error } = await database.from('feedback_attachments').select('*').eq('id',job.attachment_id).single();
      if (error || !file) throw new Error('Attachment unavailable.');
      if (fileKind(file) === 'unsupported') {
        await finish({status:'unsupported',error:'This file type is not supported for text analysis. Use PDF, DOCX, text, PNG, JPEG, or WebP.'});
        continue;
      }
      const download = await database.storage.from('feedback-files').download(file.path);
      if (download.error || !download.data) throw new Error('Download unavailable.');
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      if (bytes.length !== Number(file.size) || bytes.length > 20*1024*1024) throw new ExtractionError('The uploaded file could not be verified.');
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = `v2-local:${fileKind(file)}:` + [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
      const cached = await database.from('attachment_content_cache').select('extracted_text').eq('hash',hash).maybeSingle();
      if (cached.error) throw new Error('Cache unavailable.');
      const text = cached.data?.extracted_text || await extractFile(file, bytes, {
        ...dependencies, recognize:(data,mime)=>recognizeLocal(data,mime,dependencies),
      });
      if (!cached.data) {
        const saved = await database.from('attachment_content_cache').upsert({hash,extracted_text:text},{onConflict:'hash'});
        if (saved.error) throw new Error('Unable to save extraction.');
      }
      await finish({status:'ready',extracted_text:text,content_hash:hash,error:null});
    } catch (error) {
      const retryable = !(error instanceof ExtractionError) || error.retryable;
      const retry = retryable && job.attempts < 3;
      try {
        await finish({status:retry ? 'queued' : 'failed',error:error instanceof ExtractionError ? error.message : 'This file could not be processed. Please upload it again if processing fails.',
          available_at:new Date(Date.now() + (job.attempts === 1 ? 60_000 : 300_000)).toISOString()});
      } catch { /* An expired lease is recovered by the durable queue. */ }
    }
  }
}
export function createProcessorHandler({ database, secret, waitUntil, ...dependencies }) {
  return (request) => {
    if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
    if (!secret || request.headers.get('x-processing-secret') !== secret) return new Response('Unauthorized',{status:401});
    waitUntil(processQueue(database,dependencies).catch(()=>{}));
    return new Response(JSON.stringify({accepted:true}),{status:202,headers:{'Content-Type':'application/json'}});
  };
}
