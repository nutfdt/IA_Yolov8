from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
from PIL import Image
import io
import os
import logging
from collections import Counter
import numpy as np

app = Flask(__name__)
face_model = YOLO("yolov8n-face.pt")
pose_model = YOLO("yolov8n-pose.pt")
object_model = YOLO("yolov8n.pt")

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
        return {"error": "Aucune image reçue"}, 400

    image = Image.open(io.BytesIO(file.read())).convert("RGB")
    # Détection visages
    face_results = face_model(image, verbose=False)[0]
    face_boxes = []
    for r in face_results.boxes.data.tolist():
        x1, y1, x2, y2, conf, cls = r
        label = face_model.names[int(cls)]
        if label.lower() == "face":
            face_boxes.append([int(x1), int(y1), int(x2), int(y2)])

    # Détection pose
    pose_results = pose_model(image, verbose=False)[0]
    pose_keypoints = []
    for kp in pose_results.keypoints.xy:
        pose_keypoints.append(kp.tolist())

    # Détection objets
    object_results = object_model(image, verbose=False)[0]
    object_boxes = []
    for r in object_results.boxes.data.tolist():
        x1, y1, x2, y2, conf, cls = r
        label = object_model.names[int(cls)]
        object_boxes.append({
            "label": label,
            "bbox": [int(x1), int(y1), int(x2), int(y2)]
        })

    # Couleur dominante du haut (vêtements)
    # (SUPPRIMÉ) couleur_haut, couleur_haut_nom, description

    TOLERANCE = 100  # pixels
    bras_leve = False
    bras_leve_bottle = False
    bras_leve_scissors = False
    bras_leve_cellphone = False
    for kp in pose_results.keypoints.xy:
        x_shoulder_g, y_shoulder_g = kp[5]
        x_wrist_g, y_wrist_g = kp[7]
        x_shoulder_d, y_shoulder_d = kp[6]
        x_wrist_d, y_wrist_d = kp[8]
        if y_wrist_g < y_shoulder_g or y_wrist_d < y_shoulder_d:
            bras_leve = True
            for obj in object_boxes:
                x1, y1, x2, y2 = obj["bbox"]
                if obj["label"] == "bottle":
                    if (x1-TOLERANCE <= x_wrist_g <= x2+TOLERANCE and y1-TOLERANCE <= y_wrist_g <= y2+TOLERANCE) or \
                       (x1-TOLERANCE <= x_wrist_d <= x2+TOLERANCE and y1-TOLERANCE <= y_wrist_d <= y2+TOLERANCE):
                        bras_leve_bottle = True
                if obj["label"] == "scissors":
                    if (x1-TOLERANCE <= x_wrist_g <= x2+TOLERANCE and y1-TOLERANCE <= y_wrist_g <= y2+TOLERANCE) or \
                       (x1-TOLERANCE <= x_wrist_d <= x2+TOLERANCE and y1-TOLERANCE <= y_wrist_d <= y2+TOLERANCE):
                        bras_leve_scissors = True
                if obj["label"] == "cell phone":
                    if (x1-TOLERANCE <= x_wrist_g <= x2+TOLERANCE and y1-TOLERANCE <= y_wrist_g <= y2+TOLERANCE) or \
                       (x1-TOLERANCE <= x_wrist_d <= x2+TOLERANCE and y1-TOLERANCE <= y_wrist_d <= y2+TOLERANCE):
                        bras_leve_cellphone = True
            break

    knife_detected = False
    for obj in object_boxes:
        if obj["label"].lower() == "knife":
            knife_detected = True
            break

    return jsonify({
        "faces": face_boxes,
        "bras_leve": bras_leve,
        "bras_leve_bottle": bras_leve_bottle,
        "bras_leve_scissors": bras_leve_scissors,
        "bras_leve_cellphone": bras_leve_cellphone,
        "poses": pose_keypoints,
        "knife_detected": knife_detected
    })

def rgb_to_name(rgb):
    # Dictionnaire simple de couleurs de base (français)
    colors = {
        (0,0,0): "noir",
        (255,255,255): "blanc",
        (255,0,0): "rouge",
        (0,255,0): "vert",
        (0,0,255): "bleu",
        (255,255,0): "jaune",
        (255,165,0): "orange",
        (128,0,128): "violet",
        (165,42,42): "marron",
        (128,128,128): "gris",
        (255,192,203): "rose",
        (210,180,140): "beige"
    }
    # Trouver la couleur la plus proche
    def dist(c1, c2):
        return sum((a-b)**2 for a,b in zip(c1,c2))
    min_dist = float('inf')
    closest = None
    for base, name in colors.items():
        d = dist(rgb, base)
        if d < min_dist:
            min_dist = d
            closest = name
    return closest

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
