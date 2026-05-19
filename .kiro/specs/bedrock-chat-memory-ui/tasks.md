# Implementation Plan: bedrock-chat-memory-ui

## Overview

Implement the three coordinated changes in dependency order: (1) extend the Redis client, (2) build the provider abstraction and adapters, (3) refactor `api/chat.js` to use providers and server-side memory, (4) redesign the ClassChat UI. Tests are co-located with each implementation task so bugs are caught early.

Install test dependencies first:
```bash
npm install --save-dev fast-check vitest @testing-library/react @testing-library/jest-dom jsdom
```

## Tasks

- [x] 1. Extend `api/_db.js` with `setex` support
  - Add `async setex(key, ttlSeconds, value)` method to the Redis client object in `api/_db.js`
  - The method must call `exec('set', key, payload, 'EX', String(ttlSeconds))` where `payload` is `JSON.stringify(value)` for non-strings
  - This is the only Redis write path used by chat memory; no other files change in this task
  - _Requirements: 3.5, 9.3_

  - [ ]* 1.1 Write property test for `setex` TTL correctness
    - **Property 12: Memory writes always use TTL of 2592000 seconds**
    - **Validates: Requirements 3.5, 9.3**
    - File: `tests/chatMemory.test.js` — mock `exec`, assert TTL arg equals `2592000` for any message array

- [x] 2. Create `api/_aiProvider.js` — provider interface and factory
  - Define the `CompleteParams` JSDoc typedef (`systemPrompt`, `context`, `history`, `userMessage`, `options`)
  - Implement `getProvider()`: reads `process.env.AI_PROVIDER`, returns the correct adapter module, throws `"Unknown AI_PROVIDER: <value>"` for any other string
  - Import adapters lazily inside the `if` branches so missing AWS env vars don't cause startup errors when `AI_PROVIDER=openai`
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 8.2_

  - [ ]* 2.1 Write property test for unrecognized provider
    - **Property 2: Unrecognized AI_PROVIDER throws before any network call**
    - **Validates: Requirements 1.5**
    - File: `tests/aiProvider.test.js` — use `fc.string().filter(s => s !== 'openai' && s !== 'bedrock')` to generate invalid provider names; assert `getProvider()` throws and no `fetch` is called

  - [ ]* 2.2 Write unit tests for `getProvider()` routing
    - `AI_PROVIDER=openai` → returns OpenAI adapter
    - `AI_PROVIDER` absent → returns OpenAI adapter
    - `AI_PROVIDER=bedrock` → returns Bedrock adapter
    - File: `tests/aiProvider.test.js`
    - _Requirements: 1.2, 1.3_

- [x] 3. Create `api/_openaiAdapter.js` — OpenAI adapter
  - Extract the OpenAI proxy logic from `api/chat.js` into a `complete({ systemPrompt, context, history, userMessage, options })` function
  - Assemble the `messages` array: `[{role:'system', content:systemPrompt}, ...history (up to 20), {role:'user', content: buildStructuredUserTurn(context, userMessage)}]`
  - `buildStructuredUserTurn` must produce the same `MATERIALS_CONTEXT: ... STUDENT_QUESTION:` format currently in `src/utils/openai.js`
  - Preserve all existing behavior: `callWithOpenAIRetry`, `max_tokens:1200`, `temperature:0.7`, `presence_penalty:0.6`, `frequency_penalty:0.3`
  - Return the assistant text string extracted from `data.choices[0].message.content`
  - _Requirements: 1.1, 1.4_

  - [ ]* 3.1 Write property test for `complete()` return type
    - **Property 1: Provider complete() always returns a string**
    - **Validates: Requirements 1.1**
    - File: `tests/aiProvider.test.js` — mock `fetch` to return a valid OpenAI response; use `fc.record({systemPrompt: fc.string(), context: fc.string(), history: fc.array(fc.record({role: fc.constantFrom('user','assistant'), content: fc.string()}), {maxLength:20}), userMessage: fc.string()})` and assert `typeof result === 'string'`

