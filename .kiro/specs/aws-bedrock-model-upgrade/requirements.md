# Requirements Document

## Introduction

This document specifies the requirements for upgrading the AWS Bedrock integration from the legacy Claude Haiku 3 model to Claude Haiku 4.5, while adding support for multiple newly approved models (Claude, Meta, and Amazon models). The upgrade maintains backward compatibility with the existing chat API while providing flexibility for future model selection and configuration.

## Glossary

- **Bedrock_Adapter**: The module (`api/_bedrockAdapter.js`) responsible for interfacing with AWS Bedrock Converse API
- **AI_Provider**: The module (`api/_aiProvider.js`) that selects and loads the appropriate AI provider adapter
- **Model_ID**: The AWS Bedrock model identifier string (e.g., `anthropic.claude-3-haiku-20240307-v1:0`)
- **Converse_API**: AWS Bedrock's unified API for interacting with foundation models
- **Chat_Handler**: The API endpoint (`api/chat.js`) that processes user chat requests
- **Environment_Config**: Configuration values stored in environment variables (`.env` files)
- **Legacy_Model**: Claude Haiku 3 (`anthropic.claude-3-haiku-20240307-v1:0`) - no longer available
- **Primary_Model**: Claude Haiku 4.5 - the new default model for the system
- **Inference_Config**: Parameters controlling model behavior (maxTokens, temperature)
- **Model_Registry**: A mapping of supported models with their configurations and capabilities

## Requirements

### Requirement 1: Replace Legacy Model with Claude Haiku 4.5

**User Story:** As a system administrator, I want to replace the legacy Claude Haiku 3 model with Claude Haiku 4.5, so that the system continues to function with an actively supported model.

#### Acceptance Criteria

1. THE Bedrock_Adapter SHALL use Claude Haiku 4.5 as the default Model_ID when BEDROCK_MODEL_ID is not specified in Environment_Config
2. WHEN the system starts with AI_PROVIDER set to "bedrock", THE Bedrock_Adapter SHALL log the configured Model_ID
3. THE Environment_Config example file SHALL document Claude Haiku 4.5 as the default BEDROCK_MODEL_ID
4. WHEN a chat request is processed with the default configuration, THE Bedrock_Adapter SHALL successfully invoke Claude Haiku 4.5 via the Converse_API
5. FOR ALL valid chat requests using Claude Haiku 4.5, THE system SHALL return responses with the same structure as the Legacy_Model (maintaining API compatibility)

### Requirement 2: Support Multiple Model Configurations

**User Story:** As a system administrator, I want to configure different AWS Bedrock models via environment variables, so that I can select the most appropriate model for different use cases.

#### Acceptance Criteria

1. WHEN BEDROCK_MODEL_ID is set in Environment_Config, THE Bedrock_Adapter SHALL use the specified Model_ID for all requests
2. THE Bedrock_Adapter SHALL support all newly approved Claude model identifiers (Haiku 4.5, Sonnet, Opus variants)
3. THE Bedrock_Adapter SHALL support all newly approved Meta model identifiers (Llama variants)
4. THE Bedrock_Adapter SHALL support all newly approved Amazon model identifiers (Titan variants)
5. WHEN an unsupported or invalid Model_ID is configured, THE Bedrock_Adapter SHALL return a descriptive error message indicating the model is not accessible
6. THE Environment_Config example file SHALL document examples of supported model identifiers for Claude, Meta, and Amazon models

### Requirement 3: Validate Model Access and Configuration

**User Story:** As a developer, I want clear error messages when model access fails, so that I can quickly diagnose configuration issues.

#### Acceptance Criteria

1. WHEN the Bedrock_Adapter attempts to invoke a Model_ID that is not enabled in the AWS account, THE system SHALL return an error message indicating model access is not enabled
2. WHEN the Bedrock_Adapter logs configuration at startup, THE log SHALL include the Model_ID, AWS region, and credential mode
3. IF a Converse_API request fails with a ValidationException, THEN THE Bedrock_Adapter SHALL parse the error and return a human-readable message
4. WHEN the Bedrock_Adapter encounters an authentication error, THE system SHALL return an error message indicating credential configuration issues
5. THE Bedrock_Adapter SHALL validate that the Model_ID format matches AWS Bedrock naming conventions before making API calls

### Requirement 4: Maintain Inference Configuration Compatibility

**User Story:** As a system operator, I want the inference parameters (temperature, maxTokens) to work correctly with all supported models, so that chat responses maintain consistent quality.

#### Acceptance Criteria

