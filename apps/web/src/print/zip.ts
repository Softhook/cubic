/** ZIP archives, for exporting a whole set of print files at once. */

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A ZIP archive of the given files, stored uncompressed (PNGs are compressed already). */
export async function zip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const f of files) {
    // Read only for the checksum: the archive refers to the file's own blob, so a large set isn't held in memory twice.
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const header = (size: number, sig: number) => {
      const b = new DataView(new ArrayBuffer(size));
      b.setUint32(0, sig, true);
      return b;
    };
    // Local file header: version 2.0, no flags, stored, a fixed date (1 Jan 2026).
    const local = header(30, 0x04034b50);
    local.setUint16(4, 20, true);
    local.setUint16(12, ((2026 - 1980) << 9) | (1 << 5) | 1, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    const dir = header(46, 0x02014b50);
    dir.setUint16(4, 20, true);
    new Uint8Array(dir.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26));
    dir.setUint32(42, offset, true);
    parts.push(local.buffer, name, f.blob);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
