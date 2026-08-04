"""Fix UTF-8 in pengaturan-client.tsx — strip Windows-1252 bytes."""
import re

fp = r"C:\Users\bangn\Documents\Kerja\lomba\lomba-app\app\admin\pengaturan\pengaturan-client.tsx"
with open(fp, "rb") as f:
    data = f.read()

# Decode as latin-1 (accepts all byte values) then re-encode as UTF-8
# This converts Windows-1252 bytes to their Unicode codepoints
# Common Windows-1252: 0x80-0x9F map to various Unicode chars
text = data.decode("latin-1")

# Replace problematic Windows-1252 bytes that are likely artifacts
# 0x95 = bullet in Win-1252, but in our case it's likely just garbage
# Replace standalone bullet/nbsp/etc with regular space or remove
problem_chars = {
    "\u0095": "",  # control bullet
    "\u0085": "",  # ellipsis (...)
    "\u0099": "",  # TM
    "\u0098": "",  # circumflex
}
for k, v in problem_chars.items():
    text = text.replace(k, v)

# Save as UTF-8 (no BOM)
with open(fp, "w", encoding="utf-8") as f:
    f.write(text)

# Verify
with open(fp, "rb") as f:
    new_data = f.read()
new_data.decode("utf-8")
print(f"Fixed. {len(data)} -> {len(new_data)} bytes")
