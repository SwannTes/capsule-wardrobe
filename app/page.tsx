import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { WardrobeItem } from "@/lib/types";
import WardrobeGrid from "@/components/WardrobeGrid";

export const dynamic = "force-dynamic";

export default async function WardrobePage() {
  const supabase = getSupabase();

  if (!supabase) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif-jp text-[18px]">衣橱还没有准备好</p>
        <p className="mt-4 text-[12px] leading-6 text-muted">
          请先创建 .env.local，填入 NEXT_PUBLIC_SUPABASE_URL 和
          NEXT_PUBLIC_SUPABASE_ANON_KEY，
          <br />
          然后重启服务。详见 README.md。
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
        <p className="mt-4 text-[12px] leading-6 text-muted">
          {error.message}
          <br />
          如果是第一次使用，请先在 Supabase 里执行 README.md 中的建表 SQL。
        </p>
      </div>
    );
  }

  const items = (data ?? []) as WardrobeItem[];

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif-jp text-[18px]">衣橱还是空的</p>
        <p className="mt-4 text-[12px] text-muted">拍下第一件单品，开始整理吧。</p>
        <Link
          href="/upload"
          className="mt-10 inline-block border border-ink px-10 py-3 text-[12px] tracking-[0.3em] transition-colors hover:bg-ink hover:text-paper"
        >
          去上传
        </Link>
      </div>
    );
  }

  return <WardrobeGrid items={items} />;
}
