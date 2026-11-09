/** Trigger a browser download for a Blob. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const csvBlob = (csv: string) => new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
