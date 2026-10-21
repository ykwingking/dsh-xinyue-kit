# -*- coding: utf-8 -*-
"""势力图生成器（xinyue-kit 内置脚本，由 src/kingdom.js 调用，不单独运行）。

用法：python kingdom_assets.py <spec.json>

spec.json:
{
  "dst": "D:/…/packages/cfwl/image/kingdom",
  "font": "C:/Windows/Fonts/simkai.ttf",      // 可选，缺省用 simkai.ttf
  "kingdoms": [
    {"code": "xinglinggan", "char": "星", "accent": [116,158,191],
     "icon": "D:/…/灵感图标_星_大.webp",       // 可选：势力徽记
     "crystal": "D:/…/体力.png"}              // 可选：体力晶石（金水晶之类）
  ]
}

产出（每个势力最多 5 个文件，全部 175x233 体系的官方尺寸）：
  <code>.png             75x75   势力徽记（武将卡左上角）
  <code>-magatama.png    22x27   体力晶石
  <code>-magatama-l.png  13x20   双将模式左半
  <code>-magatama-r.png  13x20   双将模式右半
  <code>-back.png        175x233 卡背/底图（局内左侧窄条会露出，上面烤势力单字）

stdout 输出一行 JSON: {"ok": true, "files": [...], "warnings": [...]}
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

DEFAULT_FONT = r"C:\Windows\Fonts\simkai.ttf"
BACK_W, BACK_H = 175, 233
STRIP_W = 30
BADGE = 75
MAGATAMA = (22, 27)
HALF = (13, 20)


def crop_content(img):
    """裁掉透明边，只留墨迹。"""
    bbox = img.getchannel("A").getbbox()
    return img.crop(bbox) if bbox else img


def fit(img, w, h):
    """等比缩放并居中放进 w x h 的透明画布。"""
    r = min(w / img.width, h / img.height)
    small = img.resize((max(1, round(img.width * r)), max(1, round(img.height * r))), Image.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(small, ((w - small.width) // 2, (h - small.height) // 2))
    return out


def gamma_lift(img, g=2.2, bright=1.35, sat=1.2):
    """抬中间调（直接调亮度会把高光打爆）。"""
    lut = [min(255, int(round(255 * ((v / 255) ** (1.0 / g))))) for v in range(256)]
    r, gr, b, a = img.split()
    out = Image.merge("RGBA", (r.point(lut), gr.point(lut), b.point(lut), a))
    out = ImageEnhance.Brightness(out).enhance(bright)
    out = ImageEnhance.Color(out).enhance(sat)
    return out


def gradient_tint(ink, top, bot):
    """把字形墨迹按竖向渐变上色。"""
    w, h = ink.size
    grad = Image.new("RGBA", (w, h))
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / max(1, h - 1)
        gd.line([(0, y), (w, y)], fill=tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)) + (255,))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(grad, (0, 0), ink.getchannel("A"))
    return out


def outline(img, color, width=1):
    grown = img.getchannel("A").filter(ImageFilter.MaxFilter(width * 2 + 1))
    ring = Image.new("RGBA", img.size, color + (0,))
    ring.putalpha(grown)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(ring)
    out.alpha_composite(img)
    return out


def make_back(icon, char, accent, font_path):
    """卡背：深色渐变 + 左窄条（压暗）+ 楷体势力单字（顶到 y=6，避开 QML 里 y=21 起的竖排武将名）。"""
    top = tuple(min(255, int(c * 0.35) + 26) for c in accent)
    bot = (14, 16, 24)
    img = Image.new("RGBA", (BACK_W, BACK_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(BACK_H):
        t = y / (BACK_H - 1)
        d.line([(0, y), (BACK_W, y)], fill=tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)) + (255,))

    for y in range(0, 200):
        t = y / 199
        col = tuple(int(a * (1 - t) + b * t) for a, b in zip(
            tuple(int(c * 0.62) for c in accent), tuple(int(c * 0.26) for c in accent)))
        d.line([(0, y), (STRIP_W, y)], fill=col + (205,))
    d.line([(STRIP_W, 0), (STRIP_W, BACK_H)], fill=tuple(int(c * 0.75) for c in accent) + (200,), width=1)

    if char:
        f = ImageFont.truetype(font_path, 60)
        tmp = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        ImageDraw.Draw(tmp).text((8, 4), char, font=f, fill=(255, 255, 255, 255))
        ink = crop_content(tmp)
        if ink.width and ink.height:
            r = 21 / ink.height
            ink = ink.resize((max(1, round(ink.width * r)), 21), Image.LANCZOS)
            ink = gradient_tint(ink,
                                tuple(int(c * 0.45 + 255 * 0.55) for c in accent),
                                tuple(min(255, int(c * 1.10) + 26) for c in accent))
            ink = outline(ink, (18, 18, 24), 1)
            img.alpha_composite(ink, ((STRIP_W - ink.width) // 2, 6))

    d.rectangle([2, 2, BACK_W - 3, BACK_H - 3], outline=(0, 0, 0, 90), width=1)
    if icon is not None:
        # 徽记淡淡地压在卡背右下角，纯装饰（被立绘盖住也无所谓）
        faint = icon.copy()
        a = faint.getchannel("A").point(lambda v: int(v * 0.10))
        faint.putalpha(a)
        small = fit(faint, 90, 90)
        img.alpha_composite(small, (BACK_W - 92, BACK_H - 92))
    return img


def main():
    if len(sys.argv) < 2:
        return 1
    with open(sys.argv[1], "r", encoding="utf-8") as fp:
        spec = json.load(fp)

    dst = spec["dst"]
    result_path = spec.get("result")
    os.makedirs(dst, exist_ok=True)
    font_path = spec.get("font") or DEFAULT_FONT
    if not os.path.exists(font_path):
        font_path = DEFAULT_FONT

    files, warnings = [], []
    for k in spec.get("kingdoms", []):
        code = k["code"]
        accent = tuple(k.get("accent") or [150, 150, 150])
        icon = None
        if k.get("icon") and os.path.exists(k["icon"]):
            icon = crop_content(Image.open(k["icon"]).convert("RGBA"))
        elif k.get("icon"):
            warnings.append("找不到图标:" + k["icon"])

        if icon is not None:
            fit(icon, BADGE, BADGE).save(os.path.join(dst, code + ".png"))
            files.append(code + ".png")

        if k.get("crystal") and os.path.exists(k["crystal"]):
            raw = Image.open(k["crystal"]).convert("RGBA")
            crystal = gamma_lift(crop_content(raw))
            fit(crystal, *MAGATAMA).save(os.path.join(dst, code + "-magatama.png"))
            files.append(code + "-magatama.png")
            full = crystal.resize((26, 20), Image.LANCZOS)
            full.crop((0, 0, 13, 20)).save(os.path.join(dst, code + "-magatama-l.png"))
            full.crop((13, 0, 26, 20)).save(os.path.join(dst, code + "-magatama-r.png"))
            files += [code + "-magatama-l.png", code + "-magatama-r.png"]
        elif k.get("crystal"):
            warnings.append("找不到晶石:" + k["crystal"])

        make_back(icon, k.get("char"), accent, font_path).save(os.path.join(dst, code + "-back.png"))
        files.append(code + "-back.png")

    payload = json.dumps({"ok": True, "files": files, "warnings": warnings}, ensure_ascii=False)
    if result_path:
        with open(result_path, "w", encoding="utf-8") as fp:
            fp.write(payload)
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