1. THE Bedrock_Adapter SHALL apply the same Inference_Config (maxTokens: 1200, temperature: 0.7) to all supported models by default
2. WHERE model-specific inference parameter overrides are needed, THE Bedrock_Adapter SHALL support optional model-specific configurations
3. WHEN a model does not support a specified inference parameter, THE Bedrock_Adapter SHALL log a warning and continue with supported parameters
4. FOR ALL supported models, THE Bedrock_Adapter SHALL validate that the Inference_Config values are within the model's acceptable ranges
5. THE system SHALL document any model-specific inference parameter limitations or recommendations

### Requirement 5: Preserve Existing API Contract

**User Story:** As a frontend developer, I want the chat API to maintain its existing interface, so that no client-side changes are required for the model upgrade.

#### Acceptance Criteria

1. THE Chat_Handler SHALL continue to accept the same request parameters (userMessage, context, classCode, conversationId, attachments)
2. THE Chat_Handler SHALL continue to return responses in the same format (choices array with message content, conversation object)
3. WHEN the AI_Provider is set to "bedrock", THE system SHALL process requests identically to the Legacy_Model implementation
4. THE Bedrock_Adapter SHALL continue to use the buildStructuredUserTurn function from the OpenAI adapter for message formatting
5. FOR ALL existing chat functionality (history retrieval, conversation persistence, attachment handling), THE system SHALL maintain identical behavior after the upgrade

### Requirement 6: Enable Model Selection Testing

**User Story:** As a quality assurance engineer, I want to test different models easily, so that I can verify functionality across all supported models.

#### Acceptance Criteria

1. THE system SHALL allow Model_ID changes via Environment_Config without code modifications
2. WHEN the Model_ID is changed and the system is restarted, THE Bedrock_Adapter SHALL use the new Model_ID for all subsequent requests
3. THE system SHALL provide clear logging of which Model_ID is being used for each request
4. WHERE multiple models are tested, THE system SHALL maintain consistent response structure across all models
5. THE documentation SHALL include instructions for testing different models in development and staging environments

### Requirement 7: Document Model Capabilities and Limitations

**User Story:** As a system administrator, I want documentation of each supported model's capabilities, so that I can make informed decisions about model selection.

#### Acceptance Criteria

1. THE documentation SHALL list all supported Model_IDs with their AWS Bedrock identifiers
2. THE documentation SHALL describe the primary use case for Claude Haiku 4.5 (fast, cost-effective responses)
3. THE documentation SHALL describe when to consider alternative models (e.g., Sonnet for complex reasoning, Llama for specific tasks)
4. THE documentation SHALL specify the token limits for each supported model family
5. THE documentation SHALL include cost considerations for different model choices

### Requirement 8: Ensure Backward Compatibility with Existing Deployments

**User Story:** As a DevOps engineer, I want the upgrade to be backward compatible, so that existing deployments continue to work without immediate reconfiguration.

#### Acceptance Criteria

1. WHEN BEDROCK_MODEL_ID is not set in Environment_Config, THE system SHALL default to Claude Haiku 4.5 (not the Legacy_Model)
2. WHEN an existing deployment has BEDROCK_MODEL_ID explicitly set to the Legacy_Model, THE system SHALL attempt to use it and return a clear error if unavailable
3. THE upgrade SHALL not require changes to AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION)
4. THE upgrade SHALL not require changes to the Converse_API request structure
5. WHERE the Legacy_Model is explicitly configured, THE error message SHALL recommend updating to Claude Haiku 4.5

### Requirement 9: Support Model-Specific Error Handling

**User Story:** As a developer, I want model-specific error handling, so that I can diagnose issues unique to different model families.

#### Acceptance Criteria

1. WHEN a Claude model returns an error, THE Bedrock_Adapter SHALL parse and log Claude-specific error details
2. WHEN a Meta model returns an error, THE Bedrock_Adapter SHALL parse and log Meta-specific error details
3. WHEN an Amazon model returns an error, THE Bedrock_Adapter SHALL parse and log Amazon-specific error details
4. IF a model returns an unexpected response format, THEN THE Bedrock_Adapter SHALL log the raw response for debugging
5. THE error logging SHALL include the Model_ID, request ID, HTTP status code, and error message for all failures

### Requirement 10: Validate Response Parsing Across Models

**User Story:** As a developer, I want consistent response parsing across all models, so that the chat interface receives properly formatted responses.

#### Acceptance Criteria

1. FOR ALL supported models, THE Bedrock_Adapter SHALL extract text content from the Converse_API response
2. WHEN a model returns multiple content parts, THE Bedrock_Adapter SHALL concatenate them with newlines
3. IF a model returns an empty response, THEN THE Bedrock_Adapter SHALL throw an error with the raw response for debugging
4. THE Bedrock_Adapter SHALL trim whitespace from the final response text
5. FOR ALL supported models, THE response parsing logic SHALL handle the same content structure (array of content parts with text fields)

