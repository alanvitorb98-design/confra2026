FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends build-essential g++ && rm -rf /var/lib/apt/lists/*

# Hugging Face runs Docker Spaces as user 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONUNBUFFERED=1
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# download the model while building, so the first photo after a wake-up doesn't wait for it
COPY --chown=user app.py .
RUN python -c "import app; app.load_model()"

EXPOSE 7860
CMD ["python", "app.py"]
