#!/usr/bin/env python3
"""Generate placeholder icons for Voir.
Requires Pillow: pip install Pillow
"""

import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not installed. Creating minimal PNG placeholders...")
    import struct, zlib

    def create_minimal_png(width, height, filepath):
        """Create a minimal valid PNG with a colored rectangle."""

        def chunk(chunk_type, data):
            c = chunk_type + data
            return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

        # IHDR
        ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
        # IDAT - simple colored rows
        raw = b''
        for y in range(height):
            raw += b'\x00'  # filter none
            for x in range(width):
                # Dark blue-gray gradient
                r = 30
                g = 40 + int(60 * y / height)
                b = 80 + int(100 * y / height)
                raw += struct.pack('BBB', r, g, b)

        idat_data = zlib.compress(raw)
        png = b'\x89PNG\r\n\x1a\n'
        png += chunk(b'IHDR', ihdr_data)
        png += chunk(b'IDAT', idat_data)
        png += chunk(b'IEND', b'')

        with open(filepath, 'wb') as f:
            f.write(png)
        print(f"  Created {filepath} ({width}x{height})")

    create_minimal_png(32, 32, 'src-tauri/icons/32x32.png')
    create_minimal_png(128, 128, 'src-tauri/icons/128x128.png')
    create_minimal_png(256, 256, 'src-tauri/icons/128x128@2x.png')

    # Create ICO (just use 32x32 PNG as a basic .ico)
    import shutil
    shutil.copy('src-tauri/icons/32x32.png', 'src-tauri/icons/icon.ico')
    print("  Created icon.ico (placeholder)")
    print("\nDone! Replace these with proper icons before release.")
    sys.exit(0)

# ── Pillow available ──

def create_icon(size, filepath):
    """Create a stylish V icon."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background: rounded rectangle (dark blue)
    margin = size // 10
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 5,
        fill=(22, 27, 34, 255),
    )

    # Draw "V" letter
    font_size = int(size * 0.55)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

    text = "V"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2 - size // 20

    # Accent color text
    draw.text((x, y), text, fill=(88, 166, 255, 255), font=font)

    img.save(filepath, 'PNG')
    print(f"  Created {filepath} ({size}x{size})")


create_icon(32, 'src-tauri/icons/32x32.png')
create_icon(128, 'src-tauri/icons/128x128.png')
create_icon(256, 'src-tauri/icons/128x128@2x.png')

# ICO file (multi-resolution)
icons = [
    Image.open('src-tauri/icons/32x32.png'),
]
icons[0].save(
    'src-tauri/icons/icon.ico',
    format='ICO',
    sizes=[(32, 32)],
)
print("  Created icon.ico")

print("\nIcon generation complete!")
