import { saveFile } from './host';

/** Hand the user a Blob as a file. The page does the saving (`lib/host`). */
export const download = (blob: Blob, name: string): void => saveFile(blob, name);

export const csvBlob = (csv: string) => new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
