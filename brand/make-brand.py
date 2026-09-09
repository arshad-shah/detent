#!/usr/bin/env python3
"""
Regenerates the detent brand assets.

The wordmark is drawn from outlined glyphs rather than live text, so every SVG
here renders identically without the font installed.

    pip install fonttools
    python3 brand/make-brand.py
"""

import os
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_CSS = (
    "https://fonts.googleapis.com/css2?"
    "family=Bricolage+Grotesque:opsz,wght@12..96,300..800&display=swap"
)

INK = "#2B2D24"
PAPER = "#E7E5DC"
PANEL = "#FAF9F5"
SIGNAL = "#A82A57"
SIGNAL_SOFT = "#F4DEE6"
MUTED = "#6E7264"
LINE = "#C9C6B8"

WORD = "detent"
TRACKING = -30  # font units per gap, roughly -0.03em


def font_path() -> str:
    cached = "/tmp/bricolage-700.ttf"
    if os.path.exists(cached):
        return cached
    request = urllib.request.Request(FONT_CSS, headers={"User-Agent": "Mozilla/5.0"})
    css = urllib.request.urlopen(request).read().decode()
    block = css.split("font-weight: 700")[1]
    url = block.split("url(")[1].split(")")[0]
    urllib.request.urlretrieve(url, cached)
    return cached


def wordmark_geometry():
    """Return (path_data, width, height) in a y-down coordinate space."""
    font = TTFont(font_path())
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    commands = []
    pen_x = 0
    x_min = y_min = 1e9
    x_max = y_max = -1e9

    for i, ch in enumerate(WORD):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        d = pen.getCommands()

        bounds = BoundsPen(glyphs)
        glyphs[name].draw(bounds)
        if bounds.bounds:
            gx0, gy0, gx1, gy1 = bounds.bounds
            x_min = min(x_min, gx0 + pen_x)
            x_max = max(x_max, gx1 + pen_x)
            y_min = min(y_min, gy0)
            y_max = max(y_max, gy1)

        if d:
            commands.append(f'<path transform="translate({pen_x} 0)" d="{d}"/>')
        pen_x += hmtx[name][0] + (TRACKING if i < len(WORD) - 1 else 0)

    width = x_max - x_min
    height = y_max - y_min
    # Flip to y-down and shift so the drawing starts at the origin.
    group = (
        f'<g transform="translate({-x_min} {y_max}) scale(1 -1)">'
        + "".join(commands)
        + "</g>"
    )
    return group, width, height


def svg(width, height, body, extra=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" '
        f'width="{width:g}" height="{height:g}" fill="none"{extra}>\n{body}\n</svg>\n'
    )


# The mark drawn in a 48x48 box, plus the tight bounds of what it actually
# covers — the square has air around it for icon use, but a lockup has to size
# the drawing itself or the mark looks shrunken beside the word.
MARK_PATH = "M9 22 H14 A10 10 0 0 0 34 22 H39"
MARK_BOUNDS = (7, 13.5, 41, 34)  # x0, y0, x1, y1


def mark_shapes(ink, signal):
    return (
        f'<path d="{MARK_PATH}" stroke="{ink}" stroke-width="4" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="24" cy="20" r="6.5" fill="{signal}"/>'
    )


def mark(ink=INK, signal=SIGNAL, plate=None):
    """
    A part resting in its seat: one rail with one detent, and the thing that
    settled into it. Two shapes, so it survives being shrunk.
    """
    body = ""
    if plate:
        body += f'  <rect width="48" height="48" rx="11" fill="{plate}"/>\n'
    body += "  " + mark_shapes(ink, signal)
    return svg(48, 48, body)


def lockup(ink=INK, signal=SIGNAL):
    group, w, h = wordmark_geometry()
    height = 48.0
    word_h = 25.0
    scale = word_h / h
    word_w = w * scale

    x0, y0, x1, y1 = MARK_BOUNDS
    mark_h = 30.0                       # drawn slightly taller than the word
    ms = mark_h / (y1 - y0)
    mark_w = (x1 - x0) * ms
    gap = 16.0

    mark_group = (
        f'  <g transform="translate({-x0 * ms:.3f} {(height - mark_h) / 2 - y0 * ms:.3f}) '
        f'scale({ms:.4f})">{mark_shapes(ink, signal)}</g>\n'
    )
    word_group = (
        f'  <g transform="translate({mark_w + gap:.3f} {(height - word_h) / 2:.3f}) '
        f'scale({scale})" fill="{ink}">{group}</g>'
    )
    return svg(round(mark_w + gap + word_w, 2), height, mark_group + word_group)


def wordmark(ink=INK):
    group, w, h = wordmark_geometry()
    scale = 100.0 / h
    return svg(
        round(w * scale, 2),
        100,
        f'  <g transform="translate(0 0) scale({scale})" fill="{ink}">{group}</g>',
    )


def favicon():
    body = (
        f'  <rect width="48" height="48" rx="11" fill="{INK}"/>\n'
        f'  <path d="M10 23 H15 A9 9 0 0 0 33 23 H38" stroke="{PAPER}" '
        'stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n'
        f'  <circle cx="24" cy="21" r="6" fill="{SIGNAL}"/>'
    )
    return svg(48, 48, body)


def write(relative, content):
    path = os.path.join(HERE, relative)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as handle:
        handle.write(content)
    print("  ", os.path.relpath(path, os.path.dirname(HERE)))


def main():
    print("writing brand assets")
    write("logo/detent-mark.svg", mark())
    write("logo/detent-mark-mono.svg", mark(ink="currentColor", signal="currentColor"))
    write("logo/detent-mark-inverse.svg", mark(ink=PAPER, signal=SIGNAL))
    write("logo/detent-mark-plate.svg", mark(ink=PAPER, signal=SIGNAL, plate=INK))
    write("logo/detent-lockup.svg", lockup())
    write("logo/detent-lockup-mono.svg", lockup(ink="currentColor", signal="currentColor"))
    write("logo/detent-lockup-inverse.svg", lockup(ink=PAPER, signal=SIGNAL))
    write("logo/detent-wordmark.svg", wordmark())
    write("favicon/favicon.svg", favicon())
    write(
        "tokens.css",
        f""":root {{
  --detent-ink: {INK};
  --detent-paper: {PAPER};
  --detent-panel: {PANEL};
  --detent-signal: {SIGNAL};
  --detent-signal-soft: {SIGNAL_SOFT};
  --detent-muted: {MUTED};
  --detent-line: {LINE};

  --detent-font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --detent-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}}
""",
    )


if __name__ == "__main__":
    main()
