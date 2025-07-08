// OpenRouter API Types
// Based on OpenRouter's API specification and OpenAI compatibility

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string | string[];
  user?: string;
}

export interface ChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface StreamingChatResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamingChoice[];
}

export interface StreamingChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  architecture: {
    modality: 'text' | 'multimodal';
    tokenizer: string;
    instruct_type?: string;
  };
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits?: {
    prompt_tokens: string;
    completion_tokens: string;
  };
}

export interface ModelsResponse {
  data: ModelInfo[];
}

export interface OpenRouterError {
  error: {
    type: string;
    code: string;
    message: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ApiKeyValidationResponse {
  valid: boolean;
  error?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  credits?: {
    balance: number;
    usage: number;
  };
}

// Request headers for OpenRouter API
export interface OpenRouterHeaders {
  'Authorization': string;
  'Content-Type': 'application/json';
  'HTTP-Referer'?: string;
  'X-Title'?: string;
}

// Streaming response types
export type StreamingEventType = 'data' | 'error' | 'done';

export interface StreamingEvent {
  type: StreamingEventType;
  data?: StreamingChatResponse;
  error?: string;
}

// Model categories for organization
export type ModelCategory = 
  | 'gpt'
  | 'claude'
  | 'gemini'
  | 'llama'
  | 'mistral'
  | 'other';

export interface CategorizedModel extends ModelInfo {
  category: ModelCategory;
  featured?: boolean;
  deprecated?: boolean;
}

// Chat parameters with validation
export interface ChatParameters {
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  stream: boolean;
}

export interface ParameterLimits {
  temperature: { min: number; max: number; step: number };
  max_tokens: { min: number; max: number; step: number };
  top_p: { min: number; max: number; step: number };
  frequency_penalty: { min: number; max: number; step: number };
  presence_penalty: { min: number; max: number; step: number };
}

// Default parameter values
export const DEFAULT_PARAMETERS: ChatParameters = {
  temperature: 0.7,
  max_tokens: 2048,
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
  stream: true,
};

export const PARAMETER_LIMITS: ParameterLimits = {
  temperature: { min: 0, max: 2, step: 0.1 },
  max_tokens: { min: 1, max: 8192, step: 1 },
  top_p: { min: 0, max: 1, step: 0.01 },
  frequency_penalty: { min: -2, max: 2, step: 0.1 },
  presence_penalty: { min: -2, max: 2, step: 0.1 },
};
