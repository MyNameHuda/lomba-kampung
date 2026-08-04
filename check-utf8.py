"""Check for non-UTF-8 bytes in pengaturan-client.tsx"""
fp = r"C:\Users\bangn\Documents\Kerja\lomba\lomba-app\app\admin\pengaturan\pengaturan-client.tsx"
with open(fp, "rb") as f:
    data = f.read()
# Try UTF-8 strict
try:
    data.decode("utf-8")
    print("File is valid UTF-8")
except UnicodeDecodeError as e:
    print(f"BAD UTF-8 at byte {e.start}: byte values around there:")
    for i in range(max(0, e.start-5), min(len(data), e.end+5)):
        print(f"  byte {i}: 0x{data[i]:02x} ({chr(data[i]) if 32 <= data[i] < 127 else '?'})")
    # Check for BOM
    if data[:3] == b'\xef\xbb\xbf':
        print("  Has UTF-8 BOM at start")
    if data[:2] in (b'\xff\xfe', b'\xfe\xff'):
        print("  Has UTF-16 BOM at start")
