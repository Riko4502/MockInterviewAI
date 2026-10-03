import type { Area } from "react-easy-crop";

const OUTPUT_SIZE = 400;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => {
      reject(new Error("Failed to load image"));
    });
    image.src = src;
  });
}

/**
 * Вырезает выбранную область и возвращает квадратный JPEG для загрузки аватара.
 */
export async function getCroppedImageFile(
  imageSrc: string,
  crop: Area,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Failed to crop image"));
      },
      "image/jpeg",
      0.92,
    );
  });

  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
