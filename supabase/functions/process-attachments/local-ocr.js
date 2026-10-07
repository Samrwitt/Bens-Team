import { ExtractionError, usableText } from './extract.js';

// Send bytes only to the operator's own OCR worker. Never fall back to an LLM.
export async function recognizeLocal(bytes, mime, { getEnv, fetchImpl = fetch }) {
  const endpoint = getEnv('LOCAL_OCR_URL');
  const secret = getEnv('LOCAL_OCR_SECRET');
  if (!endpoint || !secret) throw new ExtractionError('Local OCR is not configured. Processing will retry shortly.', true);
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new ExtractionError('Local OCR requires an HTTPS endpoint.');
  }
  if (bytes.length > 8 * 1024 * 1024) throw new ExtractionError('Images and scanned PDFs over 8 MB need to be reduced before OCR.');
  try {
    const response = await fetchImpl(url.href, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
      headers: { 'Content-Type': mime, Authorization: `Bearer ${secret}` }, body: bytes,
    });
    if (!response.ok) throw new ExtractionError(
      response.status === 422 ? 'Local OCR could not read this file. Upload a clearer or smaller document.' : 'Local OCR is unavailable. Processing will retry shortly.',
      response.status !== 422,
    );
    const data = await response.json();
    if (typeof data.text !== 'string') throw new Error('Invalid OCR response');
    return usableText(data.text);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('Local OCR is unavailable. Processing will retry shortly.', true);
  }
}
