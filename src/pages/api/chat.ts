import { NextApiRequest, NextApiResponse } from 'next';
import { ChatRequest, ChatResponse, StreamingChatResponse } from '@/types/openrouter';
import { 
  createChatCompletion, 
  createStreamingChatCompletion, 
  formatChatRequest,
  parseOpenRouterError 
} from '@/lib/openrouter';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight
function handleCors(req: NextApiRequest, res: NextApiResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// Validate request body
function validateChatRequest(body: any): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  if (!body.model || typeof body.model !== 'string') {
    return { valid: false, error: 'Model is required and must be a string' };
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { valid: false, error: 'Messages array is required and must not be empty' };
  }

  // Validate each message
  for (let i = 0; i < body.messages.length; i++) {
    const message = body.messages[i];
    if (!message.role || !message.content) {
      return { 
        valid: false, 
        error: `Message at index ${i} must have both role and content` 
      };
    }
    if (!['system', 'user', 'assistant'].includes(message.role)) {
      return { 
        valid: false, 
        error: `Message at index ${i} has invalid role: ${message.role}` 
      };
    }
  }

  return { valid: true };
}

// Extract API key from request
function extractApiKey(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Also check for API key in body (for client-side requests)
  if (req.body && req.body.apiKey) {
    return req.body.apiKey;
  }

  // Check environment variable as fallback
  return process.env.OPENROUTER_API_KEY || null;
}

// Handle streaming response
async function handleStreamingResponse(
  req: NextApiRequest,
  res: NextApiResponse,
  chatRequest: ChatRequest,
  apiKey: string
) {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
    ...corsHeaders,
  });

  let hasStarted = false;

  try {
    await createStreamingChatCompletion(
      chatRequest,
      apiKey,
      (chunk: StreamingChatResponse) => {
        hasStarted = true;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      },
      (error: string) => {
        if (!hasStarted) {
          res.write(`data: ${JSON.stringify({
            error: {
              message: error,
              type: 'api_error',
              code: 'streaming_error'
            }
          })}\n\n`);
        }
        res.write(`data: [DONE]\n\n`);
        res.end();
      },
      () => {
        res.write(`data: [DONE]\n\n`);
        res.end();
      },
      req.body.useCustomApi || false
    );
  } catch (error) {
    if (!hasStarted) {
      res.write(`data: ${JSON.stringify({
        error: {
          message: parseOpenRouterError(error),
          type: 'api_error',
          code: 'request_failed'
        }
      })}\n\n`);
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
}

// Handle non-streaming response
async function handleNonStreamingResponse(
  req: NextApiRequest,
  res: NextApiResponse,
  chatRequest: ChatRequest,
  apiKey: string
) {
  try {
    const response = await createChatCompletion(
      chatRequest,
      apiKey,
      req.body.useCustomApi || false
    );

    res.status(200).json(response);
  } catch (error) {
    console.error('Chat completion error:', error);
    
    const errorMessage = parseOpenRouterError(error);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
      statusCode = 401;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      statusCode = 429;
    } else if (errorMessage.includes('model') || errorMessage.includes('invalid')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      error: {
        message: errorMessage,
        type: 'api_error',
        code: 'request_failed'
      }
    });
  }
}

// Main API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS
  if (handleCors(req, res)) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      error: {
        message: 'Method not allowed',
        type: 'invalid_request_error',
        code: 'method_not_allowed'
      }
    });
    return;
  }

  try {
    // Validate request body
    const validation = validateChatRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: {
          message: validation.error,
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
      return;
    }

    // Extract API key
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({
        error: {
          message: 'API key is required. Please provide it in the Authorization header or request body.',
          type: 'authentication_error',
          code: 'missing_api_key'
        }
      });
      return;
    }

    // Format the chat request
    const chatRequest = formatChatRequest(req.body);

    // Handle streaming vs non-streaming
    if (chatRequest.stream) {
      await handleStreamingResponse(req, res, chatRequest, apiKey);
    } else {
      await handleNonStreamingResponse(req, res, chatRequest, apiKey);
    }

  } catch (error) {
    console.error('API handler error:', error);
    
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
}

// Configure API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
}
