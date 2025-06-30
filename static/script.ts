const clientId: string =
  prompt("Entrez l'identifiant de cette caméra (ex: cam1, posteB)") || "unknown";

const video: HTMLVideoElement = document.getElementById("video") as HTMLVideoElement;
const canvas: HTMLCanvasElement = document.getElementById("canvas") as HTMLCanvasElement;
const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
const statusText: HTMLElement = document.getElementById("status")!;

interface Detection {
  label: string;
  confidence: string;
  bbox: [number, number, number, number];
}

// Demander l'autorisation et gérer le flux webcam
async function initWebcam(): Promise<void> {
  try {
    statusText.textContent = "Demande d'autorisation pour accéder à la webcam...";
    const stream: MediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    statusText.textContent = "Webcam connectée. Détection en cours...";
    startDetectionLoop();
  } catch (err) {
    console.error("Erreur d'accès à la webcam :", err);
    statusText.textContent = "Accès à la webcam refusé ou non disponible.";
    alert("L'accès à la webcam est nécessaire pour utiliser cette application.");
  }
}

// Capture et envoi d'image toutes les secondes
function startDetectionLoop(): void {
  setInterval(() => {
    if (video.readyState !== 4) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob: Blob | null) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("image", blob, "frame.jpg");
        formData.append("client_id", clientId);

        fetch("http://127.0.0.1:5000/detect", {
          method: "POST",
          body: formData,
        })
          .then((res: Response) => res.json())
          .then((data: Detection[]) => {
            ctx.drawImage(video, 0, 0);
            data.forEach((obj: Detection) => {
              const [x1, y1, x2, y2] = obj.bbox;
              ctx.strokeStyle = "red";
              ctx.lineWidth = 2;
              ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
              ctx.fillStyle = "red";
              ctx.font = "14px Arial";
              ctx.fillText(
                `${obj.label} (${obj.confidence})`,
                x1 + 4,
                y1 + 14
              );
            });
            statusText.textContent = `Détections : ${data.length}`;
          })
          .catch((err: Error) => {
            console.error("Erreur API :", err);
            statusText.textContent = "Erreur lors de la détection.";
          });
      },
      "image/jpeg"
    );
  }, 1000);
}

// Lancer l'initialisation de la webcam au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  initWebcam();
}); 