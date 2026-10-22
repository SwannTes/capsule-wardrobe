"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  drawOutfit,
  layoutOutfit,
  OUTFIT_H,
  OUTFIT_W,
  type Placement,
} from "@/lib/compose";
import type { WardrobeItem } from "@/lib/types";

/**
 * 可交互搭配画布：单品可用鼠标/手指在白色背景内自由拖动，
 * 边界钳制在画布范围内，不会拖出去。
 */
export default function OutfitCanvas({
  items,
  canvasRef,
  onReady,
}: {
  items: WardrobeItem[];
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onReady: () => void;
}) {
  const [state, setState] = useState<{
    imgs: HTMLImageElement[];
    placements: Placement[];
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ idx: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    let alive = true;
    layoutOutfit(items).then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [items]);

  useEffect(() => {
    if (!state || !canvasRef.current) return;
    drawOutfit(canvasRef.current, state.imgs, state.placements, items, true);
    onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /** 显示坐标 → 画布逻辑坐标 */
  function toLogical(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * OUTFIT_W) / rect.width,
      y: ((e.clientY - rect.top) * OUTFIT_H) / rect.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!state) return;
    const p = toLogical(e);
    // 从顶层往下找被点中的单品
    for (let i = state.placements.length - 1; i >= 0; i--) {
      const pl = state.placements[i];
      if (p.x >= pl.x && p.x <= pl.x + pl.w && p.y >= pl.y && p.y <= pl.y + pl.h) {
        drag.current = { idx: i, dx: p.x - pl.x, dy: p.y - pl.y };
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        break;
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !state) return;
    const p = toLogical(e);
    const pl = state.placements[d.idx];
    // 钳制在画布范围内，拖不出白框
    const x = Math.min(Math.max(p.x - d.dx, 0), OUTFIT_W - pl.w);
    const y = Math.min(Math.max(p.y - d.dy, 0), OUTFIT_H - pl.h);
    const placements = state.placements.slice();
    placements[d.idx] = { ...pl, x, y };
    setState({ ...state, placements });
  }

  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <div className="relative flex items-center justify-center border border-line bg-card p-4">
      {!state && (
        <p className="py-24 text-[12px] tracking-[0.2em] text-muted">出图中……</p>
      )}
      <canvas
        ref={canvasRef}
        width={OUTFIT_W}
        height={OUTFIT_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`max-h-[84vh] max-w-full touch-none select-none ${
          state ? "" : "invisible absolute"
        } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      />
    </div>
  );
}
