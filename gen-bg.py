"""Generate webp background images for the lomba app.
Uses Pillow to create gradient/pattern backgrounds in webp format.
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = r"C:\Users\bangn\Documents\Kerja\lomba\lomba-app\public\bg"
os.makedirs(OUT_DIR, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def vertical_gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    for y in range(h):
        t = y / max(1, h - 1)
        c = lerp(top, bottom, t)
        for x in range(w):
            img.putpixel((x, y), c)
    return img

def radial_glow(w, h, center_color, edge_color, center=None, radius=None):
    """Soft radial gradient with a glowing center."""
    img = Image.new("RGB", (w, h), edge_color)
    cx = center[0] if center else w // 2
    cy = center[1] if center else h // 2
    r = radius or max(w, h) * 0.6
    draw = ImageDraw.Draw(img)
    steps = 60
    for i in range(steps, 0, -1):
        t = (steps - i) / steps
        c = lerp(edge_color, center_color, t * 0.5)
        rr = int(r * i / steps)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
    return img.filter(ImageFilter.GaussianBlur(radius=40))

def add_bokeh(img, count=80, color_range=None):
    """Overlay translucent circles for a bokeh/decoration effect."""
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = random.randint(0, w)
        y = random.randint(0, h)
        r = random.randint(20, 120)
        c = random.choice(color_range or [(255, 255, 255, 30), (255, 200, 150, 25), (255, 255, 255, 18)])
        draw.ellipse([x - r, y - r, x + r, y + r], fill=c)
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=12))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

def add_sparkles(img, count=120):
    """Tiny star/sparkle dots."""
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = random.randint(0, w)
        y = random.randint(0, h)
        r = random.choice([1, 1, 1, 2, 2, 3])
        alpha = random.randint(80, 220)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, alpha))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

def add_firework_bursts(img, count=10):
    """Small firework/star bursts at random positions."""
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(count):
        cx = random.randint(int(w*0.05), int(w*0.95))
        cy = random.randint(int(h*0.05), int(h*0.95))
        r = random.randint(40, 120)
        # Draw radial lines
        rays = random.randint(8, 16)
        for i in range(rays):
            angle = 2 * math.pi * i / rays
            x2 = cx + r * math.cos(angle)
            y2 = cy + r * math.sin(angle)
            color = random.choice([(255, 215, 100, 180), (255, 255, 255, 200), (255, 180, 180, 150), (180, 220, 255, 160)])
            draw.line([cx, cy, x2, y2], fill=color, width=random.randint(2, 4))
        # Center dot
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 255, 255, 220))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=2))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

# === 1. Festive background (public site) ===
# Indonesian flag inspired: red/white/pink bokeh on soft pink gradient
random.seed(42)
W, H = 1920, 1080
base = vertical_gradient(W, H, (253, 245, 245), (251, 224, 224))  # light pink to lighter pink
glow = radial_glow(W, H, (255, 220, 220), (251, 224, 224), center=(W*0.7, H*0.3), radius=W*0.5)
base = Image.blend(base, glow, 0.6)
# Bokeh: red, white, pink tones (no more teal/cyan/gold)
bokeh_colors = [
    (225, 29, 29, 40),    # primary red
    (255, 255, 255, 50),  # white
    (241, 129, 129, 35),  # rose pink
    (247, 181, 181, 30), # light pink
    (157, 16, 16, 25),   # dark red
]
base = add_bokeh(base, count=60, color_range=bokeh_colors)
base = add_sparkles(base, count=80)
base = add_firework_bursts(base, count=6)
base = base.filter(ImageFilter.GaussianBlur(radius=3))
out1 = os.path.join(OUT_DIR, "festive-bg.webp")
base.save(out1, "WEBP", quality=82, method=6)
print(f"Created: {out1} ({os.path.getsize(out1):,} bytes)")

# === 2. Admin background (subtle, professional) ===
random.seed(7)
base2 = vertical_gradient(W, H, (253, 245, 245), (252, 235, 235))  # soft pink gradient
bokeh2_colors = [
    (225, 29, 29, 25),     # primary red
    (241, 129, 129, 20),   # rose
    (255, 255, 255, 30),   # white
]
base2 = add_bokeh(base2, count=40, color_range=bokeh2_colors)
base2 = add_sparkles(base2, count=40)
base2 = base2.filter(ImageFilter.GaussianBlur(radius=4))
out2 = os.path.join(OUT_DIR, "admin-bg.webp")
base2.save(out2, "WEBP", quality=80, method=6)
print(f"Created: {out2} ({os.path.getsize(out2):,} bytes)")

# === 3. Hero/landing background (bigger glow, more dramatic) ===
random.seed(99)
base3 = vertical_gradient(W, H, (251, 224, 224), (255, 240, 240))
glow3 = radial_glow(W, H, (255, 200, 200), (251, 224, 224), center=(W*0.5, H*0.2), radius=W*0.7)
base3 = Image.blend(base3, glow3, 0.7)
bokeh3_colors = [
    (225, 29, 29, 30),    # primary red
    (241, 129, 129, 35),  # rose
    (255, 255, 255, 45),  # white
    (157, 16, 16, 20),    # dark red
]
base3 = add_bokeh(base3, count=70, color_range=bokeh3_colors)
base3 = add_sparkles(base3, count=100)
base3 = add_firework_bursts(base3, count=8)
base3 = base3.filter(ImageFilter.GaussianBlur(radius=4))
out3 = os.path.join(OUT_DIR, "hero-bg.webp")
base3.save(out3, "WEBP", quality=82, method=6)
print(f"Created: {out3} ({os.path.getsize(out3):,} bytes)")

print("\nDone! All backgrounds in webp format.")
