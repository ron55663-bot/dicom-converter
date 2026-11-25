/* ISO 9660 Level 1 writer for DICOM CD-R File-sets (DICOM PS3.12 Annex F). */
(function (root) {
  'use strict';
  const SECTOR = 2048;
  const encoder = new TextEncoder();
  const zeroSector = new Uint8Array(SECTOR);
  const isFolder = n => n.kind === 'directory';

  function checkPath(path) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\')) throw new Error('ISO 路徑必須是相對路徑');
    const parts = path.split('/');
    if (parts.some(p => !/^[A-Z0-9_]{1,8}$/.test(p))) throw new Error('ISO 9660 Level 1 檔名需為大寫英數／底線，且每段最多 8 字元：' + path);
    if (parts.length > 8) throw new Error('DICOM File ID 路徑不可超過 8 層');
    return parts;
  }
  function align(n) { return Math.ceil(n / SECTOR) * SECTOR; }
  function writeBoth16(b, p, n) { new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(p, n, true); new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(p + 2, n, false); }
  function writeBoth32(b, p, n) { new DataView(b.buffer, b.byteOffset, b.byteLength).setUint32(p, n, true); new DataView(b.buffer, b.byteOffset, b.byteLength).setUint32(p + 4, n, false); }
  function asciiField(b, p, length, value, fill=0x20) {
    b.fill(fill, p, p + length);
    const bytes = encoder.encode(value);
    b.set(bytes.subarray(0, length), p);
  }
  function date7(now) { return Uint8Array.of(now.getUTCFullYear() - 1900, now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), 0); }
  function isoDate17(now) {
    const s = now.getUTCFullYear().toString().padStart(4,'0') + String(now.getUTCMonth()+1).padStart(2,'0') + String(now.getUTCDate()).padStart(2,'0') + String(now.getUTCHours()).padStart(2,'0') + String(now.getUTCMinutes()).padStart(2,'0') + String(now.getUTCSeconds()).padStart(2,'0') + '00';
    return encoder.encode(s + '\0');
  }
  function fileIsoId(name) { return name + '.;1'; }

  function directoryRecord({name, directory, extent, size, now}) {
    const id = name === '.' ? Uint8Array.of(0) : name === '..' ? Uint8Array.of(1) : encoder.encode(directory ? name : fileIsoId(name));
    const pad = id.length % 2 === 0 ? 1 : 0;
    const length = 33 + id.length + pad;
    if (length > 255) throw new Error('ISO 9660 directory record 過長');
    const b = new Uint8Array(length);
    b[0] = length; b[1] = 0;
    writeBoth32(b, 2, extent); writeBoth32(b, 10, size);
    b.set(date7(now), 18); b[25] = directory ? 2 : 0; b[26] = 0; b[27] = 0;
    writeBoth16(b, 28, 1); b[32] = id.length; b.set(id, 33);
    return b;
  }

  function pathTable(directories, bigEndian) {
    const parts = [];
    for (const dir of directories) {
      const id = dir.parent === null ? Uint8Array.of(0) : encoder.encode(dir.name);
      const pad = id.length % 2 === 1 ? 1 : 0;
      const e = new Uint8Array(8 + id.length + pad);
      e[0] = id.length; e[1] = 0;
      const dv = new DataView(e.buffer);
      dv.setUint32(2, dir.extent, !bigEndian);
      dv.setUint16(6, dir.parent === null ? 1 : dir.parent.pathIndex, !bigEndian);
      e.set(id, 8); parts.push(e);
    }
    const size = parts.reduce((s,p)=>s+p.length,0), out = new Uint8Array(size);
    let at=0; for(const p of parts){out.set(p,at);at+=p.length;}
    return out;
  }

  function packDirectory(entries, extent, now) {
    const records = [
      directoryRecord({name:'.',directory:true,extent,size:entries.byteLength,now}),
      directoryRecord({name:'..',directory:true,extent,size:entries.parentBytes,now})
    ];
    for (const child of entries.children) records.push(directoryRecord({
      name:child.name,directory:isFolder(child),extent:child.extent,size:child.size,now
    }));
    let at=0;
    for (const rec of records) { if ((at % SECTOR) + rec.length > SECTOR) at = align(at); at += rec.length; }
    const out = new Uint8Array(align(at));
    at=0;
    for (const rec of records) { if ((at % SECTOR) + rec.length > SECTOR) at=align(at); out.set(rec,at); at+=rec.length; }
    return out;
  }

  function createIso9660(files, options={}) {
    if (!Array.isArray(files) || !files.length) throw new Error('ISO 沒有檔案');
    const rootDir = {name:'', parent:null, children:[], extent:0, size:0, pathIndex:1};
    const dirs=[rootDir], fileMap=new Map();
    for (const f of files) {
      const parts=checkPath(f.path), key=parts.join('/').toUpperCase();
      if (fileMap.has(key)) throw new Error('ISO 內有重複檔案：'+f.path);
      const bytes=f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
      let dir=rootDir;
      for (const part of parts.slice(0,-1)) {
        let child=dir.children.find(c=>c.kind==='directory'&&c.name===part);
        if (!child) {
          child={kind:'directory',name:part,parent:dir,children:[],extent:0,size:0,pathIndex:0};
          dir.children.push(child);dirs.push(child);
        }
        dir=child;
      }
      if (dir.children.some(c=>c.name===parts[parts.length-1])) throw new Error('ISO 檔案與目錄名稱衝突：'+f.path);
      const entry={kind:'file',name:parts[parts.length-1],path:key,bytes,size:bytes.length,extent:0};
      dir.children.push(entry);fileMap.set(key,entry);
    }
    if (!fileMap.has('DICOMDIR')) throw new Error('DICOMDIR 必須位於 ISO 根目錄');
    const dicomFiles=[...fileMap.keys()].filter(p=>p!=='DICOMDIR');
    if (!dicomFiles.length) throw new Error('DICOM CD 至少需要一個 DICOM instance');
    for (const dir of dirs) dir.children.sort((a,b)=>a.name.localeCompare(b.name,'en'));
    const dcmDir=rootDir.children.find(c=>c.kind==='directory'&&c.name==='DICOM');
    if (!dcmDir) throw new Error('DICOMDIR references must be stored under the DICOM directory');
    for (const key of dicomFiles) if (!key.startsWith('DICOM/')) throw new Error('DICOM instance 不在 DICOM/ 目錄：'+key);
    const imageNames=dcmDir.children.filter(c=>c.kind==='file').map(c=>c.name);
    if (imageNames.length!==dicomFiles.length) throw new Error('ISO 內的 DICOM instance 與 DICOM/ 檔案數不一致');

    let pathIndex=1;
    for (const dir of dirs.slice(1)) dir.pathIndex=++pathIndex;
    const now=options.date instanceof Date?options.date:new Date();
    const volumeId=(options.volumeId||'DICOM_CD').toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,32)||'DICOM_CD';
    let lTable=pathTable(dirs,false), mTable=pathTable(dirs,true);
    const lStart=18, lSectors=Math.ceil(lTable.length/SECTOR);
    const mStart=lStart+lSectors, mSectors=Math.ceil(mTable.length/SECTOR);
    let nextSector=mStart+mSectors;
    for(const dir of dirs){
      dir.extent=nextSector;
      const dummy=packDirectory({children:dir.children,parentBytes:0,byteLength:0},0,now);
      dir.size=dummy.length; nextSector+=dir.size/SECTOR;
    }
    const dataStartSector=nextSector;
    for(const file of fileMap.values()){
      file.extent=nextSector;
      nextSector+=Math.ceil(file.size/SECTOR);
    }
    if(nextSector>0xFFFFFFFF) throw new Error('ISO 超過 ISO 9660 4 GiB 區塊位址上限');
    lTable=pathTable(dirs,false);mTable=pathTable(dirs,true);
    const directoryBytes=new Map();
    for(const dir of dirs){
      const b=packDirectory({children:dir.children,parentBytes:dir.parent?dir.parent.size:dir.size,byteLength:dir.size},dir.extent,now);
      if(b.length!==dir.size)throw new Error('ISO directory size 計算不一致');
      directoryBytes.set(dir,b);
    }

    const metadata=new Uint8Array(dataStartSector*SECTOR);
    // System area sectors 0..15 are zero-filled. PVD and descriptor terminator are sectors 16 and 17.
    const pvd=metadata.subarray(16*SECTOR,17*SECTOR);
    pvd[0]=1;pvd.set(encoder.encode('CD001'),1);pvd[6]=1;
    asciiField(pvd,8,32,'');asciiField(pvd,40,32,volumeId);
    writeBoth32(pvd,80,nextSector);writeBoth16(pvd,120,1);writeBoth16(pvd,124,1);writeBoth16(pvd,128,SECTOR);writeBoth32(pvd,132,lTable.length);
    const pvdView=new DataView(pvd.buffer,pvd.byteOffset,pvd.byteLength);
    pvdView.setUint32(140,lStart,true);
    pvdView.setUint32(144,0,true);
    pvdView.setUint32(148,mStart,false);
    pvdView.setUint32(152,0,false);
    pvd.set(directoryRecord({name:'.',directory:true,extent:rootDir.extent,size:rootDir.size,now}),156);
    asciiField(pvd,190,128,'');asciiField(pvd,318,128,'');asciiField(pvd,446,128,'');
    asciiField(pvd,574,128,'DICOM CONVERTER DESKTOP');
    asciiField(pvd,702,37,'');asciiField(pvd,739,37,'');asciiField(pvd,776,37,'');
    const dt=isoDate17(now);pvd.set(dt,813);pvd.set(dt,830);pvd.fill(0,847,881);pvd[881]=1;
    const term=metadata.subarray(17*SECTOR,18*SECTOR);
    term[0]=255;term.set(encoder.encode('CD001'),1);term[6]=1;
    metadata.set(lTable,lStart*SECTOR);metadata.set(mTable,mStart*SECTOR);
    for(const dir of dirs)metadata.set(directoryBytes.get(dir),dir.extent*SECTOR);

    const parts=[metadata];
    let currentSector=dataStartSector;
    for(const file of fileMap.values()){
      if(file.extent!==currentSector)throw new Error('ISO file extent 序列不一致');
      if(file.size){
        parts.push(file.bytes);
        const pad=(SECTOR-(file.size%SECTOR))%SECTOR;
        if(pad)parts.push(zeroSector.subarray(0,pad));
      }
      currentSector+=Math.ceil(file.size/SECTOR);
    }
    const iso=new Blob(parts,{type:'application/x-iso9660-image'});
    return {blob:iso, size:iso.size, instanceCount:dicomFiles.length,
      fileCount:fileMap.size,totalFileBytes:[...fileMap.values()].reduce((n,f)=>n+f.size,0),volumeId};
  }
  root.DicomIso9660={createIso9660,sectorSize:SECTOR};
})(globalThis);
