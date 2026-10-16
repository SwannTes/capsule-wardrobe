"use client";

import { useState } from "react";
import type { WardrobeItem } from "@/lib/types";
import ItemModal from "./ItemModal";

export default function WardrobeGrid({ items }: { items: WardrobeItem[] }) {
  const [selected, setSelected] = useState<WardrobeItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="group text-left"
          >
            <div className="flex aspect-[3/4] items-center justify-center border border-line bg-card p-5 transition-shadow group-hover:shadow-[0_10px_32px_rgba(0,0,0,0.07)]">
              {/* 单品图为透明底 PNG，直接落在白卡上，类似日系画册排版 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt={item.name || "单品"}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="truncate text-[12.5px]">{item.name || "未命名"}</p>
              <p className="shrink-0 text-[12.5px] text-muted">
                {new Date(item.created_at).toLocaleDateString("zh-CN")}
              </p>
            </div>
            <div className="mt-2 flex gap-1.5">
              {item.colors.slice(0, 5).map((c) => (
                <span
                  key={c}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <ItemModal item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
