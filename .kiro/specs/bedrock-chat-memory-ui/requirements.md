# Requirements Document

## Introduction

This feature adds AWS Bedrock as a pluggable AI inference provider to the existing AISCHOOL3 education platform, alongside the current OpenAI integration. It introduces server-side conversation memory (last 50 messages per user/class session) stored in the existing Upstash Redis layer, and redesigns the ClassChat UI to be clean, modern, and production-ready. The architecture uses a provider abstraction (adapter pattern) so the active model backend can be switched via environment variable without code changes.

**Current architecture summary (from code inspection):**
- `src/utils/openai.js` — client-side utility that builds the full prompt (system prompt + material context + last 10 history messages from React state) and POSTs to `/api/chat`
- `api/chat.js` — Edge Function that validates the request via `lib/aiGuard.js`, then proxies the body directly to `https://api.openai.com/v1/chat/completions`
- `lib/aiGuard.js` — rate limiting (20 req/min), per-user concurrency lock, context clamping; uses Upstash Redis when available, falls back to in-process memory
- `api/_db.js` — thin Upstash Redis REST client (get/set/sadd/smembers)
- `src/utils/storage.js` — localStorage-based material cache + server sync; `getRelevantChunks` does keyword-scored retrieval
- Conversation history is currently held only in React component state (ephemeral, lost on refresh, capped at last 10 messages client-side)
- No server-side memory exists today

---

## Glossary

- **AI_Provider**: An abstraction layer (adapter) that wraps a specific model backend (OpenAI or Bedrock) behind a common interface
- **Bedrock_Adapter**: The concrete AI_Provider implementation that calls AWS Bedrock's Converse API
- **OpenAI_Adapter**: The concrete AI_Provider implementation that calls OpenAI's Chat Completions API (existing behavior, refactored)
- **Chat_Memory**: The server-persisted store of the last 50 messages for a given user+class session, stored in Upstash Redis
- **Memory_Key**: The Redis key identifying a Chat_Memory record, formatted as `chat:mem:{userId}:{classCode}`
- **Conversation_Window**: The trimmed slice of Chat_Memory (up to 50 messages) passed to the AI_Provider as context
- **Structured_Prompt**: The four-part message payload sent to the AI_Provider: system prompt, retrieved material context, Conversation_Window, and the latest user message
- **Feature_Flag**: The environment variable `AI_PROVIDER` whose value selects the active AI_Provider (`openai` or `bedrock`)
- **ClassChat**: The React page component at `src/pages/ClassChat.jsx` that renders the chat UI
- **StudyGuideAI**: The AI tutor persona defined in the system prompt
- **Upstash_Redis**: The serverless Redis instance accessed via REST API, used for rate limiting, locks, and Chat_Memory
- **Vercel_Edge**: The Vercel Edge Runtime used by `api/chat.js`

---

## Requirements

### Requirement 1: Provider Abstraction Layer

**User Story:** As a developer, I want all AI model calls to go through a common provider interface, so that I can swap between OpenAI and Bedrock without changing business logic.

#### Acceptance Criteria

1. THE AI_Provider SHALL expose a single async function `complete({ systemPrompt, context, history, userMessage, options })` that returns a plain string response
2. WHEN the environment variable `AI_PROVIDER` is set to `bedrock`, THE Chat_Handler SHALL route all inference calls through the Bedrock_Adapter
3. WHEN the environment variable `AI_PROVIDER` is set to `openai` or is absent, THE Chat_Handler SHALL route all inference calls through the OpenAI_Adapter
4. THE OpenAI_Adapter SHALL preserve all existing behavior of the current `api/chat.js` proxy, including retry logic and context clamping
5. IF the `AI_PROVIDER` value is set to an unrecognized string, THEN THE Chat_Handler SHALL return HTTP 500 with a descriptive error message identifying the invalid provider name
6. THE AI_Provider interface SHALL be defined in a new file `api/_aiProvider.js` so that both adapters import from a single location

### Requirement 2: AWS Bedrock Adapter

**User Story:** As a developer, I want a Bedrock adapter that calls the AWS Bedrock Converse API, so that the app can use Bedrock models for inference.

#### Acceptance Criteria