- [x] 4. Create `api/_bedrockAdapter.js` — Bedrock adapter with SigV4
  - Implement `complete({ systemPrompt, context, history, userMessage })` that calls the Bedrock Converse API
  - Validate `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` are present; throw descriptive config error before any `fetch` if any are missing
  - Read `BEDROCK_MODEL_ID` from env, defaulting to `anthropic.claude-3-haiku-20240307-v1:0`
  - When `BEDROCK_MOCK=true`, return a hardcoded mock string immediately without any network call or credential check
  - Build the Converse request body: `system` array, `messages` array (history + final user turn via `buildStructuredUserTurn`), `inferenceConfig: { maxTokens: 1200, temperature: 0.7 }`
  - Implement SigV4 signing using Web Crypto API: canonical request → string-to-sign → derived signing key (HMAC-SHA256 chain) → signature → `Authorization` header
  - Throw `"Bedrock <status>: <body>"` for any non-2xx response
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 4.1 Write property test for Bedrock request shape
    - **Property 3: Bedrock request shape is always correct**
    - **Validates: Requirements 2.5, 2.6**
    - File: `tests/bedrockAdapter.test.js` — intercept `fetch`, use `fc.record({systemPrompt: fc.string(), history: fc.array(fc.record({role: fc.constantFrom('user','assistant'), content: fc.string()}), {maxLength:20}), userMessage: fc.string()})`, assert `system` is non-empty array, last `messages` entry is user role, `inferenceConfig.maxTokens === 1200`

  - [ ]* 4.2 Write property test for missing AWS credentials
    - **Property 4: Missing AWS credentials always cause a config error before network call**
    - **Validates: Requirements 2.4**
    - File: `tests/bedrockAdapter.test.js` — use `fc.subarray(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_REGION'])` to generate subsets of missing vars; assert adapter throws before `fetch` is called

  - [ ]* 4.3 Write property test for non-2xx error propagation
    - **Property 5: Bedrock non-2xx responses always throw with status code**
    - **Validates: Requirements 2.7**
    - File: `tests/bedrockAdapter.test.js` — use `fc.integer({min:400, max:599})` to generate error status codes; mock `fetch` to return that status; assert thrown error message contains the status code

  - [ ]* 4.4 Write unit tests for Bedrock adapter
    - Mock mode: `BEDROCK_MOCK=true` returns mock string, no `fetch` called
    - Default model ID: absent `BEDROCK_MODEL_ID` → uses `anthropic.claude-3-haiku-20240307-v1:0`
    - Custom model ID: `BEDROCK_MODEL_ID=custom-model` → uses `custom-model`
    - SigV4 `Authorization` header is present and starts with `AWS4-HMAC-SHA256`
    - File: `tests/bedrockAdapter.test.js`
    - _Requirements: 2.3, 2.8_

