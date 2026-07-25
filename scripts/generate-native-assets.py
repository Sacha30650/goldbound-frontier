from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

assets = Path(__file__).resolve().parents[1] / "assets"
hero = Image.open(assets / "frontier-hero.png").convert("RGB")

icon = ImageOps.fit(hero, (1024, 1024), centering=(0.2, 0.5))
icon = ImageEnhance.Contrast(icon).enhance(1.08)
icon.save(assets / "icon.png", optimize=True)

splash = Image.new("RGB", (2732, 2732), "#081214")
mark = icon.resize((720, 720), Image.Resampling.LANCZOS)
mask_draw = Image.new("L", mark.size, 0)
from PIL import ImageDraw
ImageDraw.Draw(mask_draw).rounded_rectangle((0, 0, 719, 719), radius=165, fill=255)
# A restrained gold halo keeps the launch screen premium while compressing well.
halo = Image.new("RGBA", splash.size, (0, 0, 0, 0))
halo_draw = ImageDraw.Draw(halo)
halo_draw.ellipse((850, 850, 1882, 1882), fill=(245, 184, 60, 26))
splash = Image.alpha_composite(splash.convert("RGBA"), halo).convert("RGB")
splash.paste(mark, ((2732 - 720) // 2, (2732 - 720) // 2), mask_draw)
splash.save(assets / "splash.png", optimize=True)
print("Generated Capacitor icon.png and splash.png")
