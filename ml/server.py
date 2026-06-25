import os
os.environ['FLAGS_use_mkldnn'] = '0'  # PaddlePaddle Windows oneDNN 버그 우회

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
import cv2
import easyocr
from ultralytics import YOLO
import io
import os
import base64
import uuid
import time
import requests
from concurrent.futures import ThreadPoolExecutor

app = FastAPI()

model = YOLO("best.pt")

# EasyOCR (기존)
easy_reader = easyocr.Reader(["ko", "en"], gpu=False)

# PaddleOCR (Option A) — 첫 실행 시 모델 다운로드 (~500MB)
try:
    from paddleocr import PaddleOCR
    _model_base = os.path.join(os.path.dirname(__file__), "korie_model")
    _rec_model = os.path.join(_model_base, "inference")
    _rec_dict  = os.path.join(_model_base, "korie_dict.txt")
    if os.path.exists(_rec_model):
        try:
            paddle_reader = PaddleOCR(
                use_angle_cls=True,
                rec_model_dir=_rec_model,
                rec_char_dict_path=_rec_dict,
                use_space_char=True,
                use_gpu=False,
            )
            print("[server] PaddleOCR KORIE fine-tuned 모델 로드")
        except Exception as inner_e:
            print(f"[server] KORIE 모델 로드 실패 ({inner_e}), 표준 Korean 모델로 폴백")
            paddle_reader = PaddleOCR(use_angle_cls=True, lang="korean", use_gpu=False)
            print("[server] PaddleOCR 표준 Korean 모델 로드")
    else:
        paddle_reader = PaddleOCR(use_angle_cls=True, lang="korean", use_gpu=False)
        print("[server] PaddleOCR 기본 한국어 모델 로드 (korie_model 폴더 없음)")
    PADDLE_AVAILABLE = True
    print("[server] PaddleOCR 초기화 완료")
except Exception as e:
    paddle_reader = None
    PADDLE_AVAILABLE = False
    print(f"[server] PaddleOCR 미설치 — EasyOCR 폴백: {e}")

# Naver CLOVA OCR (Option B) — 환경변수로 설정
CLOVA_API_URL = os.getenv("CLOVA_API_URL", "")
CLOVA_SECRET_KEY = os.getenv("CLOVA_SECRET_KEY", "")

TARGET_CLASSES = {"Item", "Price", "Quantity", "TotalPrice", "Total"}


