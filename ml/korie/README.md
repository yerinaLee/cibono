# KORIE YOLO Training

This folder contains the YOLO dataset config for the KORIE Korean receipt detection dataset.

## Local dataset

The downloaded dataset is expected at:

```text
C:/Users/admin/Downloads/dataset
```

Detected split sizes:

```text
train: 464 images
val: 154 images
test: 156 images
classes: 17
```

The labels are already in YOLO format:

```text
class_id x_center y_center width height
```

## Recommended first training run

Use a GPU runtime, such as Google Colab or Kaggle.

```bash
pip install ultralytics
yolo detect train model=yolo11n.pt data=data.yaml imgsz=960 epochs=50 batch=8
```

For a slightly stronger run:

```bash
yolo detect train model=yolo11s.pt data=data.yaml imgsz=960 epochs=80 batch=8
```

## Project integration target

1. Train YOLO on KORIE key information detection labels.
2. Export `best.pt`.
3. Serve detection through a small Python/FastAPI inference service.
4. Crop detected regions and run OCR with ML Kit, PaddleOCR, or another OCR engine.
5. Send OCR text to the existing inventory parsing flow.

## Class mapping

The class names follow the entity schema listed in the KORIE repository:

```text
Description, Quantity, TotalPrice, Price, Item, MerchantName, Total,
Subtotal, TotalTax, TransactionDate, TransactionTime, Tip,
MerchantPhoneNumber, ReceiptNumber, MerchantAddress, Item_barcode,
ProductCode
```
