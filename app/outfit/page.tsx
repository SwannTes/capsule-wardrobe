import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { WardrobeItem } from "@/lib/types";
import OutfitStudio from "@/components/OutfitStudio";

export const metadata: Metadata = { title: "搭配" };

export const dynamic = "force-dynamic";

export default async function OutfitPage() {
  const supabase = getSupabase();

  if (!supabase) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif-jp text-[18px]">衣橱还没有准备好</p>
        <p className="mt-4 text-[12px] leading-6 text-muted">
          请先配置 Supabase，详见 README.md。
        </p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif-jp text-[18px]">暂时打不开衣橱</p>
        <p className="mt-4 text-[12px] leading-6 text-muted">{error.message}</p>
      </div>
    );
  }

  const items = (data ?? []) as WardrobeItem[];

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif-jp text-[18px]">衣橱还是空的</p>
        <p className="mt-4 text-[12px] text-muted">先上传几件单品，再回来搭配。</p>
        <Link
          href="/upload"
          className="mt-10 inline-block border border-ink px-10 py-3 text-[12px] tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper"
        >
          去上传
        </Link>
      </div>
    );
  }

  return <OutfitStudio items={items} />;
}
