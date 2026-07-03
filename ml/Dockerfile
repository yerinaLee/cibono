FROM python:3.8.20-slim

WORKDIR /app

# AVX 미지원 CPU 방어용 (단독으로는 크래시를 막지 못함이 확인됐지만, torch 다운그레이드와 함께 부작용 없이 추가)
ENV DNNL_MAX_CPU_ISA=SSE41
ENV ATEN_CPU_CAPABILITY=default

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    patch build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# 이 NAS(Celeron J4125)는 AVX 미지원이라 PyPI 기본 paddlepaddle(AVX 필요)이 즉시 크래시함.
# PaddlePaddle 공식 noavx 빌드는 Python 3.8(cp38)까지만, 2.4.2까지만 제공되어 base 이미지를 3.8로 고정.
# torch도 2.x 공식 CPU wheel은 AVX2를 최소 요구사항으로 가정함 (PyTorch #94021).
# 특히 easyocr가 기본값(quantize=True)으로 쓰는 FBGEMM 기반 quantized LSTM이 AVX 전용이라 SIGILL 발생 (EasyOCR #1174).
# PyTorch는 paddle과 달리 공식 noavx 빌드가 없어, 이 문제가 없던 구버전(1.8.1)으로 다운그레이드해서 회피.
RUN pip install --no-cache-dir --no-deps paddlepaddle==2.4.2 --no-index -f https://www.paddlepaddle.org.cn/whl/linux/openblas/noavx/stable.html \
    && pip install --no-cache-dir torch==1.8.1+cpu torchvision==0.9.1+cpu -f https://download.pytorch.org/whl/torch_stable.html \
    && pip install --no-cache-dir -r requirements.txt

COPY best.pt server.py ./

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
