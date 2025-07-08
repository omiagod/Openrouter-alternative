<?php

namespace App\Helpers;

/**
 * JSON Helper
 * 
 * Provides safe JSON encoding/decoding, validation, and error handling
 * with memory-efficient operations for shared hosting environments.
 */
class JsonHelper
{
    private array $config;

    public function __construct(array $config = [])
    {
        $this->config = array_merge([
            'max_depth' => 512,
            'options' => JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
            'memory_limit' => 50 * 1024 * 1024, // 50MB
            'log_errors' => true
        ], $config);
    }

    /**
     * Safely encode data to JSON
     * 
     * @param mixed $data Data to encode
     * @param int|null $options JSON options (optional)
     * @return string|null JSON string or null on failure
     */
    public function safeEncode($data, ?int $options = null): ?string
    {
        try {
            // Check memory usage
            if ($this->isMemoryLimitExceeded()) {
                $this->logError('Memory limit exceeded during JSON encoding');
                return null;
            }

            $options = $options ?? $this->config['options'];
            
            $json = json_encode($data, $options, $this->config['max_depth']);
            
            if ($json === false) {
                $this->logError('JSON encoding failed: ' . json_last_error_msg());
                return null;
            }

            return $json;

        } catch (\Exception $e) {
            $this->logError('Exception during JSON encoding: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Safely decode JSON string
     * 
     * @param string $json JSON string
     * @param bool $associative Return associative array instead of object
     * @return mixed|null Decoded data or null on failure
     */
    public function safeDecode(string $json, bool $associative = true)
    {
        try {
            // Check memory usage
            if ($this->isMemoryLimitExceeded()) {
                $this->logError('Memory limit exceeded during JSON decoding');
                return null;
            }

            // Basic validation
            if (empty($json) || !is_string($json)) {
                return null;
            }

            $data = json_decode($json, $associative, $this->config['max_depth']);
            
            if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
                $this->logError('JSON decoding failed: ' . json_last_error_msg());
                return null;
            }

            return $data;

        } catch (\Exception $e) {
            $this->logError('Exception during JSON decoding: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Validate JSON structure against expected schema
     * 
     * @param mixed $data Decoded JSON data
     * @param array $schema Expected schema
     * @return array Validation result with success status and errors
     */
    public function validateJsonStructure($data, array $schema): array
    {
        $errors = [];
        
        try {
            $this->validateRecursive($data, $schema, '', $errors);
            
            return [
                'valid' => empty($errors),
                'errors' => $errors
            ];

        } catch (\Exception $e) {
            return [
                'valid' => false,
                'errors' => ['Validation exception: ' . $e->getMessage()]
            ];
        }
    }

    /**
     * Format API response in consistent structure
     * 
     * @param mixed $data Response data
     * @param int $status HTTP status code
     * @param string|null $message Optional message
     * @return array Formatted response
     */
    public function formatApiResponse($data, int $status = 200, ?string $message = null): array
    {
        $response = [
            'status' => $status,
            'headers' => ['Content-Type' => 'application/json']
        ];

        if ($status >= 200 && $status < 300) {
            // Success response
            $responseBody = is_array($data) ? $data : ['data' => $data];
            if ($message) {
                $responseBody['message'] = $message;
            }
        } else {
            // Error response
            $responseBody = [
                'error' => [
                    'message' => $message ?? 'An error occurred',
                    'type' => $this->getErrorType($status),
                    'code' => $this->getErrorCode($status)
                ]
            ];
            if ($data) {
                $responseBody['error']['details'] = $data;
            }
        }

        $response['body'] = $this->safeEncode($responseBody);
        return $response;
    }

    /**
     * Format OpenAI-compatible error response
     * 
     * @param string $message Error message
     * @param string $type Error type
     * @param string $code Error code
     * @param int $status HTTP status code
     * @return array Formatted error response
     */
    public function formatOpenAIError(string $message, string $type = 'server_error', string $code = 'internal_error', int $status = 500): array
    {
        return [
            'status' => $status,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => $this->safeEncode([
                'error' => [
                    'message' => $message,
                    'type' => $type,
                    'code' => $code
                ]
            ])
        ];
    }

    /**
     * Validate data recursively against schema
     * 
     * @param mixed $data Data to validate
     * @param array $schema Schema definition
     * @param string $path Current path for error reporting
     * @param array &$errors Error collection
     */
    private function validateRecursive($data, array $schema, string $path, array &$errors): void
    {
        foreach ($schema as $key => $rules) {
            $currentPath = $path ? "{$path}.{$key}" : $key;
            
            // Check if required field exists
            if (isset($rules['required']) && $rules['required'] && !isset($data[$key])) {
                $errors[] = "Required field missing: {$currentPath}";
                continue;
            }

            // Skip validation if field is not present and not required
            if (!isset($data[$key])) {
                continue;
            }

            $value = $data[$key];

            // Type validation
            if (isset($rules['type'])) {
                if (!$this->validateType($value, $rules['type'])) {
                    $errors[] = "Invalid type for {$currentPath}: expected {$rules['type']}";
                    continue;
                }
            }

            // Array validation
            if (isset($rules['items']) && is_array($value)) {
                foreach ($value as $index => $item) {
                    $this->validateRecursive($item, $rules['items'], "{$currentPath}[{$index}]", $errors);
                }
            }

            // Object validation
            if (isset($rules['properties']) && is_array($value)) {
                $this->validateRecursive($value, $rules['properties'], $currentPath, $errors);
            }

            // Custom validation
            if (isset($rules['validate']) && is_callable($rules['validate'])) {
                $result = $rules['validate']($value);
                if ($result !== true) {
                    $errors[] = "Validation failed for {$currentPath}: {$result}";
                }
            }
        }
    }

    /**
     * Validate value type
     * 
     * @param mixed $value Value to validate
     * @param string $expectedType Expected type
     * @return bool True if type matches
     */
    private function validateType($value, string $expectedType): bool
    {
        switch ($expectedType) {
            case 'string':
                return is_string($value);
            case 'integer':
            case 'int':
                return is_int($value);
            case 'float':
            case 'double':
                return is_float($value);
            case 'boolean':
            case 'bool':
                return is_bool($value);
            case 'array':
                return is_array($value);
            case 'object':
                return is_object($value) || (is_array($value) && !array_is_list($value));
            case 'null':
                return is_null($value);
            default:
                return true; // Unknown type, assume valid
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
                return 'invalid_request_error';
            case 401:
            case 403:
                return 'authentication_error';
            case 404:
                return 'not_found_error';
            case 429:
                return 'rate_limit_error';
            case 500:
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
            case 429:
                return 'rate_limit_exceeded';
            case 500:
            default:
                return 'internal_error';
        }
    }

    /**
     * Check if memory limit is being approached
     * 
     * @return bool True if memory limit is exceeded
     */
    private function isMemoryLimitExceeded(): bool
    {
        $currentUsage = memory_get_usage(true);
        return $currentUsage > $this->config['memory_limit'];
    }

    /**
     * Log error message
     * 
     * @param string $message Error message
     */
    private function logError(string $message): void
    {
        if ($this->config['log_errors']) {
            error_log('[JsonHelper] ' . $message);
        }
    }
}
