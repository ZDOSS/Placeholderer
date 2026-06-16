// Hand-rolled ZIP central-directory parser. Reads the End of
// Central Directory record, then walks the entries to find a single
// named file. Returns the file's contents as a string, or null if
// the file isn't present, the archive is malformed, or the entry
// is compressed (we only support STORE here because that's the
// only mode @placeholderer/core's generateJob produces).
//
// Used by the web app to read _placeholderer/manifest-report.json
// out of the ZIP after generation, without bundling JSZip on the
// web side.

export interface ZipReadResult {
  name: string;
  bytes: Uint8Array;
}

export function readZipEntry(zipBytes: Uint8Array, targetName: string): ZipReadResult | null {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  if (zipBytes.length < 22) return null;
  const eocdSig = view.getUint32(zipBytes.length - 22, true);
  if (eocdSig !== 0x06054b50) return null;
  const totalEntries = view.getUint16(zipBytes.length - 12, true);
  const cdOffset = view.getUint32(zipBytes.length - 6, true);

  let entryOffset = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (entryOffset + 46 > zipBytes.length) return null;
    const sig = view.getUint32(entryOffset, true);
    if (sig !== 0x02014b50) return null;
    const nameLen = view.getUint16(entryOffset + 28, true);
    const extraLen = view.getUint16(entryOffset + 30, true);
    const commentLen = view.getUint16(entryOffset + 32, true);
    const localHeaderOffset = view.getUint32(entryOffset + 42, true);
    const nameStart = entryOffset + 46;
    if (nameStart + nameLen > zipBytes.length) return null;
    const name = new TextDecoder().decode(zipBytes.subarray(nameStart, nameStart + nameLen));
    if (name === targetName) {
      if (localHeaderOffset + 30 > zipBytes.length) return null;
      const compMethod = view.getUint16(localHeaderOffset + 8, true);
      if (compMethod !== 0) return null;
      const compSize = view.getUint32(localHeaderOffset + 18, true);
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      if (dataStart + compSize > zipBytes.length) return null;
      return { name, bytes: zipBytes.subarray(dataStart, dataStart + compSize) };
    }
    entryOffset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
