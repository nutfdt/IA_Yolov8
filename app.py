from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
from PIL import Image
import io
import os
import datetime
import logging

app = Flask(__name__)
model = YOLO("yolov8n.pt")

# Configuration du logger
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    filename="logs/detection.log",
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/detect", methods=["POST"])
def detect():
    file = request.files.get("image")
    client_id = request.form.get("client_id", "unknown")

    if not file:
        return jsonify({"error": "Aucune image reçue"}), 400

    image = Image.open(io.BytesIO(file.read())).convert("RGB")
    results = model(image, verbose=False)[0]

    detections = []
    for r in results.boxes.data.tolist():
        x1, y1, x2, y2, conf, cls = r
        label = model.names[int(cls)]
        detections.append({
            "label": label,
            "confidence": f"{conf:.2f}",
            "bbox": [int(x1), int(y1), int(x2), int(y2)]
        })

    logging.info(f"{client_id} - {len(detections)} détections - {[d['label'] for d in detections]}")

    return jsonify(detections)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