- [x] 5. Implement chat memory helpers in `api/chat.js`
  - Add `loadMemory(userId, classCode)` and `saveMemory(userId, classCode, messages)` as module-level async functions inside `api/chat.js`
  - `loadMemory`: GET `chat:mem:${userId}:${classCode}`, JSON.parse, validate array, return last 50 items; catch all errors, log `{event:"chat_memory_load_error"}`, return `[]`
  - `saveMemory`: trim to last 50, truncate each `content` to 2000 chars, strip base64 (replace with `[File: filename]`), set `ts` timestamp, call `db.setex(key, 2592000, messages)`; catch all errors, log `{event:"chat_memory_save_error"}`
  - Skip all Redis calls when `userId` is null/undefined or `DISABLE_CHAT_MEMORY=true`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.3, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 5.1 Write property test for memory key format
    - **Property 6: Memory key always uses the correct format**
    - **Validates: Requirements 3.1, 9.1**
    - File: `tests/chatMemory.test.js` — use `fc.tuple(fc.string({minLength:1}), fc.string({minLength:1}))` for `[userId, classCode]`; spy on `db.get` and `db.setex`; assert key equals `` `chat:mem:${userId}:${classCode}` ``

  - [ ]* 5.2 Write property test for stored memory length cap
    - **Property 7: Stored memory length never exceeds 50**
    - **Validates: Requirements 3.4**
    - File: `tests/chatMemory.test.js` — use `fc.array(messageArb, {minLength:0, maxLength:200})` as existing memory; after `saveMemory`, assert persisted array length ≤ 50

  - [ ]* 5.3 Write property test for history passed to provider
    - **Property 8: History passed to provider never exceeds 20 messages**
    - **Validates: Requirements 4.2**
    - File: `tests/chatMemory.test.js` — use `fc.array(messageArb, {minLength:0, maxLength:100})` as loaded memory; spy on `provider.complete`; assert `history.length <= 20`

  - [ ]* 5.4 Write property test for content truncation
    - **Property 9: Stored message content never exceeds 2000 characters**
    - **Validates: Requirements 4.1, 9.2**
    - File: `tests/chatMemory.test.js` — use `fc.string({minLength:0, maxLength:5000})` as message content; after `saveMemory`, assert every stored `content.length <= 2000`

  - [ ]* 5.5 Write property test for no base64 in memory
    - **Property 10: File binary data is never stored in memory**
    - **Validates: Requirements 4.3**
    - File: `tests/chatMemory.test.js` — generate user messages containing base64-like strings (e.g. `data:image/png;base64,...`); after `saveMemory`, assert no stored `content` contains a base64 data URI

  - [ ]* 5.6 Write property test for DISABLE_CHAT_MEMORY flag
    - **Property 14: DISABLE_CHAT_MEMORY=true prevents all Redis memory calls**
    - **Validates: Requirements 8.4**
    - File: `tests/chatMemory.test.js` — set `DISABLE_CHAT_MEMORY=true`; use `fc.record({userId: fc.string(), classCode: fc.string()})`; assert neither `db.get` nor `db.setex` is called

  - [ ]* 5.7 Write property test for message schema
    - **Property 13: Every stored message has exactly the required schema fields**
    - **Validates: Requirements 9.2**
    - File: `tests/chatMemory.test.js` — after `saveMemory`, assert every message object has exactly `role`, `content`, and `ts` fields with correct types; no extra fields

  - [ ]* 5.8 Write unit tests for memory edge cases
    - Redis read failure → returns `[]`, does not throw
    - Redis write failure → does not throw, logs error
    - `userId` absent → no Redis calls made
    - Empty memory → returns `[]`
    - File: `tests/chatMemory.test.js`
    - _Requirements: 3.6, 3.7, 3.8_

- [x] 6. Refactor `api/chat.js` to use provider abstraction and memory
  - Remove the direct OpenAI `fetch` call and replace with `const provider = getProvider(); const text = await provider.complete(...)`
  - Parse `classCode` from the request body
  - Call `verifyAuth(req)` to get `userId` (already in `api/_auth.js`)
  - Load memory via `loadMemory(userId, classCode)` after the guard check
  - Trim history to last 20 for the prompt; pass full loaded array to `saveMemory`
  - Build the four-part structured prompt and pass to `provider.complete({ systemPrompt, context, history, userMessage })`
  - Save updated memory via `saveMemory(userId, classCode, [...loadedHistory, userMsg, assistantMsg])`
  - Return response in OpenAI-compatible shape `{choices:[{message:{content: text}}]}`
  - Log `{event:"ai_chat_request", provider: process.env.AI_PROVIDER || 'openai', ...}` at info level
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 3.9, 4.2, 4.4, 6.3, 8.1, 8.3_

  - [ ]* 6.1 Write property test for structured prompt character budget
    - **Property 11: Total structured prompt never exceeds 28000 characters**
    - **Validates: Requirements 4.5**
    - File: `tests/promptBuilder.test.js` — extract or replicate the prompt assembly logic; use `fc.record({context: fc.string({maxLength:10000}), history: fc.array(fc.record({role: fc.constantFrom('user','assistant'), content: fc.string({maxLength:2000})}), {maxLength:50}), userMessage: fc.string({maxLength:4000})})` and assert assembled prompt length ≤ 28000

  - [ ]* 6.2 Write integration tests for `api/chat.js`
    - Full request with `AI_PROVIDER=openai` returns OpenAI-compatible response shape
    - Full request with `AI_PROVIDER=bedrock` and `BEDROCK_MOCK=true` returns response
    - Active provider name appears in log output on each request
    - `classCode` in request body scopes memory to correct Redis key
    - File: `tests/chat.integration.test.js`
    - _Requirements: 1.2, 1.3, 3.9, 6.3_