1. WHEN the Bedrock_Adapter is invoked, THE Bedrock_Adapter SHALL call the AWS Bedrock `converse` API endpoint using AWS Signature Version 4 request signing
2. THE Bedrock_Adapter SHALL read AWS credentials from environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`
3. THE Bedrock_Adapter SHALL read the target model ID from the environment variable `BEDROCK_MODEL_ID`, defaulting to `anthropic.claude-3-haiku-20240307-v1:0` when the variable is absent
4. IF any of `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_REGION` are missing, THEN THE Bedrock_Adapter SHALL throw a descriptive configuration error before making any network call
5. THE Bedrock_Adapter SHALL map the Structured_Prompt into the Bedrock Converse API message format: system prompt as the `system` field, history messages as the `messages` array, and the latest user message appended as the final user turn
6. THE Bedrock_Adapter SHALL enforce a maximum response token limit of 1200 tokens, matching the existing OpenAI configuration
7. IF the Bedrock API returns a non-2xx HTTP status, THEN THE Bedrock_Adapter SHALL throw an error containing the HTTP status code and the response body text
8. WHERE the environment variable `BEDROCK_MOCK` is set to `true`, THE Bedrock_Adapter SHALL return a hardcoded mock response string without making any network call, enabling local testing without AWS credentials

### Requirement 3: Server-Side Chat Memory

**User Story:** As a student, I want the AI tutor to remember my recent conversation across page refreshes, so that I don't have to repeat context I already provided.

#### Acceptance Criteria

1. WHEN a chat request is received, THE Chat_Handler SHALL load the Chat_Memory for the authenticated user and class from Upstash_Redis using the Memory_Key `chat:mem:{userId}:{classCode}`
2. THE Chat_Handler SHALL pass the loaded Conversation_Window (up to the last 50 messages) to the AI_Provider as the `history` parameter
3. WHEN the AI_Provider returns a response, THE Chat_Handler SHALL append both the user message and the assistant response to Chat_Memory in Upstash_Redis
4. WHEN Chat_Memory exceeds 50 messages after appending, THE Chat_Handler SHALL trim Chat_Memory to the most recent 50 messages before persisting
5. THE Chat_Handler SHALL store Chat_Memory as a JSON array in Upstash_Redis with a TTL of 30 days (2592000 seconds)
6. IF the Upstash_Redis read for Chat_Memory fails, THEN THE Chat_Handler SHALL proceed with an empty Conversation_Window and log the error, rather than rejecting the request
7. IF the Upstash_Redis write for Chat_Memory fails, THEN THE Chat_Handler SHALL log the error and return the AI response to the user without failing the request
8. THE Chat_Handler SHALL require a valid authenticated user ID (from the Clerk JWT `sub` claim) before reading or writing Chat_Memory; IF no valid user ID is present, THEN THE Chat_Handler SHALL proceed without persisting memory
9. THE Chat_Handler SHALL accept `classCode` as a field in the POST request body so that memory is scoped per user per class

### Requirement 4: Memory Efficiency and Token Safety

**User Story:** As a developer, I want the conversation memory to be token-safe and efficient, so that it does not cause context overflow or excessive API costs.

#### Acceptance Criteria

1. THE Chat_Handler SHALL truncate each individual message's `content` field to a maximum of 2000 characters before storing it in Chat_Memory
2. WHEN building the Structured_Prompt, THE Chat_Handler SHALL include at most the last 20 messages from the Conversation_Window as the `history` parameter sent to the AI_Provider, even if Chat_Memory contains up to 50
3. THE Chat_Handler SHALL not include file attachment binary data (base64 strings) in Chat_Memory; WHEN a user message contains file data, THE Chat_Handler SHALL store only the text portion and a file name reference
4. THE Structured_Prompt sent to the AI_Provider SHALL maintain the following section order: (1) system prompt, (2) retrieved material context, (3) recent conversation history, (4) latest user message
5. THE Chat_Handler SHALL calculate the total character count of the Structured_Prompt before sending; IF the total exceeds 28000 characters, THEN THE Chat_Handler SHALL reduce the history window by removing the oldest messages until the total is within the limit

### Requirement 5: AWS Account and Service Setup

**User Story:** As a developer, I want clear, step-by-step instructions for setting up AWS Bedrock from zero, so that I can configure the service correctly without guessing.

#### Acceptance Criteria

1. THE Requirements Document SHALL specify that an AWS account is required and that new accounts receive a 12-month free tier, though Bedrock model inference is not included in the free tier and is billed per token
2. THE Requirements Document SHALL specify that the developer must create an IAM user (not root) with programmatic access and attach a policy granting `bedrock:InvokeModel` on the target model ARN
3. THE Requirements Document SHALL specify that Bedrock model access must be explicitly requested in the AWS Console under "Bedrock > Model access" for the chosen region, and that approval is typically instant for Anthropic Claude Haiku
4. THE Requirements Document SHALL specify that `us-east-1` is the recommended region for Bedrock because it has the broadest model availability
5. THE Requirements Document SHALL specify that the developer must generate an IAM Access Key ID and Secret Access Key for the IAM user and store them as environment variables, never committing them to source control
6. THE Requirements Document SHALL specify that the `BEDROCK_MOCK=true` environment variable enables fully local testing without any AWS credentials or costs

### Requirement 6: Local Development and Testing

**User Story:** As a developer, I want to test the full Bedrock integration locally before deploying, so that I can verify correctness without incurring cloud costs.

#### Acceptance Criteria

1. WHEN `BEDROCK_MOCK=true` is set in the local `.env` file, THE Bedrock_Adapter SHALL return a deterministic mock response so the full request/response cycle can be tested without AWS credentials
2. THE local development environment SHALL support switching between providers by changing only the `AI_PROVIDER` environment variable in `.env`
3. THE Chat_Handler SHALL log the active provider name on each request at the `info` level so developers can confirm which adapter is being used
4. WHEN `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are absent from the local environment, THE Chat_Memory system SHALL degrade gracefully by skipping persistence and using an empty history, without throwing errors
5. THE project README or spec SHALL list all required and optional environment variables with descriptions, indicating which are needed for each provider

