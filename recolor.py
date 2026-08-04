"""Recolor all CSS/TS/TSX files: teal -> red palette."""
import os
import re

ROOT = r"C:\Users\bangn\Documents\Kerja\lomba\lomba-app"

# Color substitutions (teal/cyan -> red/pink)
SUBS = [
    # (old, new) — order matters (longer first to avoid partial replace)
    ("rgba(58, 175, 185, 0.18)", "rgba(225, 29, 29, 0.18)"),
    ("rgba(58,175,185,0.18)", "rgba(225,29,29,0.18)"),
    ("rgba(151, 200, 235, 0.25)", "rgba(241, 129, 129, 0.25)"),
    ("rgba(151,200,235,0.25)", "rgba(241,129,129,0.25)"),
    # Hex (any case)
    ("#3aafb9", "#E11D1D"),
    ("#3AAFb9", "#E11D1D"),
    ("#3AAF B9", "#E11D1D"),
    ("#3AafB9", "#E11D1D"),
    ("#093a3e", "#9D1010"),
    ("#093A3E", "#9D1010"),
    ("#d4f1f4", "#FCE0E0"),
    ("#D4F1F4", "#FCE0E0"),
    ("#64e9ee", "#F18181"),
    ("#64E9EE", "#F18181"),
    ("#cffafd", "#FCE5E5"),
    ("#CFFAFD", "#FCE5E5"),
    ("#a7dde0", "##FBE0E0".replace("##", "#")),
    ("#97c8eb", "#F7B5B5"),
    ("#97C8EB", "#F7B5B5"),
]

# Collect files
exts = (".css", ".ts", ".tsx", ".mjs", ".js")
files = []
for dirpath, _, filenames in os.walk(ROOT):
    # Skip node_modules, .next, .git
    if any(skip in dirpath for skip in ("\\node_modules\\", "\\.next\\", "\\.git\\", "\\.vercel\\", "\\public\\")):
        continue
    for f in filenames:
        if f.endswith(exts):
            files.append(os.path.join(dirpath, f))

updated = 0
for fp in files:
    try:
        with open(fp, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        continue
    original = content
    for old, new in SUBS:
        # Case-insensitive replace (since colors can be in any case)
        # Use regex for case-insensitive but only for hex values
        if old.startswith("#"):
            content = re.sub(re.escape(old), new, content, flags=re.IGNORECASE)
        else:
            content = content.replace(old, new)
    if content != original:
        with open(fp, "w", encoding="utf-8") as f:
            f.write(content)
        updated += 1
        # Count substitutions
        diff = sum(1 for old, _ in SUBS if old.lower() in original.lower())
        print(f"Updated ({diff} subs): {os.path.relpath(fp, ROOT)}")

print(f"\nDone. {updated} files updated.")
