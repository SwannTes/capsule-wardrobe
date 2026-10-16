# 胶囊衣橱（Capsule Wardrobe PWA）

极简胶囊衣橱网页应用：手机拍照/选图 → 手绘圈选单品（沿边缘画一圈）→ 浏览器本地抠图 → 圈外像素抹除 + 滤除不连通杂件 → Color Thief 提取主色调 → 存入 Supabase → 网格展示，点开查看大图色卡、删除单品；「搭配」页选几件单品生成日系杂志平铺图（白底错落排版 + 底部合并色卡），可保存/分享 PNG。PWA 形态，手机 Safari/Chrome「添加到主屏幕」后体验接近原生 App。

## 技术栈

- Next.js 15（App Router）+ React 19 + Tailwind CSS v4
- 手绘圈选：`components/LassoStep.tsx`（SVG 描线 + Pointer Events，鼠标/手指通用；圈选包围盒外扩 18% 再裁切——模型需要看到主体周围的背景才有信心，贴边裁会输出全透明；圈外带入的杂物由蒙版兜底）
- 抠图：[`@imgly/background-removal`](https://github.com/imgly/background-removal-js)（纯前端 WASM 推理，免费、无需 API Key；首次使用下载约 65MB 模型）
- 杂件过滤：`lib/mask.ts`（`applyPolygonMask` 圈外像素置透明——衣架、吊牌即使与衣服相连，画圈时绕开即可切掉；`keepLargestComponent` 连通域分析滤碎屑；`opaqueRatio` 检测模型全透明翻车，退回纯圈选结果保底）
- 色卡提取：`colorthief`（跳过透明像素；MMCQ 在单色图上会编造"幻影色"，用真实像素投票校验后丢弃）
- 搭配出图：`lib/compose.ts`（Canvas 白底 1200×1500，1–4 件有固定杂志式布局，更多走网格兜底；合并色卡去重上限 10 个；跨域图片需 `crossOrigin="anonymous"`，Supabase 存储 CORS 为 *）
- 数据：Supabase（Postgres 表 `items` + Storage 公开桶 `items`；增删读均走 anon key + RLS 策略）
- PWA：`@ducanh2912/next-pwa`（生产构建自动生成 Service Worker）
- 部署：Vercel（Cloudflare Pages 亦可，Next 全栈特性需走 `@cloudflare/next-on-pages`，建议直接用 Vercel）

## 本地运行

```bash
npm install
cp 本节的变量说明 .env.local   # 见下
npm run dev
```

`.env.local` 内容（Supabase 控制台 → Project Settings → API 复制）：

```
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon public key
```

没配这两个变量也能启动：衣橱页/上传页会显示配置引导，抠图与色卡预览照常可用，只是无法保存。

## Supabase 初始化（一次性）

在 Supabase 控制台 → SQL Editor 执行：

```sql
-- 1. 单品表
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  image_url text not null,
  colors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;
create policy "allow anon read"   on public.items for select to anon using (true);
create policy "allow anon insert" on public.items for insert to anon with check (true);
create policy "allow anon delete" on public.items for delete to anon using (true);

-- 2. 穿搭表（item_ids 关联包含的单品；弹窗右侧"推荐穿搭"靠它查询）
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.outfits enable row level security;
create policy "allow anon read"   on public.outfits for select to anon using (true);
create policy "allow anon insert" on public.outfits for insert to anon with check (true);
create policy "allow anon update" on public.outfits for update to anon using (true) with check (true);
create policy "allow anon delete" on public.outfits for delete to anon using (true);

-- 3. 图片存储桶（公开可读、匿名可传可删；个人自用足够，介意可再收紧）
insert into storage.buckets (id, name, public)
values ('items', 'items', true)
on conflict (id) do nothing;

create policy "allow anon read images"   on storage.objects for select to anon using (bucket_id = 'items');
create policy "allow anon upload images" on storage.objects for insert to anon with check (bucket_id = 'items');
create policy "allow anon delete images" on storage.objects for delete to anon using (bucket_id = 'items');
```

> 说明：anon key 本身就是「公开给浏览器用」的 key，以上策略意味着知道项目地址的人都能读写。个人自用没问题；要多人/公网使用再加认证。穿搭图存在同一个桶的 `outfits/` 前缀下，策略天然覆盖。

## 部署现状（2026-10-14 已上线）

- GitHub 仓库：`SwannTes/capsule-wardrobe`（private）
- Vercel 项目：`capsule-wardrobe`（team swanntes-projects，项目级「Vercel Authentication」部署保护已关闭）
- 线上域名：`wardrobe.swann.com.cn`（⚠️ `*.vercel.app` 默认域名在国内被 DNS 污染 + SNI 阻断，不可用，必须走自定义域名）
- 生产环境变量（Vercel 后台已配）：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 日常更新：`git add -A && git commit && git push`，然后 `npx vercel deploy --prod --yes`（CLI 登录态在本机；也可在 Vercel 后台把 GitHub 仓库接上自动部署）

**改代码后的上线步骤**：本地 `npm run build` 验证 → commit+push → `npx vercel deploy --prod --yes`。

**换机/首次配置**：`npx vercel login --github`（浏览器授权一次）→ 项目目录 `npx vercel link --yes --project capsule-wardrobe`。

## 从零手动部署（参考）

1. 推到 GitHub：`git init && git add -A && git commit -m "init"`，建仓库后 push。
2. Vercel → Import Project → 选仓库，Framework 自动识别 Next.js。
3. Environment Variables 填上面两个 `NEXT_PUBLIC_*` 变量。
4. Deploy。之后手机打开域名 → Safari 分享 →「添加到主屏幕」。

## 备注

- **抠图模型自托管（可选）**：默认模型（约 65MB）从 `staticimgly.com` 加载，国内偶尔抽风（并行分块下载偶发失败，重试一般能成）。要稳定就自托管：运行 `python3 scripts/fetch-imgly-assets.py` 把模型镜像到 `public/imgly/`（约 105MB），再把 `components/Uploader.tsx` 里 `removeBackground` 第二个参数加上 `publicPath: window.location.origin + "/imgly/"`。
- **想换 Remove.bg**：把 `Uploader.tsx` 里 `removeBackground` 一段换成 `fetch("https://api.remove.bg/v1.0/removebg", ...)`（需要 API Key，免费额度 50 张/月），返回 PNG blob，下游流程不变。
- 图标是脚本生成的占位图（`scripts/make-icons.py`，纯标准库），想换风格直接替换 `public/icons/` 下的 PNG 即可。
- iOS 拍摄 HEIC 照片经 Safari 文件选择器会自动转 JPEG，可直接上传。

## 目录结构

```
app/            页面：/ 衣橱网格，/upload 上传抠图
components/     WardrobeGrid / ItemModal / Uploader / SiteNav
lib/            supabase 客户端、色卡提取与图片缩放、类型
public/icons/   PWA 图标（scripts/make-icons.py 生成）
```
