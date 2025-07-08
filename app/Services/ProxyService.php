<?php

namespace App\Services;

use App\Helpers\JsonHelper;
use App\Helpers\ErrorHelper;

/**
 * Proxy Service
 * 
 * Forwards requests to the Python backend (lmarena2api) running via Passenger.
 * Handles both regular and streaming responses with proper error translation.
 */
class ProxyService
{
    private JsonHelper $jsonHelper;
    private ErrorHelper $errorHelper;
    private array $config;

    public function __construct(JsonHelper $jsonHelper, ErrorHelper $errorHelper, array $config = [])
    {
        $this->jsonHelper = $jsonHelper;
        $this->errorHelper = $errorHelper;
        $this->config = array_merge([
            'backend_url' => 'http://localhost:8000',
            'timeout' => 30,
            'connect_timeout' => 10,
            'max_retries' => 3,
            'retry_delay' => 1,
            'user_agent' => 'OpenRouter-Alternative-Proxy/1.0'
        ], $config);
    }

    /**
     * Forward request to backend service
     * 
     * @param array $request Request data
     * @return array Response data
     */
    public function forwardRequest(array $request): array
    {
        $retries = 0;
        $lastError = null;

        while ($retries < $this->config['max_retries']) {
            try {
                $response = $this->makeHttpRequest($request);
                
                if ($response !== null) {
                    return $this->processResponse($response, $request);
                }

            } catch (\Exception $e) {
                $lastError = $e;
                error_log('[ProxyService] Request failed (attempt ' . ($retries + 1) . '): ' . $e->getMessage());
            }

            $retries++;
            if ($retries < $this->config['max_retries']) {
                sleep($this->config['retry_delay']);
            }
        }

        // All retries failed
        error_log('[ProxyService] All retries failed. Last error: ' . ($lastError ? $lastError->getMessage() : 'Unknown'));
        return $this->errorHelper->serverError('Backend service unavailable');
    }

    /**
     * Forward streaming request to backend service
     * 
     * @param array $request Request data
     * @return array Response data
     */
    public function forwardStreamingRequest(array $request): array
    {
        try {
            $url = $this->buildUrl($request['path']);
            $headers = $this->prepareHeaders($request);

            // Initialize cURL for streaming
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_CUSTOMREQUEST => $request['method'],
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_POSTFIELDS => $request['body'] ?? '',
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_WRITEFUNCTION => [$this, 'streamCallback'],
                CURLOPT_TIMEOUT => $this->config['timeout'],
                CURLOPT_CONNECTTIMEOUT => $this->config['connect_timeout'],
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_USERAGENT => $this->config['user_agent']
            ]);

            // Start streaming
            ob_start();
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($result === false || !empty($error)) {
                throw new \Exception('cURL error: ' . $error);
            }

            $streamContent = ob_get_clean();

