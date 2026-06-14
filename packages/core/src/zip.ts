import JSZip from 'jszip';

export async function createZip(files: Array<{ path: string; data: Blob }>): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.data);
  }

  return zip.generateAsync({ type: 'blob' });
}