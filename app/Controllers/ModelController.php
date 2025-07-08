<?php

namespace App\Controllers;

use App\Services\ProxyService;
use App\Helpers\JsonHelper;
use App\Helpers\ErrorHelper;

/**
 * Model Controller
 * 
 * Handles /v1/models endpoint to return available AI models
 * in OpenAI-compatible format.
 */
class ModelController
{
    private ProxyService $proxyService;
    private JsonHelper $jsonHelper;
    private ErrorHelper $errorHelper;
    private array $config;

    public function __construct(ProxyService $proxyService, JsonHelper $jsonHelper, ErrorHelper $errorHelper, array $config = [])
    {
        $this->proxyService = $proxyService;
        $this->jsonHelper = $jsonHelper;
        $this->errorHelper = $errorHelper;
        $this->config = array_merge([
            'cache_ttl' => 300, // 5 minutes
            'fallback_models' => $this->getDefaultModels()
        ], $config);
    }

    /**
     * List available models
     * 
     * @param array $request Request data including user context
     * @return array Response data
     */
    public function list(array $request): array
    {
        try {
            // Validate request
            $validationResult = $this->validateRequest($request);
            if ($validationResult !== true) {
                return $validationResult;
            }

            // Try to get models from backend service
            $models = $this->getModelsFromBackend($request);
            
            // If backend fails, use fallback models
            if (!$models) {
                $models = $this->config['fallback_models'];
            }

            // Format response in OpenAI format
            $response = $this->formatModelsResponse($models);

            return [
                'status' => 200,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Cache-Control' => 'public, max-age=' . $this->config['cache_ttl']
                ],
                'body' => $this->jsonHelper->safeEncode($response)
            ];

        } catch (\Exception $e) {
            error_log('[ModelController] Error in list: ' . $e->getMessage());
            return $this->errorHelper->serverError('Failed to retrieve models');
        }
    }

    /**
     * Validate incoming request
     * 
     * @param array $request Request data
     * @return array|true Validation error response or true if valid
     */
    private function validateRequest(array $request): array|true
    {
        // Check if user context is set (should be set by AuthMiddleware)
        if (!isset($request['user_id']) || !isset($request['user'])) {
            return $this->errorHelper->authenticationError('User context not found');
        }

        // Check request method
        if (($request['method'] ?? '') !== 'GET') {
            return $this->errorHelper->validationError('Method not allowed', 405);
        }

        return true;
    }

    /**
     * Get models from backend service
     * 
     * @param array $request Request data
     * @return array|null Models array or null if failed
     */
    private function getModelsFromBackend(array $request): ?array
    {
        try {
            // Prepare request for proxy service
            $proxyRequest = [
                'method' => 'GET',
                'path' => '/v1/models',
                'headers' => [
                    'Authorization' => 'Bearer ' . ($request['headers']['Authorization'] ?? ''),
                    'X-LA-Cookie' => $request['user']['la_cookie'] ?? '',
                    'X-CF-Clearance' => $request['user']['cf_clearance'] ?? '',
                    'User-Agent' => $request['headers']['User-Agent'] ?? 'OpenRouter-Alternative/1.0'
                ],
                'user_id' => $request['user_id'],
                'user' => $request['user']
            ];

            $response = $this->proxyService->forwardRequest($proxyRequest);

            if ($response['status'] === 200) {
                $responseBody = $this->jsonHelper->safeDecode($response['body']);
                
                if ($responseBody && isset($responseBody['data']) && is_array($responseBody['data'])) {
                    return $responseBody['data'];
                }
            }

            return null;

        } catch (\Exception $e) {
            error_log('[ModelController] Error getting models from backend: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Format models response in OpenAI format
     * 
     * @param array $models Models array
     * @return array Formatted response
     */
    private function formatModelsResponse(array $models): array
    {
        $formattedModels = [];

        foreach ($models as $model) {
            // Handle different input formats
            if (is_string($model)) {
                $formattedModels[] = $this->createModelObject($model);
            } elseif (is_array($model) && isset($model['id'])) {
                $formattedModels[] = $this->normalizeModelObject($model);
            }
        }

        return [
            'object' => 'list',
            'data' => $formattedModels
        ];
    }

    /**
     * Create model object from model name
     * 
     * @param string $modelName Model name
     * @return array Model object
     */
    private function createModelObject(string $modelName): array
    {
        return [
            'id' => $modelName,
            'object' => 'model',
            'created' => time(),
            'owned_by' => 'openrouter-alternative',
            'permission' => [
                [
                    'id' => 'modelperm-' . substr(md5($modelName), 0, 12),
                    'object' => 'model_permission',
                    'created' => time(),
                    'allow_create_engine' => false,
                    'allow_sampling' => true,
                    'allow_logprobs' => false,
                    'allow_search_indices' => false,
                    'allow_view' => true,
                    'allow_fine_tuning' => false,
                    'organization' => '*',
                    'group' => null,
                    'is_blocking' => false
                ]
            ]
        ];
    }

    /**
     * Normalize model object to OpenAI format
     * 
     * @param array $model Model data
     * @return array Normalized model object
     */
    private function normalizeModelObject(array $model): array
    {
        return [
            'id' => $model['id'],
            'object' => $model['object'] ?? 'model',
            'created' => $model['created'] ?? time(),
            'owned_by' => $model['owned_by'] ?? 'openrouter-alternative',
            'permission' => $model['permission'] ?? [
                [
                    'id' => 'modelperm-' . substr(md5($model['id']), 0, 12),
                    'object' => 'model_permission',
                    'created' => time(),
                    'allow_create_engine' => false,
                    'allow_sampling' => true,
                    'allow_logprobs' => false,
                    'allow_search_indices' => false,
                    'allow_view' => true,
                    'allow_fine_tuning' => false,
                    'organization' => '*',
                    'group' => null,
                    'is_blocking' => false
                ]
            ]
        ];
    }

    /**
     * Get default models as fallback
     * 
     * @return array Default models
     */
    private function getDefaultModels(): array
    {
        return [
            'gpt-4o-latest',
            'gpt-4.1-2025-04-14',
            'gpt-4.1-mini-2025-04-14',
            'claude-3-5-haiku-20241022',
            'claude-3-5-sonnet-20241022',
            'claude-3-7-sonnet-20250219',
            'claude-opus-4-20250514',
            'claude-sonnet-4-20250514',
            'gemini-2.0-flash-001',
            'gemini-2.5-flash-preview-04-17',
            'gemini-2.5-pro-preview-05-06',
            'llama-3.3-70b-instruct',
            'llama-4-maverick-03-26-experimental',
            'deepseek-v3-0324',
            'grok-3-mini-beta',
            'grok-3-preview-02-24',
            'o3-2025-04-16',
            'o3-mini',
            'o4-mini-2025-04-16',
            'qwen-max-2025-01-25',
            'dall-e-3',
            'gpt-image-1',
            'gemini-2.0-flash-preview-image-generation',
            'imagen-3.0-generate-002',
            'flux-1.1-pro',
            'ideogram-v2',
            'photon',
            'recraft-v3'
        ];
    }
}