            return [
                'status' => $httpCode,
                'headers' => [
                    'Content-Type' => 'text/event-stream',
                    'Cache-Control' => 'no-cache',
                    'Connection' => 'keep-alive'
                ],
                'body' => $streamContent
            ];

        } catch (\Exception $e) {
            error_log('[ProxyService] Streaming request failed: ' . $e->getMessage());
            return $this->errorHelper->serverError('Streaming service unavailable');
        }
    }

    /**
     * Make HTTP request to backend
     * 
     * @param array $request Request data
     * @return array|null Response data or null on failure
     */
    private function makeHttpRequest(array $request): ?array
    {
        $url = $this->buildUrl($request['path']);
        $headers = $this->prepareHeaders($request);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_CUSTOMREQUEST => $request['method'],
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $request['body'] ?? '',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => $this->config['timeout'],
            CURLOPT_CONNECTTIMEOUT => $this->config['connect_timeout'],
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT => $this->config['user_agent']
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || !empty($error)) {
            throw new \Exception('cURL error: ' . $error);
        }

        $headers = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);

        return [
            'status' => $httpCode,
            'headers' => $this->parseHeaders($headers),
            'body' => $body
        ];
    }

    /**
     * Build full URL for backend request
     * 
     * @param string $path Request path
     * @return string Full URL
     */
    private function buildUrl(string $path): string
    {
        $baseUrl = rtrim($this->config['backend_url'], '/');
        $path = ltrim($path, '/');
        return $baseUrl . '/' . $path;
    }

    /**
     * Prepare headers for backend request
     * 
     * @param array $request Request data
     * @return array Headers array
     */
    private function prepareHeaders(array $request): array
    {
        $headers = [];
        
        // Copy relevant headers from original request
        $headersToForward = [
            'Content-Type',
            'Authorization',
            'X-LA-Cookie',
            'X-CF-Clearance',
            'User-Agent'
        ];

        foreach ($headersToForward as $headerName) {
            if (isset($request['headers'][$headerName])) {
                $headers[] = $headerName . ': ' . $request['headers'][$headerName];
            }
        }

        // Add default headers if not present
        if (!isset($request['headers']['Content-Type'])) {
            $headers[] = 'Content-Type: application/json';
        }

        if (!isset($request['headers']['User-Agent'])) {
            $headers[] = 'User-Agent: ' . $this->config['user_agent'];
        }

        return $headers;
    }

    /**
     * Process backend response
     * 
     * @param array $response Raw response data
     * @param array $request Original request data
     * @return array Processed response
     */
    private function processResponse(array $response, array $request): array
    {
        // Handle different status codes
        if ($response['status'] >= 200 && $response['status'] < 300) {
            return $this->handleSuccessResponse($response, $request);
        } elseif ($response['status'] >= 400 && $response['status'] < 500) {
            return $this->handleClientErrorResponse($response);
        } else {
            return $this->handleServerErrorResponse($response);
        }
    }

    /**
     * Handle successful response
     * 
     * @param array $response Response data
     * @param array $request Original request data
     * @return array Processed response
     */
    private function handleSuccessResponse(array $response, array $request): array
    {
        // Extract usage statistics for billing
        $responseBody = $this->jsonHelper->safeDecode($response['body']);
        
        if ($responseBody && !isset($responseBody['usage'])) {
            // Add default usage if not present
            $responseBody['usage'] = [
                'prompt_tokens' => 0,
                'completion_tokens' => 0,
                'total_tokens' => 0
            ];
            $response['body'] = $this->jsonHelper->safeEncode($responseBody);
        }

        return [
            'status' => $response['status'],
            'headers' => array_merge([
                'Content-Type' => 'application/json'
            ], $response['headers']),
            'body' => $response['body']
        ];
    }

    /**
     * Handle client error response
     * 
     * @param array $response Response data
     * @return array Processed response
     */
    private function handleClientErrorResponse(array $response): array
    {
        // Try to parse error from backend
        $responseBody = $this->jsonHelper->safeDecode($response['body']);
        
        if ($responseBody && isset($responseBody['error'])) {
            // Backend already returned OpenAI-compatible error
            return [
                'status' => $response['status'],
                'headers' => ['Content-Type' => 'application/json'],
                'body' => $response['body']
            ];
        }

        // Convert to OpenAI-compatible error
        return $this->errorHelper->backendError($response['status'], $response['body']);
    }

    /**
     * Handle server error response
     * 
     * @param array $response Response data
     * @return array Processed response
     */
    private function handleServerErrorResponse(array $response): array
    {
        error_log('[ProxyService] Backend server error: ' . $response['status'] . ' - ' . $response['body']);
        return $this->errorHelper->serverError('Backend service error');
    }

    /**
     * Parse HTTP headers from response
     * 
     * @param string $headerString Raw headers string
     * @return array Parsed headers
     */
    private function parseHeaders(string $headerString): array
    {
        $headers = [];
        $lines = explode("\r\n", $headerString);
        
        foreach ($lines as $line) {
            if (strpos($line, ':') !== false) {
                list($key, $value) = explode(':', $line, 2);
                $headers[trim($key)] = trim($value);
            }
        }
        
        return $headers;
    }

    /**
     * Callback for streaming responses
     * 
     * @param resource $ch cURL handle
     * @param string $data Chunk of data
     * @return int Number of bytes processed
     */
    private function streamCallback($ch, string $data): int
    {
        echo $data;
        flush();
        return strlen($data);
    }
}
