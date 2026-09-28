/** Opens the browser's print dialog with `title` as the document title, which
 *  browsers use as the suggested file name for "Save as PDF". The original
 *  title comes back once printing ends. */
export function printDocument(title: string) {
  const original = document.title;
  document.title = title;
  const restore = () => {
    document.title = original;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

/** A file-name-safe version of `name` (keeps spaces, accents and "&"). */
export function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim();
}