### Requirement 7: Chat UI Redesign

**User Story:** As a student, I want the class chat interface to look clean, modern, and polished, so that it feels like a professional product rather than a developer prototype.

#### Acceptance Criteria

1. THE ClassChat SHALL render user messages in right-aligned bubbles with a solid accent background and assistant messages in left-aligned cards with a subtle border and white background
2. THE ClassChat SHALL display a typing indicator animation (three animated dots) while the AI_Provider is generating a response
3. WHEN the message list is empty (before the welcome message loads), THE ClassChat SHALL display a centered empty state with the class name and a prompt encouraging the student to ask a question
4. THE ClassChat input area SHALL be a single rounded container that groups the text field, file attach button, and send button together, with a visible focus ring when the text field is active
5. THE ClassChat SHALL auto-scroll to the most recent message whenever a new message is appended, with smooth scroll behavior
6. WHEN the send button is disabled (empty input and no files selected, or loading), THE ClassChat SHALL render the button in a visually distinct disabled state with reduced opacity
7. THE ClassChat SHALL display file attachment previews (image thumbnail or file name chip) above the input area before the message is sent, with a remove button on each preview
8. THE ClassChat SHALL use a consistent type scale: 15px body text, 13px metadata and captions, 18px page title, with a line-height of 1.6 or greater for readability
9. THE ClassChat SHALL remain fully functional and visually correct on viewport widths from 320px to 1440px
10. WHEN a message contains markdown, THE ClassChat SHALL render it using the existing ReactMarkdown pipeline with the existing code block, math, and table styles preserved
11. THE ClassChat header SHALL display the class name and subject, a back-navigation link, and the Clerk UserButton, all within a fixed-height top bar that does not scroll with the message list

### Requirement 8: Feature Flag and Rollback Safety

**User Story:** As a developer, I want to be able to disable the Bedrock integration instantly via environment variable, so that I can roll back to OpenAI without a code deployment.

#### Acceptance Criteria

1. WHEN `AI_PROVIDER` is set to `openai` or is absent, THE system SHALL behave identically to the pre-Bedrock state, with no performance or behavioral difference
2. THE Bedrock_Adapter code SHALL be imported lazily or conditionally so that missing AWS environment variables do not cause startup errors when `AI_PROVIDER=openai`
3. THE Chat_Memory feature SHALL operate independently of the AI_PROVIDER setting; WHEN memory is enabled, THE Chat_Handler SHALL use it regardless of which provider is active
4. WHERE the environment variable `DISABLE_CHAT_MEMORY` is set to `true`, THE Chat_Handler SHALL skip all Chat_Memory reads and writes and pass an empty history to the AI_Provider

### Requirement 9: Schema and Data Design

**User Story:** As a developer, I want a minimal, clearly defined data schema for chat memory, so that I can understand and maintain the storage layer without ambiguity.

#### Acceptance Criteria

1. THE Chat_Memory record SHALL be stored as a JSON-serialized array of message objects under the Memory_Key `chat:mem:{userId}:{classCode}` in Upstash_Redis
2. EACH message object in Chat_Memory SHALL contain exactly three fields: `role` (string, value `"user"` or `"assistant"`), `content` (string, max 2000 characters), and `ts` (Unix timestamp integer in milliseconds)
3. THE Chat_Handler SHALL set a TTL of 2592000 seconds (30 days) on the Memory_Key every time it writes, so that inactive sessions expire automatically
4. THE existing Redis key namespaces used by `lib/aiGuard.js` (`ai:lock:*` and `ai:rl:*`) and `api/_db.js` SHALL not be modified or conflicted with by the new `chat:mem:*` namespace
5. THE Chat_Memory schema SHALL require no changes to any existing database tables, collections, or Redis key structures outside of the new `chat:mem:*` namespace
