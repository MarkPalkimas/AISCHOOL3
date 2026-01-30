//src/pdfWorkerSetup.js
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

//Configure PDF.js worker for Vite/Production using the SAME legacy build used for parsing
GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString()

console.log('PDF Worker Configured:', GlobalWorkerOptions.workerSrc)
