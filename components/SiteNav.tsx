"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "衣橱" },
  { href: "/outfit", label: "搭配" },
  { href: "/upload", label: "上传" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex items-center justify-center gap-10 text-xs tracking-[0.3em]">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              active
                ? "border-b border-ink pb-1 text-ink"
                : "border-b border-transparent pb-1 text-muted transition-colors hover:text-ink"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
