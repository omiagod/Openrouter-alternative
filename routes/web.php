<?php

/**
 * Web Routes
 * 
 * Define all OpenAI-compatible API routes with proper middleware stack.
 * Includes authentication, rate limiting, and billing middleware.
 */

use App\Controllers\ChatController;
use App\Controllers\ModelController;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Middleware\BillingMiddleware;

/**
 * Route handler function
 * 
 * @param string $method HTTP method
 * @param string $path Request path
 * @param array $request Request data
 * @return array Response data
 */
function handleRoute(string $method, string $path, array $request): array
{
    global $db, $config;
    
    try {
        // Initialize helpers and services
        $jsonHelper = new App\Helpers\JsonHelper();
        $errorHelper = new App\Helpers\ErrorHelper();
        $proxyService = new App\Services\ProxyService($jsonHelper, $errorHelper, $config['backend'] ?? []);
        
        // Initialize middleware
        $authMiddleware = new AuthMiddleware($db, $config['auth'] ?? []);
        $rateLimitMiddleware = new RateLimitMiddleware($db, $config['rate_limit'] ?? []);
        $billingMiddleware = new BillingMiddleware($db, $config['billing'] ?? []);
        
        // Initialize controllers
        $chatController = new ChatController($proxyService, $jsonHelper, $errorHelper);
        $modelController = new ModelController($proxyService, $jsonHelper, $errorHelper, $config['models'] ?? []);

        // Add method and path to request
        $request['method'] = $method;
        $request['path'] = $path;

        // Route matching
        switch (true) {
            // Health check endpoint (no authentication required)
            case $method === 'GET' && $path === '/health':
                return handleHealthCheck();

            // Models endpoint
            case $method === 'GET' && preg_match('#^/?v1/models/?$#', $path):
                return handleWithMiddleware($request, [
                    $authMiddleware,
                    $rateLimitMiddleware
                ], [$modelController, 'list']);

            // Chat completions endpoint
            case $method === 'POST' && preg_match('#^/?v1/chat/completions/?$#', $path):
                return handleWithMiddleware($request, [
                    $authMiddleware,
                    $rateLimitMiddleware,
                    $billingMiddleware
                ], [$chatController, 'completions']);

            // Images generations endpoint (future implementation)
            case $method === 'POST' && preg_match('#^/?v1/images/generations/?$#', $path):
                return $errorHelper->notFoundError('Image generation endpoint not yet implemented');

            // Default 404 for unmatched routes
            default:
                return $errorHelper->notFoundError('Endpoint');
        }

    } catch (\Exception $e) {
        error_log('[Router] Unhandled exception: ' . $e->getMessage());
        return (new App\Helpers\ErrorHelper())->serverError('Internal server error');
    }
}

/**
 * Handle request with middleware chain
 * 
 * @param array $request Request data
 * @param array $middlewares Array of middleware instances
 * @param callable $handler Final handler (controller method)
 * @return array Response data
 */
function handleWithMiddleware(array $request, array $middlewares, callable $handler): array
{
    // Create middleware chain
    $next = function($request) use ($handler) {
        return call_user_func($handler, $request);
    };

    // Apply middleware in reverse order
    foreach (array_reverse($middlewares) as $middleware) {
        $currentNext = $next;
        $next = function($request) use ($middleware, $currentNext) {
            return $middleware->handle($request, $currentNext);
        };
    }

    return $next($request);
}

/**
 * Handle health check endpoint
 * 
 * @return array Response data
 */
function handleHealthCheck(): array
{
    global $db;
    
    $status = 'ok';
    $checks = [];

    // Database check
    try {
        $stmt = $db->query('SELECT 1');
        $checks['database'] = 'ok';
    } catch (\Exception $e) {
        $checks['database'] = 'error';
        $status = 'error';
    }

    // Memory check
    $memoryUsage = memory_get_usage(true);
    $memoryLimit = ini_get('memory_limit');
    $memoryLimitBytes = convertToBytes($memoryLimit);
    
    if ($memoryLimitBytes > 0 && $memoryUsage > ($memoryLimitBytes * 0.8)) {
        $checks['memory'] = 'warning';
        if ($status === 'ok') {
            $status = 'warning';
        }
    } else {
        $checks['memory'] = 'ok';
    }

    $response = [
        'status' => $status,
        'timestamp' => date('c'),
        'version' => '1.0.0',
        'checks' => $checks
    ];

    return [
        'status' => $status === 'error' ? 503 : 200,
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode($response)
    ];
}

/**
 * Convert memory limit string to bytes
 * 
 * @param string $val Memory limit value
 * @return int Bytes
 */
function convertToBytes(string $val): int
{
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    
    switch($last) {
        case 'g':
            $val *= 1024;
        case 'm':
            $val *= 1024;
        case 'k':
            $val *= 1024;
    }
    
    return $val;
}

/**
 * CORS preflight handler
 * 
 * @return array Response data
 */
function handleCorsPrelight(): array
{
    global $config;
    
    $corsConfig = $config['cors'] ?? [];
    
    $headers = [
        'Access-Control-Allow-Origin' => $corsConfig['origins'] ?? '*',
        'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-LA-Cookie, X-CF-Clearance',
        'Access-Control-Max-Age' => '86400'
    ];

    return [
        'status' => 200,
        'headers' => $headers,
        'body' => ''
    ];
}

/**
 * Main route dispatcher
 * 
 * @param string $method HTTP method
 * @param string $path Request path
 * @param array $request Request data
 * @return array Response data
 */
function dispatch(string $method, string $path, array $request): array
{
    global $config;
    
    // Handle CORS preflight
    if ($method === 'OPTIONS') {
        return handleCorsPrelight();
    }

    // Remove route prefix if configured
    $routePrefix = $config['route_prefix'] ?? '';
    if ($routePrefix && strpos($path, $routePrefix) === 0) {
        $path = substr($path, strlen($routePrefix));
    }

    // Normalize path
    $path = '/' . trim($path, '/');

    return handleRoute($method, $path, $request);
}
