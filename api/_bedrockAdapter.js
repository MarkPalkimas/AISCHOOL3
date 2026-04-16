// api/_bedrockAdapter.js — Bedrock Converse adapter using official AWS SDK
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { buildStructuredUserTurn, SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT } from './_openaiAdapter.js'

const DEFAULT_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0'
let loggedConfig = false

function readEnv(name) {
  return String(process.env[name] || '').trim()
}

function getCredentialMode(accessKeyId) {
  if (accessKeyId.startsWith('ASIA')) return 'temporary'
  if (accessKeyId.startsWith('AKIA')) return 'long_lived'
  return 'unknown'
}

function logBedrockConfigOnce({ accessKeyId, secretAccessKey, sessionToken, region, modelId }) {
  if (loggedConfig) return
  loggedConfig = true

  console.info(JSON.stringify({
    event: 'bedrock_runtime_config',
    provider: String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase(),
    region,
    modelId,
    hasAccessKeyId: Boolean(accessKeyId),
    accessKeyPrefix: accessKeyId.slice(0, 4),
    credentialMode: getCredentialMode(accessKeyId),
    hasSecretAccessKey: Boolean(secretAccessKey),
    hasSessionToken: Boolean(sessionToken),
  }))
}

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
  // Read and trim credentials to guard against accidental whitespace/newlines pasted into Vercel
  const accessKeyId     = readEnv('AWS_ACCESS_KEY_ID')
  const secretAccessKey = readEnv('AWS_SECRET_ACCESS_KEY')
  const sessionToken    = readEnv('AWS_SESSION_TOKEN') || undefined
  const region          = readEnv('AWS_REGION')
  const modelId         = readEnv('BEDROCK_MODEL_ID') || DEFAULT_MODEL_ID

  logBedrockConfigOnce({ accessKeyId, secretAccessKey, sessionToken, region, modelId })

  // Validation
  if (!accessKeyId)     throw new Error('Bedrock config error: missing AWS_ACCESS_KEY_ID')
  if (!secretAccessKey) throw new Error('Bedrock config error: missing AWS_SECRET_ACCESS_KEY')
  if (!region)          throw new Error('Bedrock config error: missing AWS_REGION')
  if (accessKeyId.startsWith('ASIA') && !sessionToken) {
    throw new Error('Bedrock config error: AWS_SESSION_TOKEN is required for temporary AWS credentials')
  }
  if (accessKeyId.startsWith('AKIA') && accessKeyId.length !== 20) {
    throw new Error('Bedrock config error: AWS_ACCESS_KEY_ID has an unexpected length after trimming')
  }
  if (secretAccessKey.length !== 40) {
    throw new Error('Bedrock config error: AWS_SECRET_ACCESS_KEY has an unexpected length after trimming')
  }

  // Build the Bedrock Converse messages array
  const resolvedSystemPrompt = String(systemPrompt || DEFAULT_SYSTEM_PROMPT || '').trim()

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

  const commandInput = {
    modelId,
    messages,
    inferenceConfig: { maxTokens: 1200, temperature: 0.7 },
    ...(resolvedSystemPrompt ? { system: [{ text: resolvedSystemPrompt }] } : {}),
  }

  // Use the official SDK — it handles SigV4 signing correctly
  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
  })

  let response
  try {
    response = await client.send(new ConverseCommand(commandInput))
  } catch (err) {
    // Surface the AWS error message clearly in Vercel logs
    throw new Error(`Bedrock SDK error: ${err?.message || String(err)}`)
  }

  const content = Array.isArray(response?.output?.message?.content)
    ? response.output.message.content
    : []

  const text = content
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()

  if (!text) {
    throw new Error(`Bedrock response parsing failed: ${JSON.stringify(response)}`)
  }

  return text
}
