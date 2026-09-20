# Folio PDF Studio

A complete browser-only PDF workspace for unlocking, compressing, and resizing PDFs.

**Live site:** https://abhi4006.github.io/folio-pdf-studio/

## Features

- Remove encryption with a known user or owner password, including AES-256.
- Original-quality compression without rasterizing text or images.
- Balanced image optimization while preserving selectable text.
- Strong scan compression at approximately 100 DPI; clearly disclosed image-only output.
- Resize pages to A4, A3, A5, US Letter, US Legal, or custom dimensions (20–2,000 mm).
- Preserve rotated page orientation and CropBox content, fit without stretching or cropping.
- File preview, drag-and-drop, progress, cancellation, useful error messages, and downloads.
- Responsive keyboard-accessible UI, built-in sample, local fonts, and no third-party document processing.
- PDF processing engines and their assets are self-hosted. No API keys, database, or backend required.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Installation copies QPDF WASM and PDF.js supporting assets from pinned dependencies. Generated vendor files are ignored by Git and recreated during build.

## Tests

```sh
npx playwright install chromium
npm test
```

The 15-case real-browser engine suite verifies AES-256 decryption, incorrect password rejection, malformed PDF rejection, all compression modes, text preservation, page counts, standard/custom sizes, rotated crop boxes, cancellation, and sample generation. UI tests verify password retry, actual downloaded bytes, and mobile layout. To inspect the engine suite manually, run the dev server and open `/tests/browser.html`. Test fixtures are synthetic and contain no personal documents.

## Build and deploy

```sh
BASE_PATH=/folio-pdf-studio/ npm run build
```

GitHub Pages must use **GitHub Actions** as its source. The included workflow runs tests, builds the static app, and deploys automatically on every push to `main`. To use a different repository name or custom domain, update `BASE_PATH` in `.github/workflows/deploy.yml` and the source link in `src/App.jsx`.

## Privacy and limitations

Selected PDFs and passwords stay in browser memory; no document upload requests, analytics, cookies, or document persistence are implemented. The hosting provider receives ordinary website requests and their normal connection metadata. Refreshing/closing the page clears application state. QPDF workers are terminated after each operation; password input is cleared after successful processing. JavaScript cannot guarantee forensic memory erasure.

A known password is required for password-to-open PDFs. This is not a password recovery service. Only edit documents you have permission to modify. Keep the original file, especially for signed documents: modifications can invalidate signatures.

Files are limited to 50 MB. Inspection and page transformation support up to 500 pages. Browser/device memory can impose lower practical limits. Current evergreen browsers with WebAssembly are required.

Compression savings depend on the document. The app retains the smaller unchanged original when further compression is counterproductive and that original opens without a password. Smallest-file mode can remove searchable/selectable text and interactive features by rasterizing pages. Page resizing preserves vector/text content, flattens supported forms, and removes annotations/links. Embedded attachments, outlines, and document-level metadata are not copied into the resized document.

## Technology and notices

React, Vite, Lucide, PDF.js, pdf-lib, and QPDF WebAssembly. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and bundled upstream notices in `public/licenses`.
