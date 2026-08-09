# Frame in Goa

A frame + ID card generator for **Hacker House Goa 2026**. Drop a photo, get a branded graphic, post it to X. No login, no signup, no gate before the result.

Built for the HH Goa 2026 shortlisting task.

---

## Why it looks like this

`hhgoa.com`'s own tagline is **"Less Noise. More Signal."**

So the interface is quiet on purpose. The chrome is neutral — white, `#f5f5f7` parchment, `#1d1d1f` ink, one accent colour — and every bit of brand saturation lives inside the graphic you're actually going to post. The UI recedes so the product can speak, and here the graphic *is* the product.

The accent is HH sunset orange (`#E8622C`) rather than the event green, because in the chrome the green would compete with the artifact sitting right next to it.

---

## The three things that are hard about this brief

### 1. Real photos, not pre-cropped ones

The brief says not to assume users crop first. Sliders technically satisfy that while handing the work straight back to the user.

Instead, on upload the app runs **BlazeFace** (MediaPipe Tasks Vision) and solves for the crop that puts the subject where a face should sit in an avatar — roughly 46% of the frame, eyes a little above centre. A 1920×1152 landscape shot becomes a correct square avatar with zero input.

It's a progressive enhancement, never a dependency:

- The centre-crop preview renders **immediately**; the framed transform animates in when detection resolves.
- No face, unsupported browser, or a detector failure → centre cover-crop, no error, no blocking.
- The ~3.3MB wasm is lazy and starts downloading when you first *touch* the dropzone, so the transfer overlaps the time you spend in the file picker.
- Multiple faces → the **largest** one. Unioning them sounds fairer but puts the crop centre on the background between two people and clips both.

### 2. The share flow

**X web intents cannot attach media.** There's no parameter for it. There are exactly two ways to get a real image into a post, and which one exists depends on the device — so both are implemented:

| Context | Path |
|---|---|
| iOS Safari / Android Chrome | `navigator.share({ files })` → X app opens with the PNG genuinely attached |
| Desktop | Upload → `/s/<id>` link whose `summary_large_image` card renders the graphic |
| Desktop, faster | Copy to clipboard → paste straight into the X composer |

Two details that quietly break this if missed:

- **`navigator.share()` must be called synchronously inside the click handler.** Safari drops user activation across an `await`, including awaiting `canvas.toBlob`. So an exported blob is kept current in state and the handler reaches for bytes that already exist.
- **X centre-crops OG images to ~2:1.** Handing it the 1080×1080 slices the top and bottom off the frame — exactly the degraded preview the brief warns about. A dedicated 1200×630 variant is rendered and uploaded alongside.

### 3. Speed

Everything is drawn with **Canvas 2D directly** — no `html2canvas`, which is the usual reach for this and is both slow and flaky about fonts. The preview canvas is sized at true output resolution and constrained with CSS, so preview and export are literally the same canvas. WYSIWYG is guaranteed by construction rather than by keeping two renderers in sync.

Measured locally, warm:

| Step | Time |
|---|---|
| Decode (incl. downscale) | 8–61 ms |
| Auto-frame | 6–22 ms |
| Render | 0–18 ms |
| HEIC decode (Chrome, cold libheif) | ~2.9 s |

First load is **193 KB total** (140 KB JS, gzipped), measured against a production build. The face detector and libheif are both excluded from it and load only on demand.

The Devanagari face is subset to the four codepoints in गोवा — U+917, U+935, U+93E, U+94B — which is the only Devanagari the app ever draws. 115 KB → 1 KB.

---

## Formats

- **Profile frame** — 1080×1080. Designed around the fact that X renders avatars as *circles*: the branding lives in an annular band so nothing lands in the clipped corners, and it still reads at 48px in a timeline.
- **Builder ID** — 1080×1350. 4:5 is the tallest ratio X shows uncropped in-feed.

Builder titles are deterministic from the name (stable across re-renders, rerollable). They're written deadpan — "Ships on Fridays", "Reverts Without Ego" — because the event's voice is dry, and mystical noun-pairing is the easy joke.

---

## Photo handling

- **HEIC/HEIF** — tries the native decode first (Safari has it), falls back to `heic-to`/libheif only when that fails, so most users never download the wasm.
- **EXIF rotation** — `createImageBitmap(blob, { imageOrientation: "from-image" })`. This is what stops portrait iPhone shots arriving sideways.
- **MIME sniffing** — iOS file inputs routinely report an empty `type`; extension is checked too, and HEIC extensions are listed in `accept` or the picker greys those photos out.
- **Downscale to 1600px** on decode. A 12MP original otherwise makes drag-to-pan stutter on a phone.

Tested against: portrait, landscape, wide crop, off-centre subject, two faces, a 120×180 thumbnail, no-face images, and a real HEIC.

---

## Running it

```bash
npm install
npm run dev
```

Sharing by link needs a Vercel Blob store. On Vercel, create one and `BLOB_READ_WRITE_TOKEN` is injected automatically. Without it the API returns 503 and the UI falls back to download-and-attach — the app still works end to end.

```bash
NEXT_PUBLIC_SITE_URL=https://your-deploy.vercel.app
BLOB_READ_WRITE_TOKEN=...
```

---

## Structure

```
app/
  page.tsx           the whole tool, one page
  s/[id]/page.tsx    share landing + OG card metadata
  api/share/route.ts upload -> Vercel Blob
lib/
  decode.ts          File -> ImageBitmap (HEIC, EXIF, downscale)
  autoframe.ts       face detection -> crop transform
  render/            Canvas 2D artwork (pfp, card, og)
  share.ts           navigator.share / intent / clipboard
  titles.ts          deterministic builder titles
```

---

Unofficial, fan-made, not affiliated with the organisers.
