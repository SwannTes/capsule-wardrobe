"use client";

import { useRef, useState } from "react";

export type Pt = { x: number; y: number };

/**
 * 手绘圈选：按住沿单品边缘画一个闭合圈。
 * 圈出的区域送去抠图，圈外像素一律抹掉——贴着轮廓画，
 * 连衣架这种与衣服相连的杂件也能切掉。
 */
export default function LassoStep({
  imageUrl,
  onConfirm,
  onRetake,
}: {
  imageUrl: string;
  onConfirm: (payload: { cropped: Blob; polygon: Pt[] }) => void;
  onRetake: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);

  const closed = !drawing && points.length > 2;

  function toLocal(e: React.PointerEvent): Pt {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height),
    };
  }

  function start(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    setPoints([toLocal(e)]);
  }

  function move(e: React.PointerEvent) {
    if (!drawing) return;
    const p = toLocal(e);
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) return prev;
      return [...prev, p];
    });
  }

  function end() {
    setDrawing(false);
  }

  async function handleConfirm() {
    const img = imgRef.current;
    if (!img || !box || points.length < 3) return;
    setBusy(true);
    try {
      // 显示坐标 → 原图像素坐标
      const scale = img.naturalWidth / box.w;
      const pts = points.map((p) => ({ x: p.x * scale, y: p.y * scale }));

      // 圈选包围盒裁出局部区域。注意边距要给足：抠图模型需要看到主体
      // 周围的背景才敢下判断，贴边裁会让它信心不足、输出全透明；
      // 多带进来的杂物无所谓，反正圈外像素最后都会被蒙版抹掉
      const pad = Math.round(Math.max(
        24,
        Math.max(
          Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
          Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
        ) * 0.18,
      ));
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const bx = Math.max(0, Math.min(...xs) - pad);
      const by = Math.max(0, Math.min(...ys) - pad);
      const bw = Math.min(img.naturalWidth, Math.max(...xs) + pad) - bx;
      const bh = Math.min(img.naturalHeight, Math.max(...ys) + pad) - by;

      // 直接缩到 ≤1024：模型推理更快，后续无需再缩放
      const s = Math.min(1, 1024 / Math.max(bw, bh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bw * s);
      canvas.height = Math.round(bh * s);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, bx, by, bw, bh, 0, 0, canvas.width, canvas.height);
      const polygon = pts.map((p) => ({ x: (p.x - bx) * s, y: (p.y - by) * s }));

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("图片编码失败"))),
          "image/png",
        ),
      );
      onConfirm({ cropped: blob, polygon });
    } finally {
      setBusy(false);
    }
  }

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const outsidePath =
    box && closed
      ? `M0 0H${box.w}V${box.h}H0Z ` +
        points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") +
        " Z"
      : "";

  return (
    <div className="py-8">
      <p className="text-center text-xs leading-6 text-muted">
        按住沿单品边缘画一圈，把它圈出来。
        <br />
        圈外的杂物（包、衣架、挂钩）都会被去掉。
      </p>
      <div className="mt-6 flex justify-center">
        <div className="relative inline-block border border-line bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="待圈选的照片"
            draggable={false}
            className="block max-h-[55vh] max-w-full select-none"
            onLoad={(e) => {
              const el = e.currentTarget;
              setBox({ w: el.clientWidth, h: el.clientHeight });
            }}
          />
          {box && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${box.w} ${box.h}`}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              {outsidePath && (
                <path
                  d={outsidePath}
                  fill="rgba(250,249,247,0.65)"
                  fillRule="evenodd"
                />
              )}
              {points.length > 1 && (
                <polyline
                  points={polyline}
                  fill={closed ? "rgba(220,38,38,0.06)" : "none"}
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          )}
        </div>
      </div>
      <div className="mt-8 flex items-center justify-center gap-6">
        <button
          onClick={onRetake}
          className="px-6 py-3 text-xs tracking-[0.2em] text-muted transition-colors hover:text-ink"
        >
          重选
        </button>
        <button
          onClick={() => setPoints([])}
          disabled={points.length === 0}
          className="px-6 py-3 text-xs tracking-[0.2em] text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          重画
        </button>
        <button
          onClick={handleConfirm}
          disabled={!closed || busy}
          className="border border-ink px-10 py-3 text-xs tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          开始抠图
        </button>
      </div>
    </div>
  );
}
