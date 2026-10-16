#!/usr/bin/env python3
"""把 @imgly/background-removal 的模型资源镜像到 public/imgly/，实现自托管。

用法：python3 scripts/fetch-imgly-assets.py
完成后抠图资源从本站加载（/imgly/...），不再依赖 staticimgly.com。
"""

import json
import os
import sys
import urllib.request

VERSION = "1.7.0"  # 与 node_modules/@imgly/background-removal 版本一致
CDN = f"https://staticimgly.com/@imgly/background-removal-data/{VERSION}/dist/"
DEST = os.path.join(os.path.dirname(__file__), "..", "public", "imgly")

# 只下载默认用到的资源：小模型 + 全部 wasm 运行时变体
NEEDED_PREFIXES = ("/models/isnet_quint8", "/onnxruntime-web/")


def fetch(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print(f"  {url.split('/')[-1][:64]} ...", flush=True)
    urllib.request.urlretrieve(url, dest)


def main() -> None:
    os.makedirs(DEST, exist_ok=True)
    res_path = os.path.join(DEST, "resources.json")
    print("下载 resources.json")
    urllib.request.urlretrieve(CDN + "resources.json", res_path)
    with open(res_path) as f:
        resources = json.load(f)

    total = 0
    for key, entry in resources.items():
        if not key.startswith(NEEDED_PREFIXES):
            continue
        for chunk in entry["chunks"]:
            name = chunk["name"]
            dest = os.path.join(DEST, name)
            if os.path.exists(dest) and os.path.getsize(dest) == chunk["offsets"][1] - chunk["offsets"][0]:
                continue
            fetch(CDN + name, dest)
            total += 1
    print(f"完成，共下载 {total} 个分块 → {os.path.abspath(DEST)}")
    print("下一步：在 components/Uploader.tsx 的 removeBackground 配置里加 publicPath")


if __name__ == "__main__":
    sys.exit(main())
