FROM python:3.10-slim

WORKDIR /app

# Install build dependencies for lxml and newspaper3k
RUN apt-get update && apt-get install -y \
    gcc \
    libxml2-dev \
    libxslt-dev \
    zlib1g-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# PyTorch CPU-only (GPU sürümü ~2 GB, CPU sürümü ~250 MB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Install NLTK punkt which is required by newspaper3k
RUN python -m nltk.downloader punkt
RUN python -m nltk.downloader punkt_tab

COPY . .

CMD ["python", "daily_bist_news_job.py"]
