FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TASK_DB=/data/tasks.sqlite3
WORKDIR /app
RUN groupadd --gid 10001 workroom \
    && useradd --uid 10001 --gid workroom --no-create-home workroom \
    && mkdir /data && chown workroom:workroom /data
COPY server.py ./
COPY static/ ./static/
USER workroom
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=2).read()"
CMD ["python", "server.py", "--host", "0.0.0.0"]
