"""Run with: python3 -m unittest discover -s tests -p 'local_ocr_test.py'.
Integration tests need Pillow plus Tesseract and Poppler (worker runtime does not need Pillow).
"""
import importlib.util
import io
import shutil
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('local_ocr', Path(__file__).resolve().parents[1] / 'services/local-ocr/server.py')
ocr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ocr)
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None


@unittest.skipUnless(Image and all(shutil.which(tool) for tool in ('tesseract', 'pdfinfo', 'pdftotext', 'pdftoppm')), 'Requires Pillow, Tesseract and Poppler')
class LocalOCRTest(unittest.TestCase):
    def image(self):
        image = Image.new('RGB', (1200, 300), 'white')
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 48)
        ImageDraw.Draw(image).text((40, 100), 'Section 1 finished', fill='black', font=font)
        return image

    def test_real_image_recognition(self):
        output = io.BytesIO()
        self.image().save(output, format='PNG')
        self.assertIn('Section 1 finished', ocr.extract(output.getvalue(), 'image/png'))

    def test_real_scanned_pdf_recognition(self):
        output = io.BytesIO()
        self.image().save(output, format='PDF', resolution=150)
        text = ocr.extract(output.getvalue(), 'application/pdf')
        self.assertIn('Page 1:', text)
        self.assertIn('Section 1 finished', text)

    def test_corrupt_file_fails(self):
        with self.assertRaises(Exception):
            ocr.extract(b'not an image', 'image/png')

    def test_blank_image_fails(self):
        output = io.BytesIO()
        Image.new('RGB', (100, 100), 'white').save(output, format='PNG')
        with self.assertRaisesRegex(ValueError, 'No readable text'):
            ocr.extract(output.getvalue(), 'image/png')


if __name__ == '__main__':
    unittest.main()
