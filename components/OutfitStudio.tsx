"use client";

import { useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { WardrobeItem } from "@/lib/types";
import { composeOutfitImage } from "@/lib/compose";
import OutfitLibrary from "./OutfitLibrary";

export default function OutfitStudio({ items }: { items: WardrobeItem[] }) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<WardrobeItem[]>([]);
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [photoTags, setPhotoTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);

  function toggle(item: WardrobeItem) {
    setSelected((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item],
    );
  }

  function toggleTag(id: string) {
    setPhotoTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function generate() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const blob = await composeOutfitImage(selected);
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      console.error(e);
      setError("出图失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  /** 手机走系统分享（可直接存相册）；桌面直接下载 PNG */
  async function save() {
    if (!result) return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && typeof navigator.canShare === "function") {
      const file = new File([result.blob], "搭配.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          // 用户主动取消就到此为止；其他错误落到下载兜底
          if (e instanceof Error && e.name === "AbortError") return;
        }
      }
    }
    const a = document.createElement("a");
    a.href = result.url;
    a.download = "搭配.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** 把图片存入穿搭库：上传存储 + outfits 表记录（关联单品 id） */
  async function saveOutfit(blob: Blob, itemIds: string[]) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("no supabase");
    const path = `outfits/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabase.storage
      .from("items")
      .upload(path, blob, { contentType: "image/png" });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("items").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("outfits")
      .insert({ image_url: pub.publicUrl, item_ids: itemIds });
    if (dbErr) throw dbErr;
  }

  async function saveComposedToLibrary() {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      await saveOutfit(result.blob, selected.map((i) => i.id));
      setSaved(true);
    } catch (e) {
      console.error(e);
      setError("保存失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function savePhotoToLibrary() {
    if (!photo) return;
    setBusy(true);
    setError("");
    try {
      await saveOutfit(photo.blob, photoTags);
      back();
    } catch (e) {
      console.error(e);
      setError("保存失败，请检查网络后重试。");
      setBusy(false);
    }
  }

  function handlePhoto(file: File) {
    setError("");
    setPhotoTags([]);
    setPhoto({ url: URL.createObjectURL(file), blob: file });
  }

  function back() {
    if (result) URL.revokeObjectURL(result.url);
    if (photo) URL.revokeObjectURL(photo.url);
    setResult(null);
    setPhoto(null);
    setSaved(false);
    setBusy(false);
  }

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif-jp text-[18px]">衣橱还是空的</p>
        <p className="mt-4 text-[12px] text-muted">先去上传几件单品，再回来搭配。</p>
      </div>
    );
  }

  // 真人搭配照：预览 + 标记包含的单品
  if (photo) {
    return (
      <div className="mx-auto max-w-md py-8">
        <div className="flex items-center justify-center border border-line bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt="真人搭配照"
            className="max-h-[45vh] max-w-full object-contain"
          />
        </div>
        <p className="mt-6 text-center text-[12px] leading-6 text-muted">
          照片里有这些单品吗？点选标记（可不选）：
        </p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {items.map((item) => {
            const active = photoTags.includes(item.id);
            return (
              <button key={item.id} onClick={() => toggleTag(item.id)}>
                <div
                  className={`relative flex aspect-square items-center justify-center border bg-card p-2 ${
                    active ? "border-ink" : "border-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.name || "单品"}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                  {active && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] text-paper">
                      ✓
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            onClick={back}
            disabled={busy}
            className="px-6 py-3 text-[12px] tracking-[0.2em] text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            重选
          </button>
          <button
            onClick={savePhotoToLibrary}
            disabled={busy}
            className="border border-ink px-10 py-3 text-[18px] tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
          >
            {busy ? "保存中……" : "存入穿搭库"}
          </button>
        </div>
        {error && <p className="mt-6 text-center text-[12px] text-red-800">{error}</p>}
      </div>
    );
  }

  // 合成搭配图预览
  if (result) {
    return (
      <div className="mx-auto max-w-md py-8">
        <div className="flex items-center justify-center border border-line bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.url}
            alt="搭配图"
            className="max-h-[60vh] max-w-full object-contain"
          />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <button
            onClick={back}
            className="px-6 py-3 text-[12px] tracking-[0.2em] text-muted transition-colors hover:text-ink"
          >
            重新选择
          </button>
          <button
            onClick={saveComposedToLibrary}
            disabled={busy || saved}
            className="px-6 py-3 text-[12px] tracking-[0.2em] text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            {saved ? "已存入穿搭库 ✓" : busy ? "保存中……" : "存入穿搭库"}
          </button>
          <button
            onClick={save}
            className="border border-ink px-10 py-3 text-[18px] tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper"
          >
            保存图片
          </button>
        </div>
        {error && <p className="mt-6 text-center text-[12px] text-red-800">{error}</p>}
      </div>
    );
  }

  // 选品
  return (
    <div>
      <p className="text-center text-[12px] leading-6 text-muted">
        点选几件单品，生成日系杂志感的平铺搭配图。
      </p>
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const idx = selected.findIndex((i) => i.id === item.id);
          const active = idx !== -1;
          return (
            <button key={item.id} onClick={() => toggle(item)} className="text-left">
              <div
                className={`relative flex aspect-[3/4] items-center justify-center border bg-card p-5 transition-shadow ${
                  active ? "border-ink shadow-[0_10px_32px_rgba(0,0,0,0.08)]" : "border-line"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.name || "单品"}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
                {active && (
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] text-paper">
                    {idx + 1}
                  </span>
                )}
              </div>
              <p className="mt-3 truncate text-[12.5px]">{item.name || "未命名"}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-10 text-center">
        <button
          onClick={generate}
          disabled={selected.length === 0 || busy}
          className="border border-ink px-10 py-3 text-[18px] tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          {busy ? "出图中……" : `生成搭配图${selected.length > 0 ? `（${selected.length} 件）` : ""}`}
        </button>
        <p className="mt-6 flex items-center justify-center gap-6">
          <button
            onClick={() => photoRef.current?.click()}
            className="text-[12px] tracking-[0.2em] text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            或上传真人搭配照，直接存入穿搭库
          </button>
          <button
            onClick={() => setLibraryOpen(true)}
            className="text-[12px] tracking-[0.2em] text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            管理穿搭库
          </button>
        </p>
        {error && <p className="mt-6 text-[12px] text-red-800">{error}</p>}
      </div>
      {libraryOpen && <OutfitLibrary onClose={() => setLibraryOpen(false)} />}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePhoto(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
