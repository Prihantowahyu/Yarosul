"""
Auto-crop whitespace from all 48 scanned book pages.
Detects actual content bounding box per page, adds small uniform padding,
then saves back as optimized WebP.
"""
from PIL import Image
import os

INPUT_DIR = 'assets/pages'
OUTPUT_DIR = 'assets/pages'  # overwrite in-place
TOTAL_PAGES = 48
PADDING = 8          # px of breathing room around content
THRESHOLD = 235      # pixels darker than this = content (catches light grey scan artifacts)
WEBP_QUALITY = 88   # good quality / size balance

stats = []

for page_num in range(1, TOTAL_PAGES + 1):
    path = os.path.join(INPUT_DIR, f'page_{page_num}.webp')
    img = Image.open(path).convert('RGB')
    orig_w, orig_h = img.size

    # Build mask: pixels darker than threshold are "content"
    gray = img.convert('L')
    thresh = gray.point(lambda px: 255 if px < THRESHOLD else 0)
    bbox = thresh.getbbox()

    if bbox is None:
        # Page is entirely white - skip
        print(f'  Page {page_num:2d}: all white, skip')
        stats.append((page_num, orig_w, orig_h, orig_w, orig_h))
        continue

    # Expand bbox by padding, clamped to image bounds
    left   = max(0,       bbox[0] - PADDING)
    top    = max(0,       bbox[1] - PADDING)
    right  = min(orig_w,  bbox[2] + PADDING)
    bottom = min(orig_h,  bbox[3] + PADDING)

    cropped = img.crop((left, top, right, bottom))
    new_w, new_h = cropped.size

    # Save as WebP
    cropped.save(path, 'WEBP', quality=WEBP_QUALITY, method=6)

    size_kb = os.path.getsize(path) / 1024
    print(f'  Page {page_num:2d}: {orig_w}x{orig_h} -> {new_w}x{new_h} | L={bbox[0]} T={bbox[1]} R={orig_w-bbox[2]} B={orig_h-bbox[3]} | {size_kb:.0f}KB')
    stats.append((page_num, orig_w, orig_h, new_w, new_h))

print(f'\nDone! All {TOTAL_PAGES} pages auto-cropped.')
total_kb = sum(os.path.getsize(f'assets/pages/page_{i}.webp') for i in range(1, TOTAL_PAGES + 1)) / 1024
print(f'Total size: {total_kb:.0f} KB ({total_kb/1024:.2f} MB)')