def preprocess_for_ocr(img: np.ndarray) -> np.ndarray:
    """KORIE 논문 방식: grayscale → CLAHE → 업스케일 → 노이즈제거 → 샤프닝"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    if h < 1500:
        scale = 1500 / h
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    denoised = cv2.fastNlMeansDenoising(enhanced, h=10)
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(denoised, -1, kernel)
    return cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)


def sort_by_reading_order(boxes: list) -> list:
    """위→아래, 좌→우 읽기 순서 정렬 (같은 줄 그룹핑 후 x순)"""
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    lines, current_line = [], [boxes[0]]
    current_y = (boxes[0][1] + boxes[0][3]) / 2
    for box in boxes[1:]:
        box_y = (box[1] + box[3]) / 2
        box_h = max(box[3] - box[1], 1)
        if abs(box_y - current_y) < box_h * 0.7:
            current_line.append(box)
        else:
            lines.append(sorted(current_line, key=lambda b: b[0]))
            current_line = [box]
            current_y = box_y
    lines.append(sorted(current_line, key=lambda b: b[0]))
    return [b for line in lines for b in line]


def cross_class_nms(boxes: list, iou_thr: float = 0.5) -> list:
    """클래스 무관 NMS: 신뢰도 높은 박스 우선, 겹치는 박스 제거"""
    boxes = sorted(boxes, key=lambda b: b[4], reverse=True)
    kept = []
    while boxes:
        best = boxes.pop(0)
        kept.append(best)
        def _iou(a, b):
            ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
            ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            ua = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
            return inter / max(ua, 1e-6)
        boxes = [b for b in boxes if _iou(best, b) < iou_thr]
    return kept


def ocr_crop(crop: np.ndarray, engine: str = "paddle", det: bool = True) -> str:
    """크롭 이미지에서 텍스트 추출.
    det=True : 내부 text detection 포함 (전체 이미지용)
    det=False: 인식만 (YOLO crop용 — 이미 위치가 확정된 경우)
    """
    if engine == "paddle" and PADDLE_AVAILABLE:
        try:
            result = paddle_reader.ocr(crop, det=det, rec=True, cls=True)
            if not result:
                return ""
            if det:
                # det=True: [[[bbox, (text, score)], ...]]
                if not result[0]:
                    return ""
                return " ".join(line[1][0] for line in result[0] if line and len(line) >= 2)
            else:
                # det=False: [[(text, score), ...]]  outer=page, inner=recognitions
                if not result or not result[0]:
                    return ""
                return " ".join(item[0] for item in result[0] if item and len(item) >= 1)
        except Exception as e:
            print(f"[PaddleOCR] 오류: {e}")
            return ""
    else:
        return " ".join(easy_reader.readtext(crop, detail=0)).strip()


def _paddle_ocr_single(crop: np.ndarray) -> str:
    """병렬 처리용 단일 crop PaddleOCR (각도 분류 생략으로 속도 향상)"""
    try:
        result = paddle_reader.ocr(crop, det=False, rec=True, cls=False)
        if result and result[0]:
            return " ".join(item[0] for item in result[0] if item and len(item) >= 1).strip()
    except Exception:
        pass
    return ""


def run_yolo_ocr(img: np.ndarray, engine: str) -> list:
    results = model(img)[0]
    detections = []
    for box in results.boxes:
        class_name = model.names[int(box.cls)]
        if class_name not in TARGET_CLASSES:
            continue
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        crop = img[y1:y2, x1:x2]
        text = ocr_crop(crop, engine=engine, det=False)
        detections.append({
            "class": class_name,
            "text": text,
            "confidence": float(box.conf),
        })
    return detections


# ── 기존 엔드포인트 (EasyOCR 유지) ────────────────────────────
@app.post("/ocr")
async def ocr_easy(file: UploadFile = File(...)):
    contents = await file.read()
    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    return JSONResponse({"engine": "easyocr", "detections": run_yolo_ocr(img, "easy")})


# ── Option A: YOLO + PaddleOCR ─────────────────────────────────
@app.post("/ocr/paddle")
async def ocr_paddle(file: UploadFile = File(...)):
    if not PADDLE_AVAILABLE:
        return JSONResponse({"error": "PaddleOCR 미설치. pip install paddlepaddle paddleocr"}, status_code=503)
    contents = await file.read()
    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    return JSONResponse({"engine": "paddleocr", "detections": run_yolo_ocr(img, "paddle")})


# ── Option C: PaddleOCR 전체 이미지 다이렉트 (YOLO 없음) ──────────
@app.post("/ocr/direct")
async def ocr_direct(file: UploadFile = File(...)):
    contents = await file.read()
    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)

    if PADDLE_AVAILABLE:
        result = paddle_reader.ocr(img, cls=True)
        lines = [line[1][0] for line in result[0] if line and len(line) >= 2] if result and result[0] else []
        engine = "paddleocr_direct"
    else:
        lines = easy_reader.readtext(img, detail=0)
        engine = "easyocr_direct"

    full_text = "\n".join(r for r in lines if r.strip())
    print(f"[DirectOCR] 전체 텍스트:\n{full_text}")

    return JSONResponse({
        "engine": engine,
        "detections": [{"class": "FullText", "text": full_text, "confidence": 1.0}],
    })


# ── KORIE 논문 파이프라인: 전처리 → YOLO 전체박스 → 읽기순서 → OCR ──────
@app.post("/ocr/korie")
async def ocr_korie(file: UploadFile = File(...)):
    contents = await file.read()
    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)

    # 1. 이미지 리사이즈 (YOLO/OCR 속도 향상, 최대 1920px)
    h, w = img.shape[:2]
    if max(h, w) > 1920:
        scale = 1920 / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 2. YOLO: 텍스트 박스 감지 (식재료 파싱 불필요 클래스 제외)
    # Price/TotalPrice/Quantity 포함 시 crop 34개 → 7.86s (일부 영수증에서 제품명이 Price로 분류될 수 있음)
    # KORIE_SKIP_CLASSES = {"ProductCode", "ReceiptNumber", "TransactionTime", "MerchantName", "Total", "Subtotal"}
    KORIE_SKIP_CLASSES = {"ProductCode", "ReceiptNumber", "TransactionTime", "MerchantName", "Total", "Subtotal", "Price", "TotalPrice", "Quantity"}
    t0 = time.time()
    results = model(img)[0]
    boxes = []
    for box in results.boxes:
        class_name = model.names[int(box.cls)]
        if class_name in KORIE_SKIP_CLASSES:
            continue
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf)
        if conf > 0.2:
            boxes.append((x1, y1, x2, y2, conf))
    print(f"[KORIE] YOLO 감지: {time.time() - t0:.2f}s")

    # 2. 클래스 무관 NMS (같은 영역 중복 박스 제거)
    boxes = cross_class_nms(boxes, iou_thr=0.5)

    # 3. 읽기 순서 정렬 (위→아래, 좌→우)
    boxes = sort_by_reading_order(boxes)
    print(f"[KORIE] 감지된 텍스트 박스: {len(boxes)}개")

    # 4. crop 수집 (읽기 순서 유지)
    engine = "paddle" if PADDLE_AVAILABLE else "easy"
    crops = [img[y1:y2, x1:x2] for x1, y1, x2, y2, _ in boxes
             if img[y1:y2, x1:x2].size > 0 and img[y1:y2, x1:x2].shape[0] >= 5]

    # 5. 순차 OCR (cls=False로 각도 분류 생략 → 속도 향상)
    t1 = time.time()
    texts = []
    if PADDLE_AVAILABLE and crops:
        for crop in crops:
            t = _paddle_ocr_single(crop)
            if t:
                texts.append(t)
    elif crops:
        texts = [t for crop in crops
                 if (t := ocr_crop(crop, engine="easy", det=False).strip())]
    print(f"[KORIE] OCR: {time.time() - t1:.2f}s ({len(crops)}개 crop)")

    full_text = "\n".join(texts)
    print(f"[KORIE] 전체 텍스트:\n{full_text}")

    return JSONResponse({
        "engine": f"korie_{engine}ocr",
        "detections": [{"class": "FullText", "text": full_text, "confidence": 1.0}],
    })


# ── Option B: Naver CLOVA OCR (전체 이미지, YOLO 없음) ─────────
@app.post("/ocr/clova")
async def ocr_clova(file: UploadFile = File(...)):
    if not CLOVA_API_URL or not CLOVA_SECRET_KEY:
        return JSONResponse({"error": "CLOVA_API_URL / CLOVA_SECRET_KEY 환경변수 미설정"}, status_code=503)

    contents = await file.read()
    ext = (file.filename or "receipt.jpg").rsplit(".", 1)[-1].lower()
    b64 = base64.b64encode(contents).decode("utf-8")

    payload = {
        "version": "V2",
        "requestId": str(uuid.uuid4()),
        "timestamp": int(time.time() * 1000),
        "images": [{"format": ext, "name": "receipt", "data": b64}],
    }
    resp = requests.post(
        CLOVA_API_URL,
        json=payload,
        headers={"X-OCR-SECRET": CLOVA_SECRET_KEY, "Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()

    fields = resp.json().get("images", [{}])[0].get("fields", [])
    full_text = "\n".join(f.get("inferText", "") for f in fields if f.get("inferText"))

    # Spring Boot YoloOcrService와 동일 포맷으로 반환 (class=FullText)
    return JSONResponse({
        "engine": "clova",
        "detections": [{"class": "FullText", "text": full_text, "confidence": 1.0}],
    })


@app.post("/ocr/korie/debug")
async def ocr_korie_debug(file: UploadFile = File(...)):
    contents = await file.read()
    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)

    h, w = img.shape[:2]
    if max(h, w) > 1920:
        scale = 1920 / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    results = model(img)[0]
    boxes = []
    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf)
        boxes.append((x1, y1, x2, y2, conf))

    # confidence 기준 정렬 (시각화용)
    boxes_sorted = sorted(boxes, key=lambda b: b[4], reverse=True)

    debug_img = img.copy()
    for x1, y1, x2, y2, conf in boxes_sorted:
        color = (0, 255, 0) if conf > 0.3 else (0, 0, 255)  # 초록=통과, 빨강=필터됨
        cv2.rectangle(debug_img, (x1, y1), (x2, y2), color, 2)
        cv2.putText(debug_img, f"{conf:.2f}", (x1, max(y1 - 4, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

    out_path = os.path.join(os.path.dirname(__file__), "debug_boxes.jpg")
    cv2.imwrite(out_path, debug_img)
    print(f"[DEBUG] 박스 시각화 저장: {out_path}")

    return JSONResponse({
        "total_boxes": len(boxes),
        "passed_threshold": sum(1 for b in boxes if b[4] > 0.3),
        "debug_image": out_path,
        "boxes": [
            {"x1": b[0], "y1": b[1], "x2": b[2], "y2": b[3], "conf": round(b[4], 3)}
            for b in boxes_sorted
        ],
    })


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
