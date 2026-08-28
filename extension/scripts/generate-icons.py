"""
Generates the extension's toolbar icons — a purple rounded square with a
bold white "V". Run with: python3 extension/scripts/generate-icons.py
Output: extension/public/icons/icon-{16,32,48,128}.png
"""

from PIL import Image, ImageDraw
import os

PURPLE = (124, 116, 255, 255)  # matches the extension popup's --brand color
WHITE = (255, 255, 255, 255)

SIZES = [16, 32, 48, 128]
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")


def draw_icon(size: int) -> Image.Image:
    # Supersample for crisp edges at small sizes, then downscale.
    scale = 8
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = s * 0.22
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=PURPLE)

    # A bold chevron "V": outer top corners, inner top corners, and two
    # bottom vertices (inner shallower, outer deeper) give it real stroke width.
    v = [
        (0.16 * s, 0.20 * s),  # top-left outer
        (0.33 * s, 0.20 * s),  # top-left inner
        (0.50 * s, 0.58 * s),  # bottom inner vertex
        (0.67 * s, 0.20 * s),  # top-right inner
        (0.84 * s, 0.20 * s),  # top-right outer
        (0.50 * s, 0.82 * s),  # bottom outer vertex (the point of the V)
    ]
    draw.polygon(v, fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        icon = draw_icon(size)
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        icon.save(path)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
