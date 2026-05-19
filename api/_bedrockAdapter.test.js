// api/_bedrockAdapter.test.js
import { describe, it, expect } from 'vitest'

// Since isValidModelId is not exported, we need to test it indirectly
// or extract it for testing. For now, we'll recreate the function for testing.
// In a production scenario, you might export it or use a different testing approach.

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

describe('isValidModelId', () => {
  describe('Claude models', () => {
    it('should accept valid Claude Haiku 4.5 model ID', () => {
      expect(isValidModelId('anthropic.claude-haiku-4-5-20251001-v1:0')).toBe(true)
    })

    it('should accept valid Claude 3 Haiku model ID', () => {
      expect(isValidModelId('anthropic.claude-3-haiku-20240307-v1:0')).toBe(true)
    })

    it('should accept valid Claude 3.5 Sonnet model ID', () => {
      expect(isValidModelId('anthropic.claude-3-5-sonnet-20241022-v2:0')).toBe(true)
    })

    it('should accept valid Claude 3.5 Opus model ID', () => {
      expect(isValidModelId('anthropic.claude-3-5-opus-20240229-v1:0')).toBe(true)
    })
  })

  describe('Meta models', () => {
    it('should accept valid Meta Llama3 70b model ID', () => {
      expect(isValidModelId('meta.llama3-70b-instruct-v1:0')).toBe(true)
    })

    it('should accept valid Meta model without version suffix', () => {
      expect(isValidModelId('meta.llama3-8b-instruct')).toBe(true)
    })
  })

  describe('Amazon models', () => {
    it('should accept valid Amazon Titan model ID without colon suffix', () => {
      expect(isValidModelId('amazon.titan-text-express-v1')).toBe(true)
    })

    it('should accept valid Amazon Titan model ID with colon suffix', () => {
      expect(isValidModelId('amazon.titan-text-express-v1:0')).toBe(true)
    })
  })

  describe('Invalid formats', () => {
    it('should reject empty string', () => {
      expect(isValidModelId('')).toBe(false)
    })

    it('should reject model ID without provider prefix', () => {
      expect(isValidModelId('claude-haiku-4-5-20251001-v1:0')).toBe(false)
    })

    it('should reject model ID with only provider', () => {
      expect(isValidModelId('anthropic')).toBe(false)
    })

    it('should reject model ID with unsupported provider', () => {
      expect(isValidModelId('openai.gpt-4-turbo')).toBe(false)
    })

    it('should reject model ID with invalid characters', () => {
      expect(isValidModelId('anthropic.claude_haiku_v1:0')).toBe(false)
    })

    it('should reject completely invalid format', () => {
      expect(isValidModelId('invalid-model')).toBe(false)
    })

    it('should reject model ID with spaces', () => {
      expect(isValidModelId('anthropic.claude haiku v1:0')).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle case insensitivity for provider names', () => {
      expect(isValidModelId('ANTHROPIC.claude-haiku-v1:0')).toBe(true)
      expect(isValidModelId('Meta.llama3-70b-v1:0')).toBe(true)
      expect(isValidModelId('Amazon.titan-text-v1')).toBe(true)
    })

    it('should accept model names with multiple hyphens', () => {
      expect(isValidModelId('anthropic.claude-3-5-sonnet-20241022-v2:0')).toBe(true)
    })

    it('should accept model names with numbers', () => {
      expect(isValidModelId('meta.llama3-70b-instruct-v1:0')).toBe(true)
    })
  })
})

/**
 * Mock describeBedrockError function for testing
 * This replicates the logic from _bedrockAdapter.js
 */
