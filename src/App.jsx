import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronRight, CircleHelp, FileText, Code2, HardDrive, Leaf, LockKeyhole, Maximize, Minimize2, ShieldCheck, Sparkles, Upload, X, Eye, EyeOff, LoaderCircle, RotateCcw } from 'lucide-react';
import { inspectPdf, processPdf, createDemo, formatSize } from './pdf.js';

const TOOLS = {
  unlock: { label: 'Unlock PDF', short: 'Remove password protection', title: 'A little less locked.', description: 'Open up your PDF. Enter its password once, then save a copy without it.', icon: LockKeyhole, action: 'Unlock PDF' },
  compress: { label: 'Compress PDF', short: 'Make room for more', title: 'Less size. More possibilities.', description: 'Make your PDF easier to email, upload, and share.', icon: Minimize2, action: 'Compress PDF' },
  resize: { label: 'Resize pages', short: 'Find the perfect fit', title: 'The right size for the job.', description: 'Fit your pages to a new paper size without cropping the content.', icon: Maximize, action: 'Resize PDF' },
};

export default function App() {
  const [tool, setTool] = useState('unlock');
  const [file, setFile] = useState(null);
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [quality, setQuality] = useState('balanced');
  const [size, setSize] = useState('a4');
  const [orientation, setOrientation] = useState('auto');
  const [width, setWidth] = useState('210');
  const [height, setHeight] = useState('297');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ value: 0, label: '' });
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [help, setHelp] = useState(false);
  const fileInput = useRef(null);
  const controller = useRef(null);
  const sequence = useRef(0);
  const model = TOOLS[tool];

  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => { if (!result) return; return () => URL.revokeObjectURL(result.url); }, [result]);

  const reset = () => {
    sequence.current++; controller.current?.abort();
    setBusy(false); setFile(null); setInfo(null); setPassword(''); setResult(null); setError('');
    if (fileInput.current) fileInput.current.value = '';
  };
  const chooseTool = (next) => { if (busy) return; setTool(next); setResult(null); setError(''); };
  async function loadFile(next) {
    if (!next || busy) return;
    reset();
    if (!next.name.toLowerCase().endsWith('.pdf')) return setError('Please choose a PDF file (.pdf).');
    if (next.size === 0) return setError('This file is empty. Please choose another PDF.');
    if (next.size > 50 * 1024 * 1024) return setError('Please choose a PDF smaller than 50 MB.');
    const current = sequence.current;
    controller.current = new AbortController();
    setBusy(true); setProgress({ value: 12, label: 'Reading your document…' });
    try {
      const details = await inspectPdf(next, controller.current.signal);
      if (current !== sequence.current) return;
      setFile(next); setInfo(details);
    } catch (e) { if (current === sequence.current) setError(e.message); }
    finally { if (current === sequence.current) setBusy(false); }
  }

  async function run() {
    if (!file || busy) return;
    if (info?.locked && !password) return setError('Enter the document password to continue.');
    if (tool === 'resize' && size === 'custom' && (![width, height].every(v => Number.isFinite(Number(v)) && Number(v) >= 20 && Number(v) <= 2000))) return setError('Enter a width and height between 20 and 2,000 mm.');
    const current = sequence.current;
    controller.current = new AbortController();
    setError(''); setResult(null); setBusy(true);
    try {
      const output = await processPdf(file, { tool, password, quality, size, orientation, width: Number(width), height: Number(height) }, setProgress, controller.current.signal);
      if (current !== sequence.current) return;
      const suffix = tool === 'unlock' ? 'unlocked' : tool === 'compress' ? 'compressed' : 'resized';
      const blob = new Blob([output.bytes], { type: 'application/pdf' });
      setResult({ ...output, blob, url: URL.createObjectURL(blob), name: file.name.replace(/\.pdf$/i, '') + '-' + suffix + '.pdf', original: file.size });
      setPassword('');
    } catch (e) { if (current === sequence.current && e.name !== 'AbortError') setError(e.message || 'We could not process this PDF. Please try another file.'); }
    finally { if (current === sequence.current) setBusy(false); }
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(context.registerTool({ name: 'select_pdf_tool', title: 'Select a PDF tool', description: 'Select unlock, compress, or page resize in the PDF workspace. Does not open files or process a document.', inputSchema: { type: 'object', properties: { tool: { type: 'string', enum: ['unlock', 'compress', 'resize'] } }, required: ['tool'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (input) => { if (!input || !Object.hasOwn(TOOLS, input.tool)) throw new Error('Choose unlock, compress, or resize.'); if (busy) throw new Error('Wait for the current operation to finish.'); chooseTool(input.tool); return { selectedTool: input.tool }; } }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [busy]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="Folio home" onClick={e => { e.preventDefault(); if (!busy) { reset(); chooseTool('unlock'); } }}><span className="brand-mark"><FileText size={25} strokeWidth={1.8} /></span>folio<span className="brand-period">.</span></a>
      <div className="sidebar-label">YOUR PDF TOOLKIT</div>
      <nav aria-label="PDF tools">{Object.entries(TOOLS).map(([key, item]) => <button key={key} disabled={busy} className={'nav-item ' + (tool === key ? 'active' : '')} aria-current={tool === key ? 'page' : undefined} onClick={() => chooseTool(key)}><item.icon size={21} strokeWidth={1.7} /><span><strong>{item.label}</strong><small>{item.short}</small></span>{tool === key && <ChevronRight className="nav-arrow" size={17} />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-card"><span className="privacy-icon"><ShieldCheck size={23} /></span><strong>Your files. Your business.</strong><p>Everything happens on your device. Your PDFs never leave this browser.</p><span className="local-caption"><HardDrive size={14} /> 100% local processing</span></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={18} /> A little help <ArrowRight size={16} /></button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={15} /><span>{model.label}</span></div><div className="header-right"><span className="private-badge"><ShieldCheck size={15} /> Private by design</span><a href="https://github.com/abhi4006/folio-pdf-studio" target="_blank" rel="noreferrer" aria-label="View source on GitHub"><Code2 size={21} /></a></div></header>
      <main>
        <div className="heading"><div className="eyebrow"><span></span> SMALL TOOLS. LIGHTER WORK.</div><h1>{model.title}</h1><p>{model.description}</p></div>
        <div className="workspace">
          <div className="workspace-top"><div className="workspace-title"><model.icon size={20} /><h2>{model.label}</h2></div><span className="step-count">STEP {result ? '03' : file ? '02' : '01'} <span>/ 03</span></span></div>
          <ol className="steps" aria-label="Progress"><li className={!file ? 'current' : 'complete'}><span>{file ? <Check size={13} /> : '1'}</span>Choose PDF</li><div></div><li className={file && !result ? 'current' : result ? 'complete' : ''}><span>{result ? <Check size={13} /> : '2'}</span>{tool === 'unlock' ? 'Unlock' : 'Adjust'}</li><div></div><li className={result ? 'current' : ''}><span>3</span>Download</li></ol>
          <input ref={fileInput} id="pdf-upload" data-testid="file-input" type="file" accept="application/pdf,.pdf" onChange={e => loadFile(e.target.files?.[0])} hidden />
          {!file && !busy && <div className={'dropzone ' + (dragging ? 'dragging' : '')} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length !== 1) setError('Choose one PDF at a time.'); else loadFile(e.dataTransfer.files[0]); }}>
            <div className="upload-icon"><FileText size={39} strokeWidth={1.35} /><span><Upload size={15} /></span></div><h3>A fresh start for your PDF</h3><p>Drag your file here, or pick one from your device.</p><button className="primary choose-file" onClick={() => fileInput.current.click()}><Upload size={18} /> Choose PDF <ArrowRight size={17} /></button><span className="file-limit">PDF files up to 50 MB</span>
          </div>}
          {file && !result && <div className="editor">
            <div className="file-card"><div className="file-thumbnail">{info?.thumbnail ? <img src={info.thumbnail} alt="First page preview" /> : <LockKeyhole size={26} />}</div><div className="file-details"><strong title={file.name}>{file.name}</strong><span>{formatSize(file.size)}<i>·</i>{info?.locked ? 'Password protected' : `${info?.pages} ${info?.pages === 1 ? 'page' : 'pages'}`}</span></div><button className="icon-button" disabled={busy} onClick={reset} aria-label="Remove PDF"><X size={18} /></button></div>
            {info?.locked && <div className="password-section"><label htmlFor="pdf-password">Document password <LockKeyhole size={14} /></label><div className="password-field"><input id="pdf-password" autoComplete="off" value={password} disabled={busy} type={showPassword ? 'text' : 'password'} placeholder="Enter the password to open this PDF" onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') run(); }} /><button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p>Your password stays on this device and is cleared after processing.</p></div>}
            {tool === 'unlock' && !info?.locked && <div className="info-note"><ShieldCheck size={20} /><p>This PDF opens without a password. You can still save an unrestricted copy.</p></div>}
            {tool === 'compress' && <fieldset disabled={busy} className="quality-options"><legend>How small should we go?</legend>{[{ value: 'lossless', title: 'Original quality', text: 'Clean up the file. Keep text and images intact.' }, { value: 'balanced', title: 'Balanced', text: 'Optimize images while keeping text selectable.', badge: 'RECOMMENDED' }, { value: 'small', title: 'Smallest file', text: 'Best for scans. Converts every page to an image.' }].map(item => <label className={'quality-option ' + (quality === item.value ? 'selected' : '')} key={item.value}><input type="radio" name="quality" value={item.value} checked={quality === item.value} onChange={() => setQuality(item.value)} /><span><strong>{item.title}{item.badge && <em>{item.badge}</em>}</strong><small>{item.text}</small></span></label>)}{quality === 'small' && <p className="setting-note">Text will no longer be searchable or selectable. Forms, links, and annotations become part of the page image.</p>}</fieldset>}
            {tool === 'resize' && <div className="resize-settings"><div className="setting-row"><label>Paper size<select disabled={busy} value={size} onChange={e => setSize(e.target.value)}><option value="a4">A4 · 210 × 297 mm</option><option value="letter">US Letter · 8.5 × 11 in</option><option value="a3">A3 · 297 × 420 mm</option><option value="a5">A5 · 148 × 210 mm</option><option value="legal">US Legal · 8.5 × 14 in</option><option value="custom">Custom dimensions</option></select></label><label>Orientation<select disabled={busy || size === 'custom'} value={orientation} onChange={e => setOrientation(e.target.value)}><option value="auto">Match each page</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>{size === 'custom' && <div className="setting-row"><label>Width (mm)<input type="number" min="20" max="2000" value={width} onChange={e => setWidth(e.target.value)} disabled={busy} /></label><label>Height (mm)<input type="number" min="20" max="2000" value={height} onChange={e => setHeight(e.target.value)} disabled={busy} /></label></div>}<p className="setting-note">Content is scaled and centered on every page. Text stays sharp. Forms are flattened; annotations and links are removed.</p></div>}
            {!busy && <button className="primary process-button" onClick={run}><model.icon size={18} /> {model.action}<ArrowRight size={18} /></button>}
          </div>}
          {busy && <div className="processing" role="status" aria-live="polite"><div className="processing-label"><LoaderCircle className="spinner" size={19} /><span>{progress.label}</span><strong>{progress.value}%</strong></div><progress value={progress.value} max="100" /><button className="text-button" onClick={reset}>Cancel</button></div>}
          {result && <div className="result" aria-live="polite"><div className="success-icon"><CheckCheck size={30} /></div><span className="eyebrow">ALL SET</span><h3>{tool === 'unlock' ? 'Your PDF is unlocked.' : tool === 'compress' ? 'A lighter load, ready to go.' : 'A perfect fit. Ready to go.'}</h3><p className="result-filename">{result.name}</p><div className="result-stats"><div><small>Original</small><strong>{formatSize(result.original)}</strong></div><ArrowRight size={20} /><div><small>Your new PDF</small><strong>{formatSize(result.blob.size)}</strong></div>{tool === 'compress' && result.blob.size < result.original && <span className="savings">{Math.round((1 - result.blob.size / result.original) * 100)}% smaller</span>}</div>{result.note && <p className="result-note">{result.note}</p>}<a className="primary download-button" href={result.url} download={result.name}><ArrowDownToLine size={19} /> Download PDF</a><div className="result-actions"><button className="text-button" onClick={() => { setResult(null); setError(''); }}>Adjust settings</button><button className="text-button" onClick={reset}><RotateCcw size={14} /> Start a new PDF</button></div></div>}
          {error && <div className="error-message" role="alert"><CircleHelp size={18} /><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
          <div className="workspace-footer"><ShieldCheck size={15} /> No uploads. No sign-ups. Just your PDF.</div>
        </div>
        {!file && <div className="demo-row"><span>Just exploring?</span><button disabled={busy} className="text-button" onClick={async () => { try { await loadFile(await createDemo()); } catch { setError('The sample could not be loaded. Please choose a PDF.'); } }}>Try a sample PDF <ArrowRight size={14} /></button></div>}
        <div className="benefits"><div><ShieldCheck size={20} /><span><strong>Stays with you</strong><p>Files never reach a server.</p></span></div><div><Sparkles size={20} /><span><strong>Simple from the start</strong><p>A few clicks, and you’re done.</p></span></div><div><Leaf size={20} /><span><strong>Light on everything</strong><p>No installs. No extra steps.</p></span></div></div>
        <footer className="page-footer"><span>A little less friction. A little more flow.</span><span>Made for your everyday PDFs <span className="footer-flower">✳</span></span></footer>
      </main>
    </div>
    {help && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setHelp(false); }}><HelpDialog onClose={() => setHelp(false)} /></div>}
  </div>;
}

function HelpDialog({ onClose }) {
  const dialog = useRef(null);
  useEffect(() => { const previous = document.activeElement; dialog.current.focus(); return () => previous?.focus(); }, []);
  return <section className="help-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="help-title" onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { e.preventDefault(); dialog.current.querySelector('button').focus(); } }}><button className="icon-button close-help" onClick={onClose} aria-label="Close help"><X size={21} /></button><CircleHelp size={29} /><h2 id="help-title">A little help goes a long way.</h2><h3>Unlocking a PDF</h3><p>Use the password you already have to save an unencrypted copy. Folio does not recover forgotten passwords. Only process documents you have permission to edit.</p><h3>Making files smaller</h3><p>Compression depends on the file. Original quality preserves content. Balanced optimizes images. Smallest file creates image-only pages; choose it for scans. Already optimized PDFs may not get smaller.</p><h3>Resizing pages</h3><p>Choose a standard or custom paper size. Content is fitted without cropping. Forms are flattened; annotations and links are removed. Any PDF modification can invalidate digital signatures, so keep your original.</p><h3>Everything stays here</h3><p>Your file and password are processed in this browser, without uploads or document storage. Use a recent Chrome, Edge, Firefox, or Safari browser. Large documents may be limited by your device’s memory.</p></section>;
}
