import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

function cleanText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function capText(s, maxChars) {
  const t = cleanText(s)
  if (t.length <= maxChars) return t
  return t.slice(0, maxChars) + '\n\n…(trimmed)'
}

async function extractPdfText(file, pageLimit = 30) {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise

  const pages = Math.min(pdf.numPages, pageLimit)
  const chunks = []

  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const strings = content.items.map(it => it.str).filter(Boolean)
    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim()
    if (pageText) chunks.push(pageText)
  }

  return cleanText(chunks.join('\n\n'))
}

async function extractDocxText(file) {
  const ab = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: ab })
  return cleanText(result.value || '')
}

export async function extractTextFromFile(file) {
  const name = (file?.name || '').toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return await extractPdfText(file)
  }

  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractDocxText(file)
  }

  if (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.json')
  ) {
    return cleanText(await file.text())
  }

  throw new Error('Unsupported file type')
}

export function normalizeForMaterialsAppend(fileName, rawText, maxChars) {
  const safeName = (fileName || 'upload').replace(/\s+/g, ' ').trim()
  const capped = capText(rawText, maxChars)
  return `--- FILE: ${safeName} ---\n${capped}`
}
