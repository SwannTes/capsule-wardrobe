"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Outfit, WardrobeItem } from "@/lib/types";

export default function ItemModal({
  item,
  onClose,
}: {
  item: WardrobeItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [library, setLibrary] = useState<Outfit[] | null>(null);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 拉取包含这件单品的穿搭图
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setOutfits([]);
      return;
    }
    supabase
      .from("outfits")
      .select("*")
      .contains("item_ids", [item.id])
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setOutfits(error ? [] : ((data ?? []) as Outfit[]));
      });
  }, [item.id]);

  /** 两段式删除：先点"删除"出确认，再点一次才真正删（数据库记录 + 存储图片） */
  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error: dbErr } = await supabase
        .from("items")
        .delete()
        .eq("id", item.id);
      if (dbErr) throw dbErr;
      // 行删成功先更新界面；存储文件失败只记日志，不影响交互
      router.refresh();
      onClose();
      const path = item.image_url.split("/object/public/items/")[1];
      if (path) {
        supabase.storage
          .from("items")
          .remove([path])
          .then(({ error }) => error && console.error("删除图片文件失败", error));
      }
    } catch (e) {
      console.error(e);
      setDeleting(false);
      setConfirming(false);
    }
  }

  /** 打开图库选择器（首次打开时拉全量穿搭图） */
  function openPicker() {
    setPickerOpen(true);
    setImportError("");
    if (library !== null) return;
    const supabase = getSupabase();
    if (!supabase) {
      setLibrary([]);
      return;
    }
    supabase
      .from("outfits")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setLibrary(error ? [] : ((data ?? []) as Outfit[]));
      });
  }

  /** 每件单品只挂一张穿搭图：把旧关联从其他穿搭图上摘掉 */
  async function unlinkOthers(supabase: NonNullable<ReturnType<typeof getSupabase>>, keepId: string) {
    const prev = outfits ?? [];
    await Promise.all(
      prev
        .filter((o) => o.id !== keepId)
        .map((o) =>
          supabase
            .from("outfits")
            .update({ item_ids: o.item_ids.filter((id) => id !== item.id) })
            .eq("id", o.id),
        ),
    );
    setLibrary(
      (prevLib) =>
        prevLib?.map((o) =>
          o.id !== keepId && prev.some((p) => p.id === o.id)
            ? { ...o, item_ids: o.item_ids.filter((id) => id !== item.id) }
            : o,
        ) ?? null,
    );
  }

  /** 从本地上传穿搭图（原图入库，自动关联当前单品） */
  async function handleImport(file: File) {
    const supabase = getSupabase();
    if (!supabase) return;
    setUploading(true);
    setImportError("");
    try {
      const path = `outfits/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from("items")
        .upload(path, file, { contentType: file.type || "image/png" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("items").getPublicUrl(path);
      const { data, error: dbErr } = await supabase
        .from("outfits")
        .insert({ image_url: pub.publicUrl, item_ids: [item.id] })
        .select()
        .single();
      if (dbErr) throw dbErr;
      await unlinkOthers(supabase, (data as Outfit).id);
      setOutfits([data as Outfit]);
      setLibrary((prev) => [data as Outfit, ...(prev ?? [])]);
      setPickerOpen(false);
    } catch (e) {
      console.error(e);
      setImportError("上传失败了，请重试。");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** 把穿搭库里已有的图关联到当前单品（同时摘掉旧关联） */
  async function linkExisting(outfit: Outfit) {
    const supabase = getSupabase();
    if (!supabase) return;
    const itemIds = [...new Set([...outfit.item_ids, item.id])];
    const { error } = await supabase
      .from("outfits")
      .update({ item_ids: itemIds })
      .eq("id", outfit.id);
    if (error) {
      console.error(error);
      setImportError("关联失败了，请重试。");
      return;
    }
    await unlinkOthers(supabase, outfit.id);
    const updated = { ...outfit, item_ids: itemIds };
    setLibrary((prev) => prev?.map((o) => (o.id === outfit.id ? updated : o)) ?? null);
    setOutfits([updated]);
    setPickerOpen(false);
  }

  const linkedIds = new Set((outfits ?? []).map((o) => o.id));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-paper/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed right-6 top-6 z-10 text-xs tracking-[0.3em] text-muted transition-colors hover:text-ink"
      >
        关闭 ✕
      </button>
      <div
        className="flex min-h-full flex-col items-center justify-center px-5 py-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 同一个白色背景框：宽高比 0.94（对齐参考图白板比例）；左 3/5 宽——名称+主图+色点垂直居中，删除按钮收在左列底部；右 2/5 宽——穿搭图贴满整列、底部对齐删除行（图内色点落在同一水平线） */}
        <div
          className="border border-line bg-card p-6"
          style={{ width: "min(92vw, 91vh)", aspectRatio: "1260 / 1280" }}
        >
          {/* 左列按主图实际宽度占位、右列吃掉剩余全部宽度，两列间距固定 10px */}
          <div className="flex h-full flex-row gap-2.5">
            <div className="flex shrink-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                <p className="font-serif-jp text-base">{item.name || "未命名单品"}</p>
                {/* 主图高度用视口定值：flex 里写百分比会和 max-h-full 形成循环计算把高度撑爆；self-start 贴左，左边距≈原来一半 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.name || "单品"}
                  className="mt-4 max-h-[57vh] max-w-full self-start object-contain"
                />
                <div className="mt-4 flex justify-center gap-3">
                  {item.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="h-5 w-5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="pb-1 pt-4">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={
                    confirming
                      ? "text-[12px] tracking-[0.2em] text-red-800 transition-colors"
                      : "text-[12px] tracking-[0.2em] text-muted transition-colors hover:text-ink"
                  }
                >
                  {deleting ? "删除中……" : confirming ? "再点一次，确认删除" : "删除这件单品"}
                </button>
              </div>
            </div>

            {/* 右侧：只显示一张推荐穿搭（贴底对齐），点击进图库选择器可更换 */}
            <button
              onClick={openPicker}
              disabled={uploading}
              className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end transition-colors ${
                uploading ? "opacity-40" : ""
              }`}
            >
              {(uploading || (outfits !== null && outfits.length === 0)) && (
                <span className="my-auto text-[12px] tracking-[0.2em] text-muted">
                  {uploading ? "上传中……" : "导入搭配图"}
                </span>
              )}
              {outfits && outfits.length > 0 && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={outfits[0].id}
                  src={outfits[0].image_url}
                  alt="穿搭图"
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 图库选择器：半屏弹窗，大图平铺全部穿搭图，右上角从本地导入，图多上下滑 */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 p-6"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(false);
          }}
        >
          <div
            className="flex h-[55vh] w-full max-w-xl flex-col border border-line bg-paper"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <button
                onClick={() => setPickerOpen(false)}
                className="text-[12px] tracking-[0.2em] text-muted transition-colors hover:text-ink"
              >
                取消
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-[12px] tracking-[0.2em] text-ink underline underline-offset-4 disabled:opacity-40"
              >
                {uploading ? "上传中……" : "从本地导入"}
              </button>
            </div>
            {importError && (
              <p className="pb-2 text-center text-[12px] text-red-800">{importError}</p>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {library === null && (
                <p className="py-12 text-center text-[12px] text-muted">加载中……</p>
              )}
              {library !== null && library.length === 0 && (
                <p className="py-12 text-center text-[12px] leading-6 text-muted">
                  穿搭库还没有图。
                  <br />
                  点右上角「从本地导入」上传第一张。
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {library?.map((o) => {
                  const linked = linkedIds.has(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => linkExisting(o)}
                      disabled={linked || uploading}
                      className={`relative border border-line bg-card p-3 ${
                        linked ? "opacity-50" : "transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.image_url}
                        alt="穿搭库图片"
                        loading="lazy"
                        className="max-h-40 w-full object-contain"
                      />
                      {linked && (
                        <span className="absolute right-2 top-2 bg-ink px-2 py-1 text-[10px] tracking-[0.15em] text-paper">
                          已关联
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 注意：不能用 display:none，部分浏览器会拦截程序化点击；
          且必须拦截 click 冒泡——input.click() 的点击事件会冒泡到弹窗遮罩触发关闭 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
        }}
      />
    </div>
  );
}
