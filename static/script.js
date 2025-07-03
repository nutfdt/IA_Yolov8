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
const descriptionDiv = document.getElementById("description");
let lastFaceBoxes = [];
const MARGIN = 30; // marge en pixels autour du visage
let brasLeve = false;
let brasLeveBouteille = false;
let brasLeveScissors = false;
let lastPoses = [];
function drawVideoLoop() {
    if (video.readyState === 4) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        // Flouter les visages détectés avec une marge
        lastFaceBoxes.forEach(([x1, y1, x2, y2]) => {
            const nx1 = Math.max(0, x1 - MARGIN);
            const ny1 = Math.max(0, y1 - MARGIN);
            const nx2 = Math.min(canvas.width, x2 + MARGIN);
            const ny2 = Math.min(canvas.height, y2 + MARGIN);
            blurRect(ctx, nx1, ny1, nx2 - nx1, ny2 - ny1);
        });
    }
    requestAnimationFrame(drawVideoLoop);
}
// Fonction pour flouter une zone du canvas
function blurRect(ctx, x, y, w, h) {
    try {
        // Copier la zone à flouter
        const imageData = ctx.getImageData(x, y, w, h);
        // Créer un canvas temporaire
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        // Appliquer un flou CSS (plus rapide que JS pur)
        tempCtx.filter = 'blur(12px)';
        tempCtx.drawImage(tempCanvas, 0, 0);
        // Remettre la zone floutée sur le canvas principal
        ctx.drawImage(tempCanvas, x, y);
    } catch (e) {
        // Ignore les erreurs sur les bords
    }
}
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
                    lastFaceBoxes = data.faces || [];
                    brasLeve = data.bras_leve || false;
                    brasLeveBouteille = data.bras_leve_bottle || false;
                    brasLeveScissors = data.bras_leve_scissors || false;
                    lastPoses = data.poses || [];
                    // Affichage de la description physique
                    if (data.description) {
                        descriptionDiv.innerHTML = buildDescription(
                            data.description, brasLeve, brasLeveBouteille, brasLeveScissors, data.knife_detected
                        );
                    } else {
                        descriptionDiv.innerHTML = '';
                    }
                    // Statut simple (nombre de visages)
                    statusText.textContent = `Visages détectés : ${lastFaceBoxes.length}`;
                    statusText.style.background = "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)";
                    statusText.style.color = "#fff";
                })
                .catch((err) => {
                    console.error("Erreur API :", err);
                    statusText.textContent = "Erreur lors de la détection.";
                });
        }, "image/jpeg");
    }, 1000);
}
function getAgeRange(age) {
    if (!age || isNaN(age)) return '';
    age = parseInt(age);
    if (age < 13) return 'enfant';
    if (age < 20) return '14-19 ans';
    if (age < 30) return '20-29 ans';
    if (age < 40) return '30-39 ans';
    if (age < 50) return '40-49 ans';
    if (age < 60) return '50-59 ans';
    if (age < 70) return '60-69 ans';
    return '70 ans et +';
}
function buildDescription(desc, brasLeve, brasLeveBouteille, brasLeveScissors, knifeDetected) {
    let html = `<strong>Description :</strong><br>`;
    if (desc.gender && typeof desc.gender === 'string') html += `${desc.gender}, `;
    if (desc.age) html += `Tranche d'âge : ${getAgeRange(desc.age)}<br>`;
    if (desc.cheveux) html += `Cheveux/teint : ${desc.cheveux}<br>`;
    if (desc.lunettes) html += `Lunettes<br>`;
    if (desc.barbe) html += `Barbe<br>`;
    if (desc.couleur_haut) html += `Haut : ${desc.couleur_haut}<br>`;
    if (desc.dominant_emotion) html += `Émotion : ${desc.dominant_emotion}<br>`;
    if (desc.error) html += `<span style='color:red'>Erreur analyse visage</span><br>`;
    // Ajout des messages d'alerte/détection
    if (knifeDetected) {
        html += `<div style='color:#fff; background:#ff1744; border-radius:8px; padding:6px 12px; margin-top:10px; font-weight:bold;'>⚠️ COUTEAU DÉTECTÉ !</div>`;
    } else if (brasLeveBouteille) {
        html += `<div style='color:#fff; background:#ff9800; border-radius:8px; padding:6px 12px; margin-top:10px; font-weight:bold;'>Bras levé + bouteille détectée !</div>`;
    } else if (brasLeveScissors) {
        html += `<div style='color:#fff; background:#7c3aed; border-radius:8px; padding:6px 12px; margin-top:10px; font-weight:bold;'>Bras levé + ciseaux détectés !</div>`;
    } else if (brasLeve) {
        html += `<div style='color:#fff; background:#00c853; border-radius:8px; padding:6px 12px; margin-top:10px; font-weight:bold;'>Bras levé !</div>`;
    }
    return html;
}
document.addEventListener("DOMContentLoaded", () => {
    initWebcam();
});
