#!/usr/bin/env python3
"""生成 PWA 图标：米白底 + 黑色圆环，纯标准库手写 PNG，无任何第三方依赖。"""

import math
import os
import struct
import zlib

BG = (250, 249, 247)      # #faf9f7
INK = (28, 27, 26)        # #1c1b1a


def write_png(path: str, size: int, ring_outer_ratio: float) -> None:
    cx = cy = size / 2
    outer = size * ring_outer_ratio
    stroke = max(2, size * 0.045)
    inner = outer - stroke

    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            r, g, b = INK if inner <= d <= outer else BG
            row += bytes((r, g, b))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)
    print(f"{path}  {size}x{size}  {len(png)} bytes")


ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

# maskable 图标主体需落在中央 80% 安全区内，圆环收小一点
write_png(os.path.join(ROOT, "icon-192.png"), 192, 0.30)
write_png(os.path.join(ROOT, "icon-512.png"), 512, 0.30)
write_png(os.path.join(ROOT, "icon-maskable-512.png"), 512, 0.24)
write_png(os.path.join(ROOT, "apple-touch-icon.png"), 180, 0.30)
