FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.py /app/server.py
USER 65534:65534
ENV OCR_HOST=0.0.0.0 PORT=8090
EXPOSE 8090
CMD ["python", "/app/server.py"]
