"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { extractPalette } from "@/lib/palette";
import { applyPolygonMask, keepLargestComponent, opaqueRatio } from "@/lib/mask";
import LassoStep, { type Pt } from "./LassoStep";

type Stage = "pick" | "lasso" | "processing" | "review" | "saving" | "done";

export default function Uploader() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [original, setOriginal] = useState<string | null>(null); // 原图 objectURL，用于圈选
  const [cutout, setCutout] = useState<{ url: string; blob: Blob } | null>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const supabaseReady = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  function handleFile(file: File) {
    setError("");
    setOriginal(URL.createObjectURL(file));
    setStage("lasso");
  }

  /** 圈选确认后：抠图（仅圈选区域）→ 圈外像素抹掉 → 滤掉不连通杂件 → 提取色卡 */
  async function processImage({
    cropped,
    polygon,
  }: {
    cropped: Blob;
    polygon: Pt[];
  }) {
    setStage("processing");
    setError("");
    try {
      setStatus("正在加载抠图模型，首次使用需下载约 65MB……");
      // 动态引入：库体积大，只在真正用到时才加载
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(cropped, {
        progress: (key, current, total) => {
          if (key.startsWith("fetch")) {
            const pct = total ? Math.round((current / total) * 100) : 0;
            setStatus(`正在下载抠图模型……${pct}%`);
          } else {
            setStatus("正在抠图，请稍候……");
          }
        },
      });
      setStatus("正在精修圈选区域……");
      let cleaned = await keepLargestComponent(
        await applyPolygonMask(blob, polygon),
      );
      // 模型偶尔信心不足输出全透明：退回"纯圈选"结果，保证不出空图
      if ((await opaqueRatio(cleaned)) < 0.005) {
        cleaned = await applyPolygonMask(cropped, polygon);
      }
      setStatus("正在提取主色调……");
      const colors = await extractPalette(cleaned, 6);
      setCutout({ url: URL.createObjectURL(cleaned), blob: cleaned });
      setPalette(colors);
      setStage("review");
    } catch (e) {
      console.error(e);
      setError("抠图失败了，换一张背景简单的照片试试。");
      setStage("pick");
    }
  }

  async function handleSave() {
    if (!cutout) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError("还没配置 Supabase，请先按 README 填好 .env.local。");
      return;
    }
    setStage("saving");
    setError("");
    try {
      const path = `${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from("items")
        .upload(path, cutout.blob, { contentType: "image/png" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("items").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("items").insert({
        name: name.trim(),
        image_url: pub.publicUrl,
        colors: palette,
      });
      if (dbErr) throw dbErr;

      setStage("done");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    } catch (e) {
      console.error(e);
      setError("保存失败，请检查网络与 Supabase 配置后重试。");
      setStage("review");
    }
  }

  function reset() {
    if (cutout) URL.revokeObjectURL(cutout.url);
    if (original) URL.revokeObjectURL(original);
    setCutout(null);
    setOriginal(null);
    setPalette([]);
    setName("");
    setError("");
    setStage("pick");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-md">
      {stage === "pick" && (
        <div className="py-16 text-center">
          <p className="font-serif-jp text-[18px]">拍下或选择一张单品照片</p>
          <p className="mt-3 text-[12px] leading-6 text-muted [text-wrap:balance]">
            自动抠掉背景、提取主色调，收入你的衣橱。
            <br />
            一件一件拍、平铺或上身照，效果最好。
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-10 border border-ink px-10 py-3 text-[18px] tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper"
          >
            选择照片
          </button>
          {!supabaseReady && (
            <p className="mt-6 text-[12px] leading-5 text-muted">
              提示：尚未配置 Supabase，可以预览抠图效果，但无法保存。
            </p>
          )}
        </div>
      )}

      {stage === "lasso" && original && (
        <LassoStep
          imageUrl={original}
          onConfirm={processImage}
          onRetake={reset}
        />
      )}

      {stage === "processing" && (
        <div className="py-24 text-center">
          <div className="mx-auto h-px w-16 bg-ink/15">
            <div className="h-px w-1/2 animate-pulse bg-ink" />
          </div>
          <p className="mt-6 text-xs text-muted">{status}</p>
        </div>
      )}

      {(stage === "review" || stage === "saving") && cutout && (
        <div className="py-8">
          <div className="flex items-center justify-center border border-line bg-card p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cutout.url}
              alt="抠图预览"
              className="max-h-[50vh] max-w-full object-contain"
            />
          </div>
          <div className="mt-6 flex justify-center gap-3">
            {palette.map((c) => (
              <span
                key={c}
                title={c}
                className="h-5 w-5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="给它起个名字（可留空）"
            maxLength={30}
            className="mt-8 w-full border-b border-line bg-transparent py-2 text-center text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-ink"
          />
          <div className="mt-8 flex items-center justify-center gap-6">
            <button
              onClick={reset}
              disabled={stage === "saving"}
              className="px-6 py-3 text-xs tracking-[0.2em] text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              重选
            </button>
            <button
              onClick={handleSave}
              disabled={stage === "saving"}
              className="border border-ink px-10 py-3 text-xs tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
            >
              {stage === "saving" ? "保存中……" : "存入衣橱"}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="py-24 text-center">
          <p className="font-serif-jp text-lg">已收入衣橱</p>
          <p className="mt-3 text-xs text-muted">正在回到衣橱页面……</p>
        </div>
      )}

      {error && (
        <p className="mt-6 text-center text-xs text-red-800">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
