import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker for Vite/Production
// Using the "legacy" build ensures better compatibility across browsers/environments
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString()

console.log('PDF Worker Configured:', pdfjsLib.GlobalWorkerOptions.workerSrc)
