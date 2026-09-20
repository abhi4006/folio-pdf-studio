import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
const assetBase = new URL(import.meta.env.BASE_URL, window.location.href);
const MAX_PAGES = 500;
const abortIfNeeded = signal => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
export function formatSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function openPdf(bytes, password = '') {
  return pdfjs.getDocument({ data: bytes.slice(), password, isEvalSupported: false, enableXfa: false, cMapUrl: new URL('pdfjs/cmaps/', assetBase).href, cMapPacked: true, standardFontDataUrl: new URL('pdfjs/standard_fonts/', assetBase).href, wasmUrl: new URL('pdfjs/wasm/', assetBase).href });
}
export async function inspectPdf(file, signal) {
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  abortIfNeeded(signal);
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new Error('This file does not appear to be a valid PDF. Please choose another file.');
  const task = openPdf(bytes);
  const onAbort = () => { task.destroy().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error('Please choose a document with 500 pages or fewer.');
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const preview = page.getViewport({ scale: Math.min(160 / viewport.width, 200 / viewport.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(preview.width); canvas.height = Math.ceil(preview.height);
    await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport: preview }).promise;
    const thumbnail = canvas.toDataURL('image/jpeg', .75);
    canvas.width = canvas.height = 0;
    return { locked: false, pages: pdf.numPages, thumbnail };
  } catch (e) {
    abortIfNeeded(signal);
    if (e.name === 'PasswordException') return { locked: true };
    if (e.message?.includes('500 pages')) throw e;
    throw new Error('This PDF could not be read. It may be damaged or use an unsupported format.');
  } finally { signal?.removeEventListener('abort', onAbort); await task.destroy(); }
}
function qpdf(bytes, password, quality, signal) {
  abortIfNeeded(signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('engine/qpdf-worker.js', assetBase));
    let timeout;
    const cleanup = () => { clearTimeout(timeout); worker.terminate(); signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
    timeout = setTimeout(() => { cleanup(); reject(new Error('Processing took too long. Try a smaller document.')); }, 120000);
    worker.onerror = () => { cleanup(); reject(new Error('The PDF engine could not start. Refresh the page and try again in a recent browser.')); };
    worker.onmessage = ({ data }) => { cleanup(); if (data.error) reject(new Error(data.error)); else resolve({ bytes: new Uint8Array(data.output), warning: data.warning }); };
    const copy = bytes.slice();
    worker.postMessage({ bytes: copy.buffer, password, quality }, [copy.buffer]);
  });
}
const PAPER = { a4: [210, 297], a3: [297, 420], a5: [148, 210], letter: [215.9, 279.4], legal: [215.9, 355.6] };
async function resizePages(bytes, options, report, signal) {
  const source = await PDFDocument.load(bytes);
  if (source.getPageCount() > MAX_PAGES) throw new Error('Please choose a document with 500 pages or fewer.');
  if (source.getForm().getFields().length) {
    try { source.getForm().flatten(); } catch { throw new Error('This PDF has forms that cannot be safely resized. Save a flattened copy from your PDF editor and try again.'); }
  }
  const output = await PDFDocument.create();
  output.setTitle(source.getTitle() || 'Resized document');
  for (const [index, page] of source.getPages().entries()) {
    abortIfNeeded(signal);
    const box = page.getCropBox(), media = page.getMediaBox();
    const left = Math.max(box.x, media.x), bottom = Math.max(box.y, media.y);
    const right = Math.min(box.x + box.width, media.x + media.width), top = Math.min(box.y + box.height, media.y + media.height);
    const crop = right > left && top > bottom ? { x: left, y: bottom, width: right - left, height: top - bottom } : media;
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const sideways = rotation === 90 || rotation === 270;
    const visibleWidth = sideways ? crop.height : crop.width;
    const visibleHeight = sideways ? crop.width : crop.height;
    let [w, h] = (options.size === 'custom' ? [options.width, options.height] : PAPER[options.size]).map(v => v * 72 / 25.4);
    if (options.size !== 'custom' && (options.orientation === 'landscape' || (options.orientation === 'auto' && visibleWidth > visibleHeight))) [w, h] = [h, w];
    const scale = Math.min(w / visibleWidth, h / visibleHeight);
    const x = (w - visibleWidth * scale) / 2, y = (h - visibleHeight * scale) / 2;
    const destination = output.addPage([w, h]);
    if (page.node.Contents()) {
      const embedded = await output.embedPage(page, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
      const offsets = { 0: [0, 0], 90: [0, crop.width * scale], 180: [crop.width * scale, crop.height * scale], 270: [crop.height * scale, 0] }[rotation] || [0, 0];
      destination.drawPage(embedded, { x: x + offsets[0], y: y + offsets[1], width: crop.width * scale, height: crop.height * scale, rotate: degrees(-rotation) });
    }
    report({ value: 40 + Math.round((index + 1) / source.getPageCount() * 50), label: `Resizing page ${index + 1} of ${source.getPageCount()}…` });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return output.save({ useObjectStreams: true });
}
async function compressScans(bytes, report, signal) {
  const task = openPdf(bytes);
  const onAbort = () => { task.destroy().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  const result = await PDFDocument.create();
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error('Please choose a document with 500 pages or fewer.');
    for (let number = 1; number <= pdf.numPages; number++) {
      abortIfNeeded(signal);
      const page = await pdf.getPage(number);
      const physical = page.getViewport({ scale: 1 });
      const scale = Math.min(100 / 72, 2400 / Math.max(physical.width, physical.height), Math.sqrt(4000000 / (physical.width * physical.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
      try {
        await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport, background: 'rgb(255,255,255)', annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .56));
        if (!blob) throw new Error('This page is too large for your browser. Try Original quality instead.');
        const jpg = await result.embedJpg(await blob.arrayBuffer());
        result.addPage([physical.width, physical.height]).drawImage(jpg, { x: 0, y: 0, width: physical.width, height: physical.height });
      } finally { canvas.width = canvas.height = 0; page.cleanup(); }
      report({ value: 40 + Math.round(number / pdf.numPages * 50), label: `Compressing page ${number} of ${pdf.numPages}…` });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    abortIfNeeded(signal);
    return await result.save({ useObjectStreams: true });
  } finally { signal?.removeEventListener('abort', onAbort); await task.destroy(); }
}
export async function processPdf(file, options, report = () => {}, signal) {
  abortIfNeeded(signal);
  report({ value: 15, label: 'Opening the PDF engine…' });
  const input = new Uint8Array(await file.arrayBuffer());
  const unpacked = await qpdf(input, options.password || '', options.tool === 'compress' && options.quality === 'balanced' ? 'balanced' : 'lossless', signal);
  abortIfNeeded(signal);
  report({ value: 40, label: 'Preparing your new PDF…' });
  let bytes = unpacked.bytes, note = '';
  if (options.tool === 'resize') bytes = await resizePages(bytes, options, report, signal);
  if (options.tool === 'compress' && options.quality === 'small') {
    const rasterized = await compressScans(bytes, report, signal);
    if (rasterized.byteLength < bytes.byteLength) bytes = rasterized;
    else note = 'Image compression would make this file larger, so we kept the smaller version with its original content.';
  }
  if (options.tool === 'compress' && bytes.byteLength >= input.byteLength) {
    const validation = openPdf(input);
    let originalIsOpen = false;
    try { await validation.promise; originalIsOpen = true; } catch { /* Retain unlocked output. */ }
    finally { await validation.destroy(); }
    if (originalIsOpen) bytes = input;
    note = originalIsOpen ? 'This PDF is already efficiently compressed. Your original is the smallest version, so we kept it unchanged.' : 'This PDF is already efficiently compressed. The unlocked copy is slightly larger; its content is preserved.';
  }
  if (unpacked.warning) note += (note ? ' ' : '') + 'The PDF needed minor repairs. Please review your downloaded copy.';
  abortIfNeeded(signal);
  report({ value: 100, label: 'Ready to download.' });
  return { bytes, note };
}
export async function createDemo() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 655, width: 595.28, height: 187, color: rgb(.07, .24, .2) });
  page.drawText('folio.', { x: 55, y: 759, size: 43, font: bold, color: rgb(.8, .94, .68) });
  page.drawText('A little less friction.', { x: 55, y: 707, size: 20, font, color: rgb(1, 1, 1) });
  page.drawText('Your sample PDF', { x: 55, y: 584, size: 26, font: bold, color: rgb(.13, .24, .18) });
  ['This is a safe place to try things out.', 'Resize this page to A4, Letter, or a custom size.', 'Try compression and compare the file sizes.', 'Your original document always stays unchanged.', '', 'This sample opens without a password.', 'For protected files, use the password you already know.'].forEach((line, i) => page.drawText(line, { x: 55, y: 534 - i * 28, size: 13, font, color: rgb(.4, .47, .4) }));
  page.drawText('Made for your everyday PDFs.', { x: 55, y: 60, size: 11, font, color: rgb(.5, .6, .47) });
  return new File([await pdf.save()], 'folio-sample.pdf', { type: 'application/pdf' });
}
