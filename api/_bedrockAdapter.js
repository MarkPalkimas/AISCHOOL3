// api/_bedrockAdapter.js — Bedrock Converse adapter using official AWS SDK
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { buildStructuredUserTurn, SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT } from './_openaiAdapter.js'

const DEFAULT_MODEL_ID = 'anthropic.claude-haiku-4-5-20251001-v1:0'
let loggedConfig = false

function readEnv(name) {
  return String(process.env[name] || '').trim()
}

function getCredentialMode(accessKeyId) {
  if (accessKeyId.startsWith('ASIA')) return 'temporary'
  if (accessKeyId.startsWith('AKIA')) return 'long_lived'
  return 'unknown'
}

/**
 * Validates that the model ID follows AWS Bedrock naming conventions
 * @param {string} modelId
 * @returns {boolean}
 */
function isValidModelId(modelId) {
  // Format: provider.model-name-version-v1:0
  // Examples:
  // - anthropic.claude-haiku-4-5-20251001-v1:0
  // - anthropic.claude-3-sonnet-20240229-v1:0
  // - meta.llama3-70b-instruct-v1:0
  // - amazon.titan-text-express-v1
  
  const pattern = /^(anthropic|meta|amazon)\.[a-z0-9-]+(-v\d+)?(:0)?$/i
  return pattern.test(modelId)
}

function logBedrockConfigOnce({ accessKeyId, secretAccessKey, sessionToken, region, modelId }) {
  if (loggedConfig) return
  loggedConfig = true

  const isValid = isValidModelId(modelId)
  
  console.info(JSON.stringify({
    event: 'bedrock_runtime_config',
    provider: String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase(),
    region,
    modelId,
    modelIdValid: isValid,
    hasAccessKeyId: Boolean(accessKeyId),
    accessKeyPrefix: accessKeyId.slice(0, 4),
    credentialMode: getCredentialMode(accessKeyId),
    hasSecretAccessKey: Boolean(secretAccessKey),
    hasSessionToken: Boolean(sessionToken),
  }))

  if (!isValid) {
    console.warn(`Warning: Model ID "${modelId}" does not match expected AWS Bedrock format`)
  }
}

function describeBedrockError(err, { region, modelId }) {
  const name = String(err?.name || '')
  const message = String(err?.message || err || '')
  const status = err?.$metadata?.httpStatusCode
  const requestId = err?.$metadata?.requestId

  console.error(JSON.stringify({
    event: 'bedrock_runtime_error',
    name,
    message,
    status,
    requestId,
    region,
    modelId,
  }))

  // Model access not enabled
  if (name === 'ValidationException' && /operation not allowed/i.test(message)) {
    return [
      'Bedrock model access is not enabled for this AWS account, region, or model.',
      `AWS rejected ${modelId} in ${region} with: Operation not allowed.`,
      'Enable Bedrock model access for this model and confirm the IAM principal can invoke it.',
    ].join(' ')
  }

  // Model not found or invalid
  if (name === 'ValidationException' && /model.*not found/i.test(message)) {
    return [
      `Model ${modelId} is not available in region ${region}.`,
      'Verify the model ID is correct and the model is available in your region.',
    ].join(' ')
  }

  // Authentication errors
  if (name === 'UnrecognizedClientException' || name === 'InvalidSignatureException') {
    return [
      'AWS authentication failed.',
      'Verify AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN (if using temporary credentials) are correct.',
    ].join(' ')
  }

  // Throttling
  if (name === 'ThrottlingException') {
    return `AWS Bedrock request throttled. ${message}`
  }

  return message || 'Unknown Bedrock SDK error'
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
    throw new Error(`Bedrock SDK error: ${describeBedrockError(err, { region, modelId })}`)
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
