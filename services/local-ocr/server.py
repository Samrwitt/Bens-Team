"""Private, bounded OCR worker. Requires Tesseract and Poppler; no LLM client."""
import hmac
import json
import os
import re
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BYTES = 8 * 1024 * 1024
MAX_TEXT = 100_000
MAX_PAGES = 50
LANGUAGE = os.environ.get('OCR_LANGUAGE', 'eng')
if not re.fullmatch(r'[a-zA-Z0-9_+]+', LANGUAGE):
    raise ValueError('Invalid OCR_LANGUAGE')
SLOT = threading.BoundedSemaphore(1)


def extract(data, mime):
    deadline = time.monotonic() + 80

    def run(*args):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError('OCR time limit exceeded')
        result = subprocess.run(args, check=True, capture_output=True,
                                timeout=min(remaining, 30))
        return result.stdout.decode('utf-8', errors='replace').strip()

    with tempfile.TemporaryDirectory(prefix='workroom-ocr-') as directory:
        path = Path(directory) / 'input'
        path.write_bytes(data)
        if mime != 'application/pdf':
            text = run('tesseract', str(path), 'stdout', '-l', LANGUAGE)
        else:
            info = run('pdfinfo', str(path))
            count = re.search(r'^Pages:\s+(\d+)', info, re.MULTILINE)
            if not count or not 1 <= int(count[1]) <= MAX_PAGES:
                raise ValueError('PDF page limit exceeded')
            pages = []
            length = 0
            readable_pages = 0
            for number in range(1, int(count[1]) + 1):
                # Preserve native text and OCR only pages without readable text.
                text = run('pdftotext', '-f', str(number), '-l', str(number),
                           '-layout', str(path), '-')
                text = text.replace('\x0c', '').strip()
                if not text:
                    image = Path(directory) / 'page'
                    run('pdftoppm', '-f', str(number), '-l', str(number),
                        '-singlefile', '-scale-to', '2400', '-png', str(path), str(image))
                    text = run('tesseract', str(image) + '.png', 'stdout', '-l', LANGUAGE)
                    (Path(str(image) + '.png')).unlink(missing_ok=True)
                if text:
                    readable_pages += 1
                if not text:
                    text = '[No readable text found on this page]'
                page_text = f'Page {number}:\n{text}'
                length += len(page_text) + 2
                if length > MAX_TEXT:
                    raise ValueError('Text limit exceeded')
                pages.append(page_text)
            if not readable_pages:
                raise ValueError('No readable text found in this PDF')
            text = '\n\n'.join(pages)
        text = text.replace('\x00', '').strip()
        if not text or len(text) > MAX_TEXT:
            raise ValueError('No readable text or text limit exceeded')
        return text


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Do not log request bodies or authorization headers.

    def reply(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        secret = os.environ.get('LOCAL_OCR_SECRET', '')
        if not secret or not hmac.compare_digest(
                self.headers.get('Authorization', ''), f'Bearer {secret}'):
            return self.reply(401, {'error': 'Unauthorized'})
        if self.path != '/extract':
            return self.reply(404, {'error': 'Not found'})
        mime = self.headers.get('Content-Type', '').split(';')[0]
        if mime not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp'):
            return self.reply(415, {'error': 'Unsupported file type'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            size = 0
        if not 0 < size <= MAX_BYTES:
            return self.reply(413, {'error': 'File size limit exceeded'})
        if not SLOT.acquire(blocking=False):
            return self.reply(503, {'error': 'OCR busy; retry later'})
        try:
            self.connection.settimeout(15)
            data = self.rfile.read(size)
            if len(data) != size:
                raise ValueError('Incomplete file')
            text = extract(data, mime)
            self.reply(200, {'text': text})
        except (ValueError, OSError, subprocess.SubprocessError):
            self.reply(422, {'error': 'Unable to extract readable text within limits'})
        finally:
            SLOT.release()


if __name__ == '__main__':
    if not os.environ.get('LOCAL_OCR_SECRET'):
        raise SystemExit('Set LOCAL_OCR_SECRET before starting the worker')
    ThreadingHTTPServer((os.environ.get('OCR_HOST', '127.0.0.1'),
                         int(os.environ.get('PORT', '8090'))), Handler).serve_forever()
