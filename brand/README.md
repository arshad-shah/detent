<img src="logo/detent-lockup.svg" alt="detent" height="44">

# Brand

Everything here is generated. Nothing is hand-edited — change the source
scripts and re-run:

```bash
pip install fonttools
python3 brand/make-brand.py   # SVGs and tokens
node brand/render.mjs         # PNGs, social card, brand sheet
```

`brand-sheet.png` is the one-page overview. Open `brand-sheet.html` to see it
live.

## The name

A **detent** is the mechanical catch that holds a moving part at a set
position — the click you feel when a dial lands on a setting, or a switch
snaps home. It is what the library produces: something moves freely, then
settles into place.

Pronounced *dee-TENT*. Always lowercase as a package name; capitalised as
Detent at the start of a sentence.

## The mark

A part resting in its seat. One rail with one detent, and the thing that
settled into it — two shapes, so it survives being shrunk.

| File | Use |
| --- | --- |
| `logo/detent-mark.svg` | Default, on light backgrounds |
| `logo/detent-mark-inverse.svg` | On Ink or any dark surface |
| `logo/detent-mark-mono.svg` | Inherits `currentColor` — for single-colour contexts |
| `logo/detent-mark-plate.svg` | On a rounded Ink plate, for avatars and app icons |
| `logo/detent-lockup.svg` | Mark plus word, the default signature |
| `logo/detent-lockup-inverse.svg` | The same on dark |
| `logo/detent-lockup-mono.svg` | Single colour |
| `logo/detent-wordmark.svg` | Word alone, when the mark appears elsewhere |
| `favicon/favicon.svg` | Browser tab |
| `favicon/icon-32/180/512.png` | Favicon, Apple touch icon, PWA |
| `social/og-image.png` | 1200×630 link preview |

**Below about 24px, use the plate version.** The open mark loses its seat at
small sizes and reads as a dot on a line.

Clear space around the lockup is the height of the mark on every side. Don't
re-set the word in another typeface — the supplied files are outlined, so they
render identically without the font installed.

Don't recolour the ball to anything but Signal, don't add a gradient, and don't
put the mark inside another shape besides the supplied plate.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| Ink | `#2B2D24` | Text, the rail, dark surfaces |
| Paper | `#E7E5DC` | Page background |
| Panel | `#FAF9F5` | Raised surfaces, cards |
| Signal | `#A82A57` | The seated part, active and dragging states |
| Signal soft | `#F4DEE6` | Active fills, highlights |
| Muted | `#6E7264` | Secondary text |
| Line | `#C9C6B8` | Rules and borders |

Signal marks the thing that just moved. It is never body text on Paper — the
contrast is too low. One accent only; a second colour undoes the point of
having one.

`tokens.css` has these as custom properties.

## Type

**Bricolage Grotesque** for display and interface, weights 300–800. It has
enough character to carry a wordmark without being a novelty face.

**JetBrains Mono** for code, measurements and live readouts, 400 and 600. Only
where the content is genuinely data — not as decoration on labels.

## Voice

Say what it does, not what it feels like. Numbers instead of adjectives: "5.8
KB gzipped", not "tiny". Name the trade-off when there is one.

Avoid "blazingly fast" and "buttery smooth". Don't claim it replaces anything.

## Favicon markup

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/icon-180.png">
<meta property="og:image" content="/og-image.png">
```
