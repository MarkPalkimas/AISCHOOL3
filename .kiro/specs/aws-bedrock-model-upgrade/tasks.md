# Implementation Plan: AWS Bedrock Model Upgrade

## Overview

This implementation upgrades the AWS Bedrock integration from Claude Haiku 3 to Claude Haiku 4.5 by updating the default model identifier and enhancing validation and error handling. The changes are minimal and focused on the `api/_bedrockAdapter.js` module and `.env.example` documentation.

## Tasks

- [x] 1. Update default model identifier and add validation
  - [x] 1.1 Update DEFAULT_MODEL_ID constant to Claude Haiku 4.5
    - Change `DEFAULT_MODEL_ID` from `anthropic.claude-3-haiku-20240307-v1:0` to `anthropic.claude-haiku-4-5-20251001-v1:0`
    - _Requirements: 1.1, 1.3_
  
  - [x] 1.2 Add model ID validation function
    - Create `isValidModelId()` function to validate AWS Bedrock model ID format
    - Support patterns for Anthropic, Meta, and Amazon models
    - _Requirements: 3.5, 2.2, 2.3, 2.4_
  
  - [ ]* 1.3 Write unit tests for model ID validation
    - Test valid Claude, Meta, and Amazon model IDs
    - Test invalid formats and edge cases
    - _Requirements: 3.5_

- [x] 2. Enhance error handling and logging
  - [x] 2.1 Enhance describeBedrockError function
    - Add handling for model not found errors (ValidationException with "model.*not found")
    - Add handling for authentication errors (UnrecognizedClientException, InvalidSignatureException)
    - Add handling for throttling errors (ThrottlingException)
    - Improve error message clarity for model access issues
    - _Requirements: 3.1, 3.3, 3.4, 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 2.2 Update logBedrockConfigOnce to include model validation
    - Call `isValidModelId()` and log validation result
    - Add warning log if model ID format is invalid
    - _Requirements: 3.2, 3.5_
  
  - [ ]* 2.3 Write unit tests for error handling
    - Test model access error parsing
    - Test authentication error parsing
    - Test throttling error parsing
    - Test model not found error parsing
    - _Requirements: 3.3, 3.4, 9.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update environment configuration documentation
  - [x] 4.1 Update .env.example with new default model
    - Update `BEDROCK_MODEL_ID` default to `anthropic.claude-haiku-4-5-20251001-v1:0`
    - Add comments documenting supported Claude models (Haiku 4.5, Sonnet 3.5, Opus 3.5)
    - Add comments documenting supported Meta models (Llama 3)
    - Add comments documenting supported Amazon models (Titan)
    - Add note about enabling model access in AWS Bedrock console
    - _Requirements: 1.3, 2.6, 7.1, 7.2, 7.3_

- [x] 5. Verify backward compatibility
  - [x] 5.1 Test default model behavior
    - Verify system uses Claude Haiku 4.5 when BEDROCK_MODEL_ID is not set
    - Verify configuration logging shows correct model ID
    - _Requirements: 8.1, 1.2_
  
  - [x] 5.2 Test explicit model configuration
    - Verify system uses specified model when BEDROCK_MODEL_ID is set
    - Test with Claude Haiku 4.5 explicitly configured
    - _Requirements: 2.1, 6.2_
  
  - [x] 5.3 Test API contract preservation
    - Verify chat request/response format unchanged
    - Verify existing parameters still work (userMessage, context, history)
    - Verify response structure matches legacy implementation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- No property-based tests needed (infrastructure/configuration change)
- Unit tests focus on validation and error handling logic
- Integration testing should be performed manually in staging environment
- Deployment requires updating BEDROCK_MODEL_ID environment variable in Vercel
- AWS Bedrock model access must be enabled for Claude Haiku 4.5 before deployment
