const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

vm.runInThisContext(fs.readFileSync(require.resolve('../iso9660.js'), 'utf8'));

function dual32(view, offset) { return view.getUint32(offset, true); }
function findRecords(bytes, offset, length) {
  const rows = []; let at = offset; const end = offset + length;
  while (at < end) {
    const size = bytes[at];
    if (!size) { at = Math.ceil((at + 1) / 2048) * 2048; continue; }
    const idLength = bytes[at + 32], id = Buffer.from(bytes.subarray(at + 33, at + 33 + idLength)).toString('ascii');
    rows.push({ id, at, extent: dual32(new DataView(bytes.buffer, bytes.byteOffset + at, size), 2), size: dual32(new DataView(bytes.buffer, bytes.byteOffset + at, size), 10), directory: !!(bytes[at + 25] & 2) });
    at += size;
  }
  return rows;
}

(async () => {
  const dicomdir = Buffer.from('synthetic DICOMDIR fixture;REFERENCED_FILE_ID=DICOM\\IM000001;REFERENCED_FILE_ID=DICOM\\IM000002');
  const payloads = new Map([
    ['DICOMDIR', dicomdir],
    ['DICOM/IM000001', Buffer.from([0, 1, 2, 255, 128, 10])],
    ['DICOM/IM000002', Buffer.alloc(4097, 0x5a)]
  ]);
  const result = globalThis.DicomIso9660.createIso9660([...payloads].map(([path, bytes]) => ({ path, bytes: new Uint8Array(bytes) })), { date: new Date('2025-01-02T03:04:05Z') });
  const iso = Buffer.from(await result.blob.arrayBuffer());
  assert.equal(iso.length % 2048, 0);
  assert.equal(iso.subarray(16 * 2048 + 1, 16 * 2048 + 6).toString(), 'CD001');
  const pvd = new DataView(iso.buffer, iso.byteOffset + 16 * 2048, 2048);
  assert.equal(pvd.getUint16(128, true), 2048);
  assert.equal(pvd.getUint32(80, true) * 2048, iso.length);
  const rootExtent = pvd.getUint32(158, true), rootSize = pvd.getUint32(166, true);
  const root = findRecords(iso, rootExtent * 2048, rootSize);
  const rootDicomdir = root.find(r => r.id === 'DICOMDIR.;1');
  const dcmDir = root.find(r => r.id === 'DICOM' && r.directory);
  assert.ok(rootDicomdir, 'DICOMDIR is at volume root with Level 1 file ID');
  assert.ok(dcmDir, 'DICOM directory exists');
  assert.match(rootDicomdir.id, /^[A-Z0-9_]{1,8}\.\;1$/);
  const references = [...dicomdir.toString('ascii').matchAll(/REFERENCED_FILE_ID=(DICOM\\IM[0-9]{6})/g)].map(m => m[1].replace('\\', '/'));
  assert.equal(references.length, 2);
  for (const reference of references) assert.ok(payloads.has(reference), `DICOMDIR file ID resolves: ${reference}`);
  for (const [path, expected] of payloads) {
    const record = path === 'DICOMDIR'
      ? rootDicomdir
      : findRecords(iso, dcmDir.extent * 2048, dcmDir.size).find(r => r.id === path.split('/')[1] + '.;1');
    assert.ok(record, `ISO path exists: ${path}`);
    if (path.startsWith('DICOM/')) assert.match(record.id, /^[A-Z0-9_]{1,8}\.\;1$/);
    assert.deepEqual(iso.subarray(record.extent * 2048, record.extent * 2048 + expected.length), expected, `payload preserved: ${path}`);
  }
  assert.equal(result.instanceCount, 2);
  assert.equal(result.fileCount, 3);
  fs.mkdirSync('work', { recursive: true });
  fs.writeFileSync('work/dicom-iso-fixture.iso', iso);
  console.log(`ISO9660 fixture passed: ${result.instanceCount} instances, ${iso.length} bytes`);
})().catch(e => { console.error(e); process.exitCode = 1; });
