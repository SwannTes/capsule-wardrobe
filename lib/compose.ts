import type { WardrobeItem } from "./types";

/**
 * 搭配出图：把几件单品排版到白底画布，底部带合并色卡，
 * 仿日系杂志平铺图。画布逻辑尺寸 1200×1500。
 *
 * 拆成 layoutOutfit（算位置）+ drawOutfit（画）两层，
 * 供 OutfitCanvas 拖动后实时重绘；composeOutfitImage 是一次性出图。
 */

export const OUTFIT_W = 1200;
export const OUTFIT_H = 1500;

export type Placement = { x: number; y: number; w: number; h: number };

/** [x, y, w] 相对画布宽度的比例，按件数给固定杂志式布局 */
const LAYOUTS: Record<number, [number, number, number][]> = {
  1: [[0.24, 0.08, 0.52]],
  2: [
    [0.07, 0.05, 0.44],
    [0.51, 0.16, 0.42],
  ],
  3: [
    [0.06, 0.04, 0.42],
    [0.5, 0.1, 0.44],
    [0.6, 0.58, 0.26],
  ],
  4: [
    [0.06, 0.04, 0.4],
    [0.52, 0.08, 0.4],
    [0.1, 0.52, 0.28],
    [0.58, 0.56, 0.28],
  ],
};

function gridLayout(n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return [0.06 + col * 0.46, 0.05 + row * 0.26, 0.42];
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Supabase 存储带 CORS *，画布才能导出
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** 合并几件单品的色卡，去掉近似的重复色，最多 10 个 */
export function mergeColors(items: WardrobeItem[]): string[] {
  const out: string[] = [];
  const dist = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const item of items) {
    for (const c of item.colors) {
      if (out.some((o) => dist(hex2rgb(o), hex2rgb(c)) < 32)) continue;
      out.push(c);
      if (out.length >= 10) return out;
    }
  }
  return out;
}

/** 加载单品图并计算初始摆放位置 */
export async function layoutOutfit(
  items: WardrobeItem[],
): Promise<{ imgs: HTMLImageElement[]; placements: Placement[] }> {
  const imgs = await Promise.all(items.map((i) => loadImage(i.image_url)));
  const layout = LAYOUTS[items.length] ?? gridLayout(items.length);
  const maxH = OUTFIT_H * 0.42;

  const placements = imgs.map((img, i) => {
    const [fx, fy, fw] = layout[i];
    const w = fw * OUTFIT_W;
    let dw = w;
    let dh = w * (img.naturalHeight / img.naturalWidth);
    if (dh > maxH) {
      dh = maxH;
      dw = dh * (img.naturalWidth / img.naturalHeight);
    }
    return { x: fx * OUTFIT_W + (w - dw) / 2, y: fy * OUTFIT_H, w: dw, h: dh };
  });
  return { imgs, placements };
}

/** 按当前位置把单品画到画布上（白底 + 底部色点排） */
export function drawOutfit(
  canvas: HTMLCanvasElement,
  imgs: HTMLImageElement[],
  placements: Placement[],
  items: WardrobeItem[],
  withDots = true,
): void {
  canvas.width = OUTFIT_W;
  canvas.height = OUTFIT_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, OUTFIT_W, OUTFIT_H);

  imgs.forEach((img, i) => {
    const p = placements[i];
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
  });

  // 色点排（左下，贴近底边——与弹窗里"删除这件单品"同一水平位）
  if (withDots) {
    const colors = mergeColors(items);
    const dotR = 16;
    const gap = 42;
    const x0 = OUTFIT_W * 0.07;
    const y = OUTFIT_H * 0.955;
    colors.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(x0 + i * gap, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }
}

/** 一次性出图（导出/入库用） */
export async function composeOutfitImage(
  items: WardrobeItem[],
  { withDots = true }: { withDots?: boolean } = {},
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const { imgs, placements } = await layoutOutfit(items);
  drawOutfit(canvas, imgs, placements, items, withDots);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("出图失败"))),
      "image/png",
    ),
  );
}