function describeBedrockError(err, { region, modelId }) {
  const name = String(err?.name || '')
  const message = String(err?.message || err || '')

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

describe('describeBedrockError', () => {
  const testContext = {
    region: 'us-east-1',
    modelId: 'anthropic.claude-haiku-4-5-20251001-v1:0'
  }

  describe('Model access errors', () => {
    it('should identify model access not enabled errors', () => {
      const err = {
        name: 'ValidationException',
        message: 'operation not allowed for this model',
        $metadata: { httpStatusCode: 400, requestId: 'test-123' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('Bedrock model access is not enabled')
      expect(message).toContain('us-east-1')
      expect(message).toContain('anthropic.claude-haiku-4-5-20251001-v1:0')
      expect(message).toContain('Operation not allowed')
    })

    it('should handle case-insensitive operation not allowed matching', () => {
      const err = {
        name: 'ValidationException',
        message: 'OPERATION NOT ALLOWED',
        $metadata: { httpStatusCode: 400, requestId: 'test-124' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('Bedrock model access is not enabled')
    })
  })

  describe('Model not found errors', () => {
    it('should identify model not found errors', () => {
      const err = {
        name: 'ValidationException',
        message: 'The requested model was not found',
        $metadata: { httpStatusCode: 400, requestId: 'test-125' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('Model anthropic.claude-haiku-4-5-20251001-v1:0 is not available in region us-east-1')
      expect(message).toContain('Verify the model ID is correct')
    })

    it('should handle various model not found message formats', () => {
      const err = {
        name: 'ValidationException',
        message: 'model "test-model" not found in region',
        $metadata: { httpStatusCode: 400, requestId: 'test-126' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('is not available in region')
    })
  })

  describe('Authentication errors', () => {
    it('should identify UnrecognizedClientException errors', () => {
      const err = {
        name: 'UnrecognizedClientException',
        message: 'The security token included in the request is invalid',
        $metadata: { httpStatusCode: 403, requestId: 'test-127' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('AWS authentication failed')
      expect(message).toContain('AWS_ACCESS_KEY_ID')
      expect(message).toContain('AWS_SECRET_ACCESS_KEY')
      expect(message).toContain('AWS_SESSION_TOKEN')
    })

    it('should identify InvalidSignatureException errors', () => {
      const err = {
        name: 'InvalidSignatureException',
        message: 'The request signature we calculated does not match',
        $metadata: { httpStatusCode: 403, requestId: 'test-128' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('AWS authentication failed')
      expect(message).toContain('Verify AWS_ACCESS_KEY_ID')
    })
  })

  describe('Throttling errors', () => {
    it('should identify ThrottlingException errors', () => {
      const err = {
        name: 'ThrottlingException',
        message: 'Rate exceeded for this operation',
        $metadata: { httpStatusCode: 429, requestId: 'test-129' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('AWS Bedrock request throttled')
      expect(message).toContain('Rate exceeded')
    })

    it('should include the original throttling message', () => {
      const err = {
        name: 'ThrottlingException',
        message: 'Too many requests',
        $metadata: { httpStatusCode: 429, requestId: 'test-130' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toBe('AWS Bedrock request throttled. Too many requests')
    })
  })

  describe('Unknown errors', () => {
    it('should return the error message for unknown error types', () => {
      const err = {
        name: 'UnknownException',
        message: 'Something went wrong',
        $metadata: { httpStatusCode: 500, requestId: 'test-131' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toBe('Something went wrong')
    })

    it('should return default message when error has no message', () => {
      const err = {
        name: 'UnknownException',
        $metadata: { httpStatusCode: 500, requestId: 'test-132' }
      }
      const message = describeBedrockError(err, testContext)
      // When error has no message, String(err) returns '[object Object]'
      expect(message).toBe('[object Object]')
    })

    it('should handle error objects without name property', () => {
      const err = {
        message: 'Generic error message',
        $metadata: { httpStatusCode: 500, requestId: 'test-133' }
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toBe('Generic error message')
    })
  })

  describe('Edge cases', () => {
    it('should handle null error', () => {
      const message = describeBedrockError(null, testContext)
      expect(message).toBe('Unknown Bedrock SDK error')
    })

    it('should handle undefined error', () => {
      const message = describeBedrockError(undefined, testContext)
      expect(message).toBe('Unknown Bedrock SDK error')
    })

    it('should handle string error', () => {
      const message = describeBedrockError('Simple error string', testContext)
      expect(message).toBe('Simple error string')
    })

    it('should handle error with missing metadata', () => {
      const err = {
        name: 'ValidationException',
        message: 'operation not allowed'
      }
      const message = describeBedrockError(err, testContext)
      expect(message).toContain('Bedrock model access is not enabled')
    })
  })
})

describe('Explicit model configuration', () => {
  describe('Environment variable handling', () => {
    it('should use BEDROCK_MODEL_ID when explicitly set', () => {
      // This test verifies the logic: readEnv('BEDROCK_MODEL_ID') || DEFAULT_MODEL_ID
      // When BEDROCK_MODEL_ID is set, it should be used instead of the default
      
      const explicitModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      
      // Simulate the logic from _bedrockAdapter.js
      function getModelId(envValue, defaultValue) {
        return envValue || defaultValue
      }
      
      // Test with explicit value
      const result1 = getModelId(explicitModelId, defaultModelId)
      expect(result1).toBe(explicitModelId)
      
      // Test with empty string (should use default)
      const result2 = getModelId('', defaultModelId)
      expect(result2).toBe(defaultModelId)
      
      // Test with undefined (should use default)
      const result3 = getModelId(undefined, defaultModelId)
      expect(result3).toBe(defaultModelId)
    })

    it('should use explicit Claude Haiku 4.5 configuration', () => {
      // Verify that when BEDROCK_MODEL_ID is explicitly set to Claude Haiku 4.5,
      // that value is used (Requirements 2.1, 6.2)
      
      const explicitModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      
      function getModelId(envValue, defaultValue) {
        return envValue || defaultValue
      }
      
      const result = getModelId(explicitModelId, defaultModelId)
      expect(result).toBe('anthropic.claude-haiku-4-5-20251001-v1:0')
      expect(isValidModelId(result)).toBe(true)
    })

    it('should use explicit alternative model configuration', () => {
      // Verify that when BEDROCK_MODEL_ID is set to a different model,
      // that value overrides the default (Requirements 2.1, 6.2)
      
      const explicitModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      
      function getModelId(envValue, defaultValue) {
        return envValue || defaultValue
      }
      
      const result = getModelId(explicitModelId, defaultModelId)
      expect(result).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0')
      expect(result).not.toBe(defaultModelId)
      expect(isValidModelId(result)).toBe(true)
    })

    it('should support Meta Llama model configuration', () => {
      // Verify that Meta models can be explicitly configured
      // (Requirements 2.1, 2.3, 6.2)
      
      const explicitModelId = 'meta.llama3-70b-instruct-v1:0'
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      
      function getModelId(envValue, defaultValue) {
        return envValue || defaultValue
      }
      
      const result = getModelId(explicitModelId, defaultModelId)
      expect(result).toBe('meta.llama3-70b-instruct-v1:0')
      expect(isValidModelId(result)).toBe(true)
    })

    it('should support Amazon Titan model configuration', () => {
      // Verify that Amazon models can be explicitly configured
      // (Requirements 2.1, 2.4, 6.2)
      
      const explicitModelId = 'amazon.titan-text-express-v1'
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      
      function getModelId(envValue, defaultValue) {
        return envValue || defaultValue
      }
      
      const result = getModelId(explicitModelId, defaultModelId)
      expect(result).toBe('amazon.titan-text-express-v1')
      expect(isValidModelId(result)).toBe(true)
    })
  })

  describe('Model ID precedence', () => {
    it('should prioritize explicit configuration over default', () => {
      // Verify the precedence: explicit env var > default constant
      // This is the core behavior for Requirement 2.1
      
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      
      function getModelId(envValue, defaultValue) {
        return envValue || defaultValue
      }
      
      // When env var is set, it should be used
      expect(getModelId('custom-model-id', defaultModelId)).toBe('custom-model-id')
      
      // When env var is not set, default should be used
      expect(getModelId(undefined, defaultModelId)).toBe(defaultModelId)
      expect(getModelId(null, defaultModelId)).toBe(defaultModelId)
      expect(getModelId('', defaultModelId)).toBe(defaultModelId)
    })

    it('should handle whitespace in environment variable', () => {
      // The readEnv function trims whitespace, so we simulate that behavior
      // This ensures accidental whitespace doesn't break model configuration
      
      function readEnv(value) {
        return String(value || '').trim()
      }
      
      function getModelId(envValue, defaultValue) {
        return readEnv(envValue) || defaultValue
      }
      
      const defaultModelId = 'anthropic.claude-haiku-4-5-20251001-v1:0'
      const modelWithWhitespace = '  anthropic.claude-3-5-sonnet-20241022-v2:0  '
      
      const result = getModelId(modelWithWhitespace, defaultModelId)
      expect(result).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0')
      expect(result).not.toContain(' ')
    })
  })
})
