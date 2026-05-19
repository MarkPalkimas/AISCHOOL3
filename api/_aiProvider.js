/**
 * @typedef {Object} CompleteParams
 * @property {string} systemPrompt
 * @property {string} context          - retrieved material context
 * @property {Array<{role:string, content:string}>} history  - up to 20 messages
 * @property {string} userMessage
 * @property {Object} [options]        - provider-specific overrides
 */

/**
 * @typedef {Object} AIProvider
 * @property {(params: CompleteParams) => Promise<string>} complete
 */

/**
 * Returns the AI provider adapter based on the AI_PROVIDER environment variable.
 * Defaults to 'openai' if AI_PROVIDER is not set.
 *
 * @returns {Promise<AIProvider>}
 */
export async function getProvider() {
  const provider = String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase();

  if (provider === 'openai') {
    const mod = await import('./_openaiAdapter.js');
    return mod;
  }

  if (provider === 'bedrock') {
    const mod = await import('./_bedrockAdapter.js');
    return mod;
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
