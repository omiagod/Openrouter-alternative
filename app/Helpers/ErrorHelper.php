<?php

namespace App\Helpers;

/**
 * Error Helper
 * 
 * Provides consistent error handling and formatting in OpenAI-compatible format.
 * Handles different error types with proper HTTP status codes and error messages.
 */
class ErrorHelper
{
    private array $config;

    public function __construct(array $config = [])
    {
        $this->config = array_merge([
            'log_errors' => true,
            'include_trace' => false,
            'default_error_message' => 'An unexpected error occurred'
        ], $config);
    }

    /**
     * Format authentication error (401/403)
     * 
     * @param string $message Error message
     * @param int $status HTTP status code (401 or 403)
     * @return array Error response
     */
    public function authenticationError(string $message = 'Authentication failed', int $status = 401): array
    {
        $this->logError('Authentication Error', $message, $status);
        
        return [
            'status' => $status,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'authentication_error',
                    'code' => $status === 401 ? 'invalid_authorization' : 'forbidden'
                ]
            ])
        ];
    }

    /**
     * Format rate limiting error (429)
     * 
     * @param string $message Error message
     * @param int $retryAfter Retry after seconds
     * @param array $rateLimitHeaders Additional rate limit headers
     * @return array Error response
     */
    public function rateLimitError(string $message = 'Rate limit exceeded', int $retryAfter = 60, array $rateLimitHeaders = []): array
    {
        $this->logError('Rate Limit Error', $message, 429);
        
        $headers = array_merge([
            'Content-Type' => 'application/json',
            'Retry-After' => (string)$retryAfter
        ], $rateLimitHeaders);

        return [
            'status' => 429,
            'headers' => $headers,
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'rate_limit_error',
                    'code' => 'rate_limit_exceeded'
                ]
            ])
        ];
    }

    /**
     * Format validation error (400)
     * 
     * @param string $message Error message
     * @param int $status HTTP status code (default 400)
     * @param array $details Additional error details
     * @return array Error response
     */
    public function validationError(string $message = 'Invalid request', int $status = 400, array $details = []): array
    {
        $this->logError('Validation Error', $message, $status);
        
        $errorBody = [
            'error' => [
                'message' => $message,
                'type' => 'invalid_request_error',
                'code' => 'invalid_request'
            ]
        ];

        if (!empty($details)) {
            $errorBody['error']['details'] = $details;
        }

        return [
            'status' => $status,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode($errorBody)
        ];
    }

    /**
     * Format billing error (402)
     * 
     * @param string $message Error message
     * @param array $billingDetails Billing information
     * @return array Error response
     */
    public function billingError(string $message = 'Payment required', array $billingDetails = []): array
    {
        $this->logError('Billing Error', $message, 402);
        
        $errorBody = [
            'error' => [
                'message' => $message,
                'type' => 'billing_error',
                'code' => 'payment_required'
            ]
        ];

        if (!empty($billingDetails)) {
            $errorBody['error']['billing'] = $billingDetails;
        }

        return [
            'status' => 402,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode($errorBody)
        ];
    }

    /**
     * Format server error (500)
     * 
     * @param string $message Error message
     * @param \Exception|null $exception Optional exception for logging
     * @return array Error response
     */
    public function serverError(string $message = 'Internal server error', ?\Exception $exception = null): array
    {
        $logMessage = $message;
        if ($exception) {
            $logMessage .= ' - Exception: ' . $exception->getMessage();
            if ($this->config['include_trace']) {
                $logMessage .= ' - Trace: ' . $exception->getTraceAsString();
            }
        }
        
        $this->logError('Server Error', $logMessage, 500);
        
        return [
            'status' => 500,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'server_error',
                    'code' => 'internal_error'
                ]
            ])
        ];
    }

    /**
     * Format backend service error
     * 
     * @param int $status Backend HTTP status
     * @param string $response Backend response body
     * @return array Error response
     */
    public function backendError(int $status, string $response = ''): array
    {
        $this->logError('Backend Error', "Status: {$status}, Response: {$response}", $status);
        
        // Try to parse backend error response
        $backendError = json_decode($response, true);
        
        if ($backendError && isset($backendError['error'])) {
            // Backend returned structured error
            return [
                'status' => $status,
                'headers' => ['Content-Type' => 'application/json'],
                'body' => $response
            ];
        }

        // Create generic error based on status
        $message = $this->getGenericErrorMessage($status);
        $type = $this->getErrorType($status);
        $code = $this->getErrorCode($status);

        return [
            'status' => $status,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => $type,
                    'code' => $code
                ]
            ])
        ];
    }

    /**
     * Format not found error (404)
     * 
     * @param string $resource Resource that was not found
     * @return array Error response
     */
    public function notFoundError(string $resource = 'Resource'): array
    {
        $message = "{$resource} not found";
        $this->logError('Not Found Error', $message, 404);
        
        return [
            'status' => 404,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'not_found_error',
                    'code' => 'not_found'
                ]
            ])
        ];
    }

    /**
     * Format method not allowed error (405)
     * 
     * @param string $method HTTP method that was used
     * @param array $allowedMethods Allowed HTTP methods
     * @return array Error response
     */
    public function methodNotAllowedError(string $method, array $allowedMethods = []): array
    {
        $message = "Method {$method} not allowed";
        if (!empty($allowedMethods)) {
            $message .= ". Allowed methods: " . implode(', ', $allowedMethods);
        }
        
        $this->logError('Method Not Allowed Error', $message, 405);
        
        $headers = ['Content-Type' => 'application/json'];
        if (!empty($allowedMethods)) {
            $headers['Allow'] = implode(', ', $allowedMethods);
        }

        return [
            'status' => 405,
            'headers' => $headers,
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'invalid_request_error',
                    'code' => 'method_not_allowed'
                ]
            ])
        ];
    }

    /**
     * Format timeout error (408)
     * 
     * @param string $message Error message
     * @return array Error response
     */
    public function timeoutError(string $message = 'Request timeout'): array
    {
        $this->logError('Timeout Error', $message, 408);
        
        return [
            'status' => 408,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'timeout_error',
                    'code' => 'request_timeout'
                ]
            ])
        ];
    }

    /**
     * Get generic error message based on HTTP status
     * 
     * @param int $status HTTP status code
     * @return string Error message
     */
    private function getGenericErrorMessage(int $status): string
    {
        switch ($status) {
            case 400:
                return 'Bad request';
            case 401:
                return 'Unauthorized';
            case 403:
                return 'Forbidden';
            case 404:
                return 'Not found';
            case 405:
                return 'Method not allowed';
            case 408:
                return 'Request timeout';
            case 429:
                return 'Too many requests';
            case 500:
                return 'Internal server error';
            case 502:
                return 'Bad gateway';
            case 503:
                return 'Service unavailable';
            case 504:
                return 'Gateway timeout';
            default:
                return $this->config['default_error_message'];
        }
    }

    /**
     * Get error type based on HTTP status
     * 
     * @param int $status HTTP status code
     * @return string Error type
     */
    private function getErrorType(int $status): string
    {
        switch ($status) {
            case 400:
            case 405:
                return 'invalid_request_error';
            case 401:
            case 403:
                return 'authentication_error';
            case 404:
                return 'not_found_error';
            case 408:
                return 'timeout_error';
            case 429:
                return 'rate_limit_error';
            case 500:
            case 502:
            case 503:
            case 504:
            default:
                return 'server_error';
        }
    }

    /**
     * Get error code based on HTTP status
     * 
     * @param int $status HTTP status code
     * @return string Error code
     */
    private function getErrorCode(int $status): string
    {
        switch ($status) {
            case 400:
                return 'invalid_request';
            case 401:
                return 'invalid_authorization';
            case 403:
                return 'forbidden';
            case 404:
                return 'not_found';
            case 405:
                return 'method_not_allowed';
            case 408:
                return 'request_timeout';
            case 429:
                return 'rate_limit_exceeded';
            case 500:
                return 'internal_error';
            case 502:
                return 'bad_gateway';
            case 503:
                return 'service_unavailable';
            case 504:
                return 'gateway_timeout';
            default:
                return 'unknown_error';
        }
    }

    /**
     * Log error message
     * 
     * @param string $type Error type
     * @param string $message Error message
     * @param int $status HTTP status code
     */
    private function logError(string $type, string $message, int $status): void
    {
        if ($this->config['log_errors']) {
            $logMessage = "[{$type}] Status: {$status} - {$message}";
            error_log('[ErrorHelper] ' . $logMessage);
        }
    }
}