- [x] 7. Checkpoint — ensure all backend tests pass
  - Run `npx vitest --run tests/aiProvider.test.js tests/bedrockAdapter.test.js tests/chatMemory.test.js tests/promptBuilder.test.js tests/chat.integration.test.js`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Redesign `src/pages/ClassChat.jsx` — UI overhaul
  - Replace all inline `style` objects with Tailwind utility classes for new UI elements
  - Implement right-aligned user bubbles (`bg-blue-600 text-white rounded-2xl rounded-br-sm`) and left-aligned assistant cards (`bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-sm`)
  - Add empty state: centered card shown when `messages.length === 0`, displaying class name and a prompt to ask a question
  - Replace the three-dot pulse loader with a bouncing-dots typing indicator using staggered `animation-delay` (0ms, 150ms, 300ms)
  - Wrap the text field, file attach button, and send button in a single `focus-within:ring-2 focus-within:ring-blue-500` rounded container
  - Apply `opacity-40 cursor-not-allowed` to the send button when disabled (empty input + no files, or loading)
  - Enforce type scale: `text-[15px] leading-relaxed` for body, `text-[13px]` for metadata/captions, `text-[18px] font-bold` for page title
  - Ensure the layout is fluid between `min-w-[320px]` and `max-w-[1440px]`; message column uses `max-w-3xl mx-auto`
  - Preserve all existing logic: `sendMessageToAI`, file handling, ReactMarkdown pipeline with remarkMath/remarkGfm/rehypeKatex, auto-scroll, header with back link and UserButton
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11_

  - [ ]* 8.1 Write property test for message alignment
    - **Property 15: Message alignment is always correct**
    - **Validates: Requirements 7.1**
    - File: `tests/ClassChat.test.jsx` — use `fc.array(fc.record({role: fc.constantFrom('user','assistant'), content: fc.string()}), {minLength:1})`; render component with mocked messages; assert user messages have right-alignment class and assistant messages have left-alignment class

  - [ ]* 8.2 Write property test for auto-scroll behavior
    - **Property 16: Auto-scroll fires on every new message**
    - **Validates: Requirements 7.5**
    - File: `tests/ClassChat.test.jsx` — mock `scrollIntoView`; use `fc.array(messageArb, {minLength:1})`; assert `scrollIntoView` called with `{behavior:'smooth'}` after each messages state update

  - [ ]* 8.3 Write property test for send button disabled state
    - **Property 17: Send button disabled state is visually distinct when input is empty**
    - **Validates: Requirements 7.6**
    - File: `tests/ClassChat.test.jsx` — render with empty `input` and empty `selectedFiles`; assert send button has `disabled` attribute and reduced-opacity class

  - [ ]* 8.4 Write property test for file preview chips
    - **Property 18: File previews render for every selected file**
    - **Validates: Requirements 7.7**
    - File: `tests/ClassChat.test.jsx` — use `fc.array(fc.record({name: fc.string({minLength:1}), type: fc.string()}), {minLength:1, maxLength:10})`; simulate file selection; assert exactly one chip per file, each with file name and a remove button

  - [ ]* 8.5 Write property test for ReactMarkdown on assistant messages
    - **Property 19: ReactMarkdown renders all assistant messages**
    - **Validates: Requirements 7.10**
    - File: `tests/ClassChat.test.jsx` — use `fc.array(fc.record({role: fc.constantFrom('user','assistant'), content: fc.string()}), {minLength:1})`; render component; assert every assistant message is wrapped in a ReactMarkdown component, not a plain `<div>`

  - [ ]* 8.6 Write unit tests for ClassChat UI states
    - Typing indicator renders when `isLoading=true`
    - Empty state renders when `messages=[]`
    - Header displays class name, subject, back link, and UserButton
    - Input container groups text field, attach button, and send button in a single element
    - Type scale: body text is `text-[15px]`, metadata is `text-[13px]`, title is `text-[18px]`
    - File: `tests/ClassChat.test.jsx`
    - _Requirements: 7.2, 7.3, 7.4, 7.8, 7.11_

- [x] 9. Final checkpoint — ensure all tests pass
  - Run `npx vitest --run`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the backend/frontend boundary
- Property tests use fast-check with `{ numRuns: 100 }` and include the comment tag `// Feature: bedrock-chat-memory-ui, Property <N>: <property_text>`
- `api/chat.js` response shape stays OpenAI-compatible so `src/utils/openai.js` on the client needs no changes
- `lib/aiGuard.js` is not modified; all rate-limiting and lock behavior is preserved
