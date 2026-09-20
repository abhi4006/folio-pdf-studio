/* QPDF runs in an isolated worker; its filesystem lives only in memory. */
importScripts('./qpdf.js');
self.onmessage = async ({ data }) => {
  try {
    let stderr = '';
    const module = await self.Module({
      locateFile: name => new URL(name, self.location.href).href,
      noInitialRun: true,
      noFSInit: true,
      preRun: [m => m.FS.init(null, () => {}, byte => { if (stderr.length < 16000) stderr += String.fromCharCode(byte); })],
    });
    module.FS.writeFile('/input.pdf', new Uint8Array(data.bytes));
    const args = ['/input.pdf', `--password=${data.password || ''}`, '--decrypt', '--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9'];
    if (data.quality === 'balanced') args.push('--optimize-images', '--jpeg-quality=70');
    args.push('/output.pdf');
    const exit = module.callMain(args);
    data.password = '';
    if (exit !== 0 && exit !== 3) {
      if (/invalid password|incorrect password/i.test(stderr)) throw new Error('That password did not open the PDF. Check it and try again.');
      if (/unsupported.*encrypt|unsupported.*security/i.test(stderr)) throw new Error('This PDF uses an unsupported security format.');
      throw new Error('This PDF could not be processed. It may be damaged or unsupported.');
    }
    const output = module.FS.readFile('/output.pdf').slice();
    self.postMessage({ output: output.buffer, warning: exit === 3 }, [output.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message?.includes('memory') ? 'Your browser ran out of memory. Try a smaller PDF.' : error.message || 'Unable to process this PDF.' });
  }
};
