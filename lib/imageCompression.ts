"use client";

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("ไม่สามารถบีบอัดรูปได้"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("อ่านรูปไม่สำเร็จ"));
      }
    };
    reader.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

export async function compressImageToDataUrl(
  file: File,
  maxBytes = 500 * 1024
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("ไฟล์ต้องเป็นรูปภาพ");
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("เบราว์เซอร์ไม่รองรับการบีบอัดรูป");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const qualitySteps = [0.82, 0.72, 0.62, 0.52, 0.42];
  let bestBlob = await canvasToBlob(canvas, "image/jpeg", qualitySteps[0]);

  for (const quality of qualitySteps) {
    const nextBlob = await canvasToBlob(canvas, "image/jpeg", quality);
    bestBlob = nextBlob;

    if (nextBlob.size <= maxBytes) {
      break;
    }
  }

  if (bestBlob.size > maxBytes) {
    throw new Error("รูปยังใหญ่เกิน 500KB หลังบีบอัด");
  }

  return blobToDataUrl(bestBlob);
}
