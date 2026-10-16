/**
 * 抠图后处理。
 */

/** 手绘圈选蒙版：多边形以外的像素一律置为透明（destination-in 抗锯齿边缘）。 */
export async function applyPolygonMask(
  blob: Blob,
  polygon: { x: number; y: number }[],
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  polygon.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.fill();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
      "image/png",
    ),
  );
}

/** 估算不透明像素（alpha > 125）占比，用于识别模型"全透明"的翻车结果。 */
export async function opaqueRatio(blob: Blob): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 125) opaque++;
  }
  return opaque / (canvas.width * canvas.height);
}

/** 只保留最大的连通区域，把不与主体相连的杂件（碎屑等）的 alpha 置 0。 */

export async function keepLargestComponent(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const n = w * h;
  const ALPHA_MIN = 16;
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);

  let bestLabel = -1;
  let bestSize = 0;
  let label = 0;

  for (let start = 0; start < n; start++) {
    if (labels[start] !== -1 || data[start * 4 + 3] <= ALPHA_MIN) continue;
    // BFS 标记一个连通域
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    let size = 0;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      // 4 邻接
      if (x > 0) tryPush(p - 1);
      if (x < w - 1) tryPush(p + 1);
      if (y > 0) tryPush(p - w);
      if (y < h - 1) tryPush(p + w);
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
    label++;

    function tryPush(q: number) {
      if (labels[q] === -1 && data[q * 4 + 3] > ALPHA_MIN) {
        labels[q] = label;
        stack[sp++] = q;
      }
    }
  }

  if (bestLabel === -1) return blob; // 没有有效前景，原样返回

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1 && labels[i] !== bestLabel) {
      data[i * 4 + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
      "image/png",
    ),
  );
}
