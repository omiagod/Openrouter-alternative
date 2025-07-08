import { NextApiRequest, NextApiResponse } from 'next';
import { ModelsResponse, ModelInfo, CategorizedModel, ModelCategory } from '@/types/openrouter';
import { fetchModels, parseOpenRouterError } from '@/lib/openrouter';

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

// Extract API key from request
function extractApiKey(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check query parameter
  if (req.query.apiKey && typeof req.query.apiKey === 'string') {
    return req.query.apiKey;
  }

  // Check environment variable as fallback
  return process.env.OPENROUTER_API_KEY || null;
}

// Categorize model based on its ID
function categorizeModel(modelId: string): ModelCategory {
  const id = modelId.toLowerCase();
  
  if (id.includes('gpt') || id.includes('openai')) {
    return 'gpt';
  } else if (id.includes('claude') || id.includes('anthropic')) {
    return 'claude';
  } else if (id.includes('gemini') || id.includes('google')) {
    return 'gemini';
  } else if (id.includes('llama') || id.includes('meta')) {
    return 'llama';
  } else if (id.includes('mistral')) {
    return 'mistral';
  } else {
    return 'other';
  }
}

// Check if model is featured (popular/recommended)
function isFeaturedModel(modelId: string): boolean {
  const featuredModels = [
    'openai/gpt-4',
    'openai/gpt-4-turbo',
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'google/gemini-pro',
    'meta-llama/llama-3-70b-instruct',
    'mistralai/mistral-7b-instruct',
  ];
  
  return featuredModels.some(featured => modelId.includes(featured.split('/')[1]));
}

// Check if model is deprecated
function isDeprecatedModel(modelId: string): boolean {
  const deprecatedPatterns = [
    'gpt-3.5-turbo-0301',
    'gpt-3.5-turbo-0613',
    'gpt-4-0314',
    'gpt-4-0613',
    'text-davinci',
    'text-curie',
    'text-babbage',
    'text-ada',
  ];
  
  return deprecatedPatterns.some(pattern => modelId.includes(pattern));
}

// Process and enhance model data
function processModels(models: ModelInfo[]): CategorizedModel[] {
  return models.map(model => ({
    ...model,
    category: categorizeModel(model.id),
    featured: isFeaturedModel(model.id),
    deprecated: isDeprecatedModel(model.id),
  }));
}

// Sort models by category and popularity
function sortModels(models: CategorizedModel[]): CategorizedModel[] {
  const categoryOrder: ModelCategory[] = ['gpt', 'claude', 'gemini', 'llama', 'mistral', 'other'];
  
  return models.sort((a, b) => {
    // Featured models first
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    
    // Deprecated models last
    if (a.deprecated && !b.deprecated) return 1;
    if (!a.deprecated && b.deprecated) return -1;
    
    // Sort by category
    const aCategoryIndex = categoryOrder.indexOf(a.category);
    const bCategoryIndex = categoryOrder.indexOf(b.category);
    if (aCategoryIndex !== bCategoryIndex) {
      return aCategoryIndex - bCategoryIndex;
    }
    
    // Sort by name within category
    return a.name.localeCompare(b.name);
  });
}

// Fallback models if API fails
function getFallbackModels(): CategorizedModel[] {
  const fallbackModels: ModelInfo[] = [
    {
      id: 'openai/gpt-4',
      name: 'GPT-4',
      description: 'Most capable GPT-4 model',
      context_length: 8192,
      architecture: {
        modality: 'text',
        tokenizer: 'cl100k_base',
        instruct_type: 'none',
      },
      pricing: {
        prompt: '0.00003',
        completion: '0.00006',
      },
      top_provider: {
        context_length: 8192,
        max_completion_tokens: 4096,
        is_moderated: true,
      },
    },
    {
      id: 'openai/gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient GPT-3.5 model',
      context_length: 4096,
      architecture: {
        modality: 'text',
        tokenizer: 'cl100k_base',
        instruct_type: 'none',
      },
      pricing: {
        prompt: '0.0000015',
        completion: '0.000002',
      },
      top_provider: {
        context_length: 4096,
        max_completion_tokens: 4096,
        is_moderated: true,
      },
    },
    {
      id: 'anthropic/claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Most powerful Claude model',
      context_length: 200000,
      architecture: {
        modality: 'text',
        tokenizer: 'claude',
        instruct_type: 'claude',
      },
      pricing: {
        prompt: '0.000015',
        completion: '0.000075',
      },
      top_provider: {
        context_length: 200000,
        max_completion_tokens: 4096,
        is_moderated: true,
      },
    },
  ];

  return processModels(fallbackModels);
}

// Cache for models (simple in-memory cache)
let modelsCache: {
  data: CategorizedModel[];
  timestamp: number;
  ttl: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Main API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS
  if (handleCors(req, res)) {
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
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
    // Check cache first
    const now = Date.now();
    if (modelsCache && (now - modelsCache.timestamp) < modelsCache.ttl) {
      res.status(200).json({
        object: 'list',
        data: modelsCache.data,
        cached: true,
      });
      return;
    }

    // Extract API key
    const apiKey = extractApiKey(req);
    const useCustomApi = req.query.useCustomApi === 'true';

    let models: CategorizedModel[];

    if (apiKey) {
      try {
        // Fetch models from OpenRouter API
        const response = await fetchModels(apiKey, useCustomApi);
        models = processModels(response.data);
        models = sortModels(models);

        // Update cache
        modelsCache = {
          data: models,
          timestamp: now,
          ttl: CACHE_TTL,
        };

      } catch (error) {
        console.warn('Failed to fetch models from API, using fallback:', error);
        models = getFallbackModels();
      }
    } else {
      // No API key provided, use fallback models
      models = getFallbackModels();
    }

    // Apply filters if requested
    const category = req.query.category as ModelCategory;
    const featured = req.query.featured === 'true';
    const excludeDeprecated = req.query.excludeDeprecated !== 'false'; // Default to true

    let filteredModels = models;

    if (category) {
      filteredModels = filteredModels.filter(model => model.category === category);
    }

    if (featured) {
      filteredModels = filteredModels.filter(model => model.featured);
    }

    if (excludeDeprecated) {
      filteredModels = filteredModels.filter(model => !model.deprecated);
    }

    // Limit results if requested
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    if (limit && limit > 0) {
      filteredModels = filteredModels.slice(0, limit);
    }

    res.status(200).json({
      object: 'list',
      data: filteredModels,
      total: models.length,
      filtered: filteredModels.length,
      cached: false,
    });

  } catch (error) {
    console.error('Models API error:', error);
    
    const errorMessage = parseOpenRouterError(error);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
      statusCode = 401;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      statusCode = 429;
    }

    res.status(statusCode).json({
      error: {
        message: errorMessage,
        type: 'api_error',
        code: 'models_fetch_failed'
      }
    });
  }
}

// Configure API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
