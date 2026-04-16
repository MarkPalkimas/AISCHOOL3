// api/_bedrockAdapter.js — Bedrock Converse adapter with SigV4 (Web Crypto API)
import { buildStructuredUserTurn, SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT } from './_openaiAdapter.js'

const DEFAULT_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0'

// ─── SigV4 helpers (Web Crypto API — no aws-sdk, no Node crypto) ──────────────

async function sha256Hex(message) {
  const msgBuffer = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256Raw(key, data) {
  const keyMaterial = key instanceof Uint8Array ? key : new TextEncoder().encode(key)
  const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer)
  return new Uint8Array(sig)
}

async function hmacSha256Hex(key, data) {
  const raw = await hmacSha256Raw(key, data)
  return Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function deriveSigningKey(secretKey, dateStamp, region, service) {
  const kDate    = await hmacSha256Raw('AWS4' + secretKey, dateStamp)
  const kRegion  = await hmacSha256Raw(kDate, region)
  const kService = await hmacSha256Raw(kRegion, service)
  const kSigning = await hmacSha256Raw(kService, 'aws4_request')
  return kSigning
}

function encodeCanonicalUri(pathname) {
  return pathname
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

async function signRequest({ method, url, body, accessKeyId, secretAccessKey, sessionToken, region, service, amzDate, dateStamp }) {
  const parsedUrl = new URL(url)
  const canonicalUri = encodeCanonicalUri(parsedUrl.pathname)
  const canonicalQueryString = ''

  const payloadHash = await sha256Hex(body)

  const canonicalHeaderEntries = [
    ['content-type', 'application/json'],
    ['host', parsedUrl.host],
    ['x-amz-date', amzDate],
  ]

  if (sessionToken) {
    canonicalHeaderEntries.push(['x-amz-security-token', sessionToken])
  }

  const canonicalHeaders = canonicalHeaderEntries
    .map(([name, value]) => `${name}:${value}\n`)
    .join('')

  const signedHeaders = canonicalHeaderEntries
    .map(([name]) => name)
    .join(';')

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region, service)
  const signature = await hmacSha256Hex(signingKey, stringToSign)

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return { authorizationHeader, payloadHash }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Calls the AWS Bedrock Converse API and returns the assistant reply as a string.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {string} params.context          - retrieved material context
 * @param {Array<{role:string, content:string}>} params.history  - up to 20 messages
 * @param {string} params.userMessage
 * @returns {Promise<string>}
 */
export async function complete({ systemPrompt, context, history = [], userMessage }) {
  // Credential validation
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const sessionToken    = process.env.AWS_SESSION_TOKEN
  const region          = process.env.AWS_REGION

  if (!accessKeyId)     throw new Error('Bedrock config error: missing AWS_ACCESS_KEY_ID')
  if (!secretAccessKey) throw new Error('Bedrock config error: missing AWS_SECRET_ACCESS_KEY')
  if (!region)          throw new Error('Bedrock config error: missing AWS_REGION')

  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID
  const resolvedSystemPrompt = String(systemPrompt || DEFAULT_SYSTEM_PROMPT || '').trim()

  // Build Converse request body
  const messages = [
    ...history.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })),
    {
      role: 'user',
      content: [{ text: buildStructuredUserTurn(context, userMessage) }],
    },
  ]

  const requestBody = JSON.stringify({
    ...(resolvedSystemPrompt ? { system: [{ text: resolvedSystemPrompt }] } : {}),
    messages,
    inferenceConfig: { maxTokens: 1200, temperature: 0.7 },
  })

  // SigV4 signing
  const now = new Date()
  // Format: 20260331T204136Z
  const pad = n => String(n).padStart(2, '0')
  const amzDate = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  const dateStamp = amzDate.slice(0, 8)

  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`

  const { authorizationHeader } = await signRequest({
    method: 'POST',
    url,
    body: requestBody,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    service: 'bedrock',
    amzDate,
    dateStamp,
  })

  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    'Authorization': authorizationHeader,
  }

  if (sessionToken) {
    requestHeaders['X-Amz-Security-Token'] = sessionToken
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: requestBody,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Bedrock ${response.status}: ${body}`)
  }

  const data = await response.json()
  const content = Array.isArray(data?.output?.message?.content)
    ? data.output.message.content
    : []

  const text = content
    .map((part) => typeof part?.text === 'string' ? part.text : '')
    .join('\n')
    .trim()

  if (!text) {
    throw new Error(`Bedrock response parsing failed: ${JSON.stringify(data)}`)
  }

  return text
}
