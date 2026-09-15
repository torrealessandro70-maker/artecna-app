// Same PDF.js API; the minified build avoids the dev eval export-name collision.
declare module 'pdfjs-dist/build/pdf.min.mjs' {
  export * from 'pdfjs-dist'
}
