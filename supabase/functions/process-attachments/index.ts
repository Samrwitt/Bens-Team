import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getDocument } from 'npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs';
import { unzipSync } from 'npm:fflate@0.8.3';
import { createProcessorHandler } from './worker.js';
Deno.serve(createProcessorHandler({
  database:createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),
  secret:Deno.env.get('ATTACHMENT_PROCESSING_SECRET'),
  waitUntil:(task:Promise<void>)=>EdgeRuntime.waitUntil(task),
  getEnv:(name:string)=>Deno.env.get(name),
  getDocument,unzipSync,
}));
