<?php

namespace App\Controllers;

use App\Services\ProxyService;
use App\Helpers\JsonHelper;
use App\Helpers\ErrorHelper;

/**
 * Chat Controller
 * 
 * Handles /v1/chat/completions endpoint with full OpenAI compatibility.
 * Supports both streaming and non-streaming responses.
 */
class ChatController
{
    private ProxyService $proxyService;
    private JsonHelper $jsonHelper;
    private ErrorHelper $errorHelper;

    public function __construct(ProxyService $proxyService, JsonHelper $jsonHelper, ErrorHelper $errorHelper)
    {
        $this->proxyService = $proxyService;
        $this->jsonHelper = $jsonHelper;
        $this->errorHelper = $errorHelper;
    }

    /**
     * Handle chat completions request
     * 
     * @param array $request Request data including user context
     * @return array Response data
     */
    public function completions(array $request): array
    {
        try {
            // Validate request
            $validationResult = $this->validateRequest($request);
            if ($validationResult !== true) {
                return $validationResult;
            }

            // Parse request body
            $requestBody = $this->jsonHelper->safeDecode($request['body'] ?? '{}');
            if (!$requestBody) {
                return $this->errorHelper->validationError('Invalid JSON in request body');
            }

            // Check if streaming is requested
            $isStreaming = $requestBody['stream'] ?? false;

            // Prepare request for proxy service
            $proxyRequest = $this->prepareProxyRequest($request, $requestBody);

            // Forward to backend service
            if ($isStreaming) {
                return $this->handleStreamingResponse($proxyRequest);
            } else {
                return $this->handleNonStreamingResponse($proxyRequest);
            }

        } catch (\Exception $e) {
            error_log('[ChatController] Error in completions: ' . $e->getMessage());
            return $this->errorHelper->serverError('Internal server error');
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
        if (($request['method'] ?? '') !== 'POST') {
            return $this->errorHelper->validationError('Method not allowed', 405);
        }

        // Check content type
        $contentType = $request['headers']['Content-Type'] ?? '';
        if (strpos($contentType, 'application/json') === false) {
            return $this->errorHelper->validationError('Content-Type must be application/json');
        }

        return true;
    }

    /**
     * Validate request body structure
     * 
     * @param array $requestBody Parsed request body
     * @return array|true Validation error response or true if valid
     */
    private function validateRequestBody(array $requestBody): array|true
    {
        // Check required fields
        if (!isset($requestBody['model'])) {
            return $this->errorHelper->validationError('Missing required field: model');
        }

        if (!isset($requestBody['messages']) || !is_array($requestBody['messages'])) {
            return $this->errorHelper->validationError('Missing or invalid required field: messages');
        }

        if (empty($requestBody['messages'])) {
            return $this->errorHelper->validationError('Messages array cannot be empty');
        }

        // Validate messages structure
        foreach ($requestBody['messages'] as $index => $message) {
            if (!is_array($message)) {
                return $this->errorHelper->validationError("Message at index {$index} must be an object");
            }

            if (!isset($message['role']) || !isset($message['content'])) {
                return $this->errorHelper->validationError("Message at index {$index} must have 'role' and 'content' fields");
            }

            if (!in_array($message['role'], ['system', 'user', 'assistant'])) {
                return $this->errorHelper->validationError("Invalid role '{$message['role']}' at message index {$index}");
            }
        }

        // Validate optional fields
        if (isset($requestBody['max_tokens']) && (!is_int($requestBody['max_tokens']) || $requestBody['max_tokens'] < 1)) {
            return $this->errorHelper->validationError('max_tokens must be a positive integer');
        }

        if (isset($requestBody['temperature']) && (!is_numeric($requestBody['temperature']) || $requestBody['temperature'] < 0 || $requestBody['temperature'] > 2)) {
            return $this->errorHelper->validationError('temperature must be between 0 and 2');
        }

        if (isset($requestBody['stream']) && !is_bool($requestBody['stream'])) {
            return $this->errorHelper->validationError('stream must be a boolean');
        }

        return true;
    }

    /**
     * Prepare request for proxy service
     * 
     * @param array $request Original request
     * @param array $requestBody Parsed request body
     * @return array Prepared proxy request
     */
    private function prepareProxyRequest(array $request, array $requestBody): array
    {
        return [
            'method' => 'POST',
            'path' => '/v1/chat/completions',
            'headers' => [
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . ($request['headers']['Authorization'] ?? ''),
                'X-LA-Cookie' => $request['user']['la_cookie'] ?? '',
                'X-CF-Clearance' => $request['user']['cf_clearance'] ?? '',
                'User-Agent' => $request['headers']['User-Agent'] ?? 'OpenRouter-Alternative/1.0'
            ],
            'body' => $this->jsonHelper->safeEncode($requestBody),
            'user_id' => $request['user_id'],
            'user' => $request['user']
        ];
    }

    /**
     * Handle non-streaming response
     * 
     * @param array $proxyRequest Prepared proxy request
     * @return array Response data
     */
    private function handleNonStreamingResponse(array $proxyRequest): array
    {
        try {
            $response = $this->proxyService->forwardRequest($proxyRequest);

            // Ensure response has proper OpenAI format
            if ($response['status'] === 200) {
                $responseBody = $this->jsonHelper->safeDecode($response['body']);
                if ($responseBody && !isset($responseBody['object'])) {
                    $responseBody['object'] = 'chat.completion';
                    $response['body'] = $this->jsonHelper->safeEncode($responseBody);
                }
            }

            return $response;

        } catch (\Exception $e) {
            error_log('[ChatController] Error in non-streaming response: ' . $e->getMessage());
            return $this->errorHelper->serverError('Failed to process request');
        }
    }

    /**
     * Handle streaming response
     * 
     * @param array $proxyRequest Prepared proxy request
     * @return array Response data
     */
    private function handleStreamingResponse(array $proxyRequest): array
    {
        try {
            // Set streaming headers
            $headers = [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no' // Disable nginx buffering
            ];

            // Get streaming response from proxy service
            $response = $this->proxyService->forwardStreamingRequest($proxyRequest);

            if ($response['status'] !== 200) {
                return $response;
            }

            return [
                'status' => 200,
                'headers' => array_merge($headers, $response['headers'] ?? []),
                'body' => $response['body'],
                'streaming' => true
            ];

        } catch (\Exception $e) {
            error_log('[ChatController] Error in streaming response: ' . $e->getMessage());
            return $this->errorHelper->serverError('Failed to process streaming request');
        }
    }

    /**
     * Clean up streaming connection
     * 
     * @param resource $connection Connection resource
     */
    private function cleanupConnection($connection): void
    {
        if (is_resource($connection)) {
            fclose($connection);
        }
    }
}
