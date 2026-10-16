"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";

/** 穿搭库管理：列出全部已存穿搭图，两段式删除（数据库记录 + 存储文件） */
export default function OutfitLibrary({ onClose }: { onClose: () => void }) {
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setOutfits([]);
      return;
    }
    supabase
      .from("outfits")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setOutfits(error ? [] : ((data ?? []) as Outfit[]));
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDelete(o: Outfit) {
    if (confirmingId !== o.id) {
      setConfirmingId(o.id);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setDeletingId(o.id);
    try {
      const { error: dbErr } = await supabase
        .from("outfits")
        .delete()
        .eq("id", o.id);
      if (dbErr) throw dbErr;
      // 行删成功先更新界面；存储文件失败只记日志，不影响交互
      setOutfits((prev) => prev?.filter((x) => x.id !== o.id) ?? null);
      const path = o.image_url.split("/object/public/items/")[1];
      if (path) {
        supabase.storage
          .from("items")
          .remove([path])
          .then(({ error }) => error && console.error("删除图片文件失败", error));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-full max-w-2xl flex-col border border-line bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-[12px] tracking-[0.3em] text-muted">穿搭库</p>
          <button
            onClick={onClose}
            className="text-[12px] tracking-[0.2em] text-muted transition-colors hover:text-ink"
          >
            关闭 ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {outfits === null && (
            <p className="py-12 text-center text-[12px] text-muted">加载中……</p>
          )}
          {outfits !== null && outfits.length === 0 && (
            <p className="py-12 text-center text-[12px] leading-6 text-muted">
              穿搭库还没有图。
              <br />
              生成搭配图后点「存入穿搭库」就会出现在这里。
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {outfits?.map((o) => (
              <div key={o.id} className="flex flex-col">
                <div className="flex items-center justify-center border border-line bg-card p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={o.image_url}
                    alt="穿搭图"
                    loading="lazy"
                    className="max-h-44 max-w-full object-contain"
                  />
                </div>
                <button
                  onClick={() => handleDelete(o)}
                  disabled={deletingId === o.id}
                  className={`mx-auto mt-2 text-[12px] tracking-[0.2em] transition-colors ${
                    confirmingId === o.id
                      ? "text-red-800"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {deletingId === o.id
                    ? "删除中……"
                    : confirmingId === o.id
                      ? "再点一次确认"
                      : "删除"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
