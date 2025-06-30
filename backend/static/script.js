var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const clientId = prompt("Entrez l'identifiant de cette caméra (ex: cam1, posteB)") || "unknown";
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");
let lastDetections = [];
function drawVideoLoop() {
    if (video.readyState === 4) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        // Dessiner les détections par-dessus la vidéo
        lastDetections.forEach((obj) => {
            const [x1, y1, x2, y2] = obj.bbox;
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            ctx.fillStyle = "red";
            ctx.font = "14px Arial";
            ctx.fillText(`${obj.label} (${obj.confidence})`, x1 + 4, y1 + 14);
        });
    }
    requestAnimationFrame(drawVideoLoop);
}
// Demander l'autorisation et gérer le flux webcam
async function initWebcam() {
    try {
        statusText.textContent = "Demande d'autorisation pour accéder à la webcam...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        statusText.textContent = "Webcam connectée. Détection en cours...";
        video.onloadedmetadata = () => {
            drawVideoLoop();
        };
        startDetectionLoop();
    }
    catch (err) {
        console.error("Erreur d'accès à la webcam :", err);
        statusText.textContent = "Accès à la webcam refusé ou non disponible.";
        alert("L'accès à la webcam est nécessaire pour utiliser cette application.");
    }
}
// Capture et envoi d'image toutes les secondes
function startDetectionLoop() {
    setInterval(() => {
        if (video.readyState !== 4)
            return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
            if (!blob)
                return;
            const formData = new FormData();
            formData.append("image", blob, "frame.jpg");
            formData.append("client_id", clientId);
            fetch("/detect", {
                method: "POST",
                body: formData,
            })
                .then((res) => res.json())
                .then((data) => {
                    lastDetections = data;
                    statusText.textContent = `Détections : ${data.length}`;
                })
                .catch((err) => {
                    console.error("Erreur API :", err);
                    statusText.textContent = "Erreur lors de la détection.";
                });
        }, "image/jpeg");
    }, 1000);
}
// Lancer l'initialisation de la webcam au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    initWebcam();
});
