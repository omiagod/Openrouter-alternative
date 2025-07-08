import {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  ModelsResponse,
  OpenRouterError,
  ApiKeyValidationResponse,
  OpenRouterHeaders,
  StreamingEvent,
} from '@/types/openrouter';

// OpenRouter API configuration
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
const CUSTOM_API_URL = process.env.CUSTOM_API_URL;

// Create headers for OpenRouter API requests
export function createOpenRouterHeaders(apiKey: string): OpenRouterHeaders {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    'X-Title': 'OpenRouter Alternative Chat',
  };
}

// Validate API key format
export function validateApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // OpenRouter API keys typically start with 'sk-or-' and are followed by base64-like characters
  const openRouterPattern = /^sk-or-[A-Za-z0-9+/=]+$/;
  
  // Also accept OpenAI format keys for compatibility
  const openAiPattern = /^sk-[A-Za-z0-9]+$/;
  
  return openRouterPattern.test(apiKey) || openAiPattern.test(apiKey);
}

// Format chat request for OpenRouter API
export function formatChatRequest(request: ChatRequest): ChatRequest {
  // Ensure required fields are present
  if (!request.model || !request.messages || request.messages.length === 0) {
    throw new Error('Model and messages are required');
  }

  // Validate messages
  for (const message of request.messages) {
    if (!message.role || !message.content) {
      throw new Error('Each message must have a role and content');
    }
    if (!['system', 'user', 'assistant'].includes(message.role)) {
      throw new Error('Message role must be system, user, or assistant');
    }
  }

  // Apply default values and constraints
  const formattedRequest: ChatRequest = {
    model: request.model,
    messages: request.messages,
    temperature: Math.max(0, Math.min(2, request.temperature ?? 0.7)),
    max_tokens: Math.max(1, Math.min(8192, request.max_tokens ?? 2048)),
    top_p: Math.max(0, Math.min(1, request.top_p ?? 1.0)),
    frequency_penalty: Math.max(-2, Math.min(2, request.frequency_penalty ?? 0)),
    presence_penalty: Math.max(-2, Math.min(2, request.presence_penalty ?? 0)),
    stream: request.stream ?? true,
  };

  // Add optional fields if provided
  if (request.stop) {
    formattedRequest.stop = request.stop;
  }
  if (request.user) {
    formattedRequest.user = request.user;
  }

  return formattedRequest;
}

// Make a chat completion request
export async function createChatCompletion(
  request: ChatRequest,
  apiKey: string,
  useCustomApi = false
): Promise<ChatResponse> {
  const baseUrl = useCustomApi && CUSTOM_API_URL ? CUSTOM_API_URL : OPENROUTER_API_URL;
  const url = `${baseUrl}/chat/completions`;
  
  const formattedRequest = formatChatRequest({ ...request, stream: false });
  const headers = createOpenRouterHeaders(apiKey);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(formattedRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: ChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Chat completion error:', error);
    throw error;
  }
}

// Create a streaming chat completion
export async function createStreamingChatCompletion(
  request: ChatRequest,
  apiKey: string,
  onChunk: (chunk: StreamingChatResponse) => void,
  onError: (error: string) => void,
  onComplete: () => void,
  useCustomApi = false
): Promise<void> {
  const baseUrl = useCustomApi && CUSTOM_API_URL ? CUSTOM_API_URL : OPENROUTER_API_URL;
  const url = `${baseUrl}/chat/completions`;
  
  const formattedRequest = formatChatRequest({ ...request, stream: true });
  const headers = createOpenRouterHeaders(apiKey);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(formattedRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine === '') {
            continue;
          }

          if (trimmedLine === 'data: [DONE]') {
            onComplete();
            return;
          }

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonData = trimmedLine.slice(6);
              const chunk: StreamingChatResponse = JSON.parse(jsonData);
              onChunk(chunk);
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onComplete();
  } catch (error) {
    console.error('Streaming chat completion error:', error);
    onError(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

// Fetch available models
export async function fetchModels(
  apiKey: string,
  useCustomApi = false
): Promise<ModelsResponse> {
  const baseUrl = useCustomApi && CUSTOM_API_URL ? CUSTOM_API_URL : OPENROUTER_API_URL;
  const url = `${baseUrl}/models`;
  
  const headers = createOpenRouterHeaders(apiKey);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: ModelsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch models error:', error);
    throw error;
  }
}

// Validate API key
export async function validateApiKey(
  apiKey: string,
  useCustomApi = false
): Promise<ApiKeyValidationResponse> {
  if (!validateApiKeyFormat(apiKey)) {
    return {
      valid: false,
      error: 'Invalid API key format',
    };
  }

  try {
    // Try to fetch models as a way to validate the API key
    await fetchModels(apiKey, useCustomApi);
    
    return {
      valid: true,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'API key validation failed',
    };
  }
}

// Parse OpenRouter error response
export function parseOpenRouterError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as OpenRouterError;
    if (errorObj.error?.message) {
      return errorObj.error.message;
    }
  }

  return 'An unknown error occurred';
}

// Estimate token count (rough approximation)
export function estimateTokenCount(text: string): number {
  // Very rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

// Calculate estimated cost based on model pricing
export function calculateEstimatedCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  // This would need to be updated with actual pricing data
  // For now, return a placeholder
  const baseRate = 0.002; // $0.002 per 1K tokens (rough average)
  const totalTokens = promptTokens + completionTokens;
  return (totalTokens / 1000) * baseRate;
}
