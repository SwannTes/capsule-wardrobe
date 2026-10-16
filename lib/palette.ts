/**
 * 图片缩放与色卡提取（全部在浏览器本地完成）。
 */

/** 把抠图结果缩到最长边 maxSize，输出透明底 PNG，减小上传体积。 */
export async function downscale(blob: Blob, maxSize: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
      "image/png",
    ),
  );
}

/**
 * 用 Color Thief 从抠图结果里提取主色调。
 * - 透明背景：Color Thief 跳过 alpha < 125 的像素，不污染色卡；
 * - 近白像素：不过滤（ignoreWhite: false），否则白色单品取不到色；
 * - 幻影色：MMCQ 在真实色数少于 colorCount 时会返回空盒中点的编造色，
 *   所以最后用真实像素校验一遍，丢掉不贴近任何像素的色，再去重。
 */
export async function extractPalette(blob: Blob, count: number): Promise<string[]> {
  const ColorThief = (await import("colorthief")).default;

  const bitmap = await createImageBitmap(blob);
  // 提取色卡用小图即可，速度快且结果更稳定
  const size = 200;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();

  const thief = new ColorThief();
  const palette =
    thief.getPalette(canvas, { colorCount: count, ignoreWhite: false }) ?? [];

  // 抽样真实前景像素，用于校验
  const pixels = ctx.getImageData(0, 0, size, size).data;
  const samples: [number, number, number][] = [];
  for (let i = 0; i < pixels.length; i += 4 * 5) {
    if (pixels[i + 3] < 125) continue;
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  const dist = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // 幻影色判定：真色周围应聚集相当数量的像素；幻影色（空盒中点）四周几乎没有像素
  const minVotes = Math.max(3, samples.length * 0.002);
  const real = palette.filter(
    (c) => samples.filter((s) => dist(c, s) < 30).length >= minVotes,
  );
  const deduped: [number, number, number][] = [];
  for (const c of real) {
    if (!deduped.some((d) => dist(c, d) < 32)) deduped.push(c);
  }
  // 兜底：极端情况下校验全空，就退回主色——但主色也得过票数校验，
  // 否则全透明图会得到假黑色 [0,0,0]
  if (deduped.length === 0) {
    const dominant = thief.getColor(canvas, { ignoreWhite: false });
    if (
      dominant &&
      samples.filter((s) => dist(dominant, s) < 30).length >= minVotes
    ) {
      deduped.push(dominant);
    }
  }

  return deduped.map(
    ([r, g, b]) =>
      "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
  );
}
