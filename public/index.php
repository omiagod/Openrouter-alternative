<?php

/**
 * OpenRouter Alternative - Main Entry Point
 * 
 * This is the main entry point for the PHP application.
 * Handles all incoming requests and routes them through the middleware stack.
 */

// Start output buffering for better error handling
ob_start();

// Set error reporting based on environment
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    // Define application root
    define('APP_ROOT', dirname(__DIR__));
    
    // Load environment variables
    loadEnvironmentVariables();
    
    // Load configuration
    $config = require APP_ROOT . '/config/app.php';
    
    // Set PHP configuration based on app config
    configurePhp($config);
    
    // Set up autoloading
    setupAutoloading();
    
    // Initialize database connection
    $db = initializeDatabase($config['database']);
    
    // Set global variables for routes
    $GLOBALS['db'] = $db;
    $GLOBALS['config'] = $config;
    
    // Load routes
    require APP_ROOT . '/routes/web.php';
    
    // Parse request
    $request = parseRequest();
    
    // Add security headers
    addSecurityHeaders($config['security']);
    
    // Handle CORS if enabled
    if ($config['cors']['enabled']) {
        handleCors($config['cors']);
    }
    
    // Dispatch request
    $response = dispatch($request['method'], $request['path'], $request);
    
    // Send response
    sendResponse($response);

} catch (\Exception $e) {
    // Handle fatal errors
    handleFatalError($e);
} finally {
    // Clean up output buffer
    if (ob_get_level()) {
        ob_end_flush();
    }
}

/**
 * Load environment variables from .env file
 */
function loadEnvironmentVariables(): void
{
    $envFile = APP_ROOT . '/.env';
    
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            if (strpos($line, '#') === 0) {
                continue; // Skip comments
            }
            
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                
                // Remove quotes if present
                if (preg_match('/^(["\'])(.*)\\1$/', $value, $matches)) {
                    $value = $matches[2];
                }
                
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }
    }
}

/**
 * Configure PHP settings based on application config
 * 
 * @param array $config Application configuration
 */
function configurePhp(array $config): void
{
    // Set timezone
    if (isset($config['app']['timezone'])) {
        date_default_timezone_set($config['app']['timezone']);
    }
    
    // Configure error handling
    if (isset($config['error_handling'])) {
        $errorConfig = $config['error_handling'];
        
        ini_set('display_errors', $errorConfig['display_errors'] ? 1 : 0);
        ini_set('log_errors', $errorConfig['log_errors'] ? 1 : 0);
        
        if (isset($errorConfig['error_reporting'])) {
            error_reporting(eval("return {$errorConfig['error_reporting']};"));
        }
    }
    
    // Configure performance settings
    if (isset($config['performance'])) {
        $perfConfig = $config['performance'];
        
        if (isset($perfConfig['memory_limit'])) {
            ini_set('memory_limit', $perfConfig['memory_limit']);
        }
        
        if (isset($perfConfig['max_execution_time'])) {
            set_time_limit($perfConfig['max_execution_time']);
        }
        
        if (isset($perfConfig['max_input_vars'])) {
            ini_set('max_input_vars', $perfConfig['max_input_vars']);
        }
        
        if (isset($perfConfig['post_max_size'])) {
            ini_set('post_max_size', $perfConfig['post_max_size']);
        }
        
        if (isset($perfConfig['upload_max_filesize'])) {
            ini_set('upload_max_filesize', $perfConfig['upload_max_filesize']);
        }
    }
}

/**
 * Set up class autoloading
 */
function setupAutoloading(): void
{
    spl_autoload_register(function ($class) {
        // Convert namespace to file path
        $file = APP_ROOT . '/' . str_replace(['\\', 'App/'], ['/', ''], $class) . '.php';
        
        if (file_exists($file)) {
            require_once $file;
        }
    });
}

/**
 * Initialize database connection
 * 
 * @param array $dbConfig Database configuration
 * @return PDO Database connection
 */
function initializeDatabase(array $dbConfig): PDO
{
    $dsn = "mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['name']};charset={$dbConfig['charset']}";
    
    try {
        $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $dbConfig['options']);
        return $pdo;
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        throw new \Exception('Database connection failed');
    }
}

/**
 * Parse incoming request
 * 
 * @return array Request data
 */
function parseRequest(): array
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    
    // Parse headers
    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, 'HTTP_') === 0) {
            $headerName = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
            $headers[$headerName] = $value;
        }
    }
    
    // Add content type if not in HTTP_ headers
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers['Content-Type'] = $_SERVER['CONTENT_TYPE'];
    }
    
    // Get request body
    $body = file_get_contents('php://input');
    
    return [
        'method' => $method,
        'path' => $path,
        'headers' => $headers,
        'body' => $body,
        'query' => $_GET,
        'server' => $_SERVER
    ];
}

/**
 * Add security headers
 * 
 * @param array $securityConfig Security configuration
 */
function addSecurityHeaders(array $securityConfig): void
{
    if ($securityConfig['https_only'] && (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on')) {
        header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'], true, 301);
        exit;
    }
    
    header('X-Content-Type-Options: ' . $securityConfig['x_content_type_options']);
    header('X-Frame-Options: ' . $securityConfig['x_frame_options']);
    header('Referrer-Policy: ' . $securityConfig['referrer_policy']);
    
    if ($securityConfig['https_only']) {
        header('Strict-Transport-Security: max-age=' . $securityConfig['hsts_max_age'] . '; includeSubDomains');
    }
    
    if (isset($securityConfig['content_security_policy'])) {
        header('Content-Security-Policy: ' . $securityConfig['content_security_policy']);
    }
}

/**
 * Handle CORS headers
 * 
 * @param array $corsConfig CORS configuration
 */
function handleCors(array $corsConfig): void
{
    header('Access-Control-Allow-Origin: ' . $corsConfig['origins']);
    header('Access-Control-Allow-Methods: ' . $corsConfig['methods']);
    header('Access-Control-Allow-Headers: ' . $corsConfig['headers']);
    header('Access-Control-Max-Age: ' . $corsConfig['max_age']);
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

/**
 * Send HTTP response
 * 
 * @param array $response Response data
 */
function sendResponse(array $response): void
{
    // Set status code
    http_response_code($response['status'] ?? 200);
    
    // Set headers
    if (isset($response['headers'])) {
        foreach ($response['headers'] as $name => $value) {
            header("$name: $value");
        }
    }
    
    // Send body
    if (isset($response['body'])) {
        echo $response['body'];
    }
}

/**
 * Handle fatal errors
 * 
 * @param \Exception $e Exception
 */
function handleFatalError(\Exception $e): void
{
    error_log('Fatal error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    
    // Clean any existing output
    if (ob_get_level()) {
        ob_clean();
    }
    
    http_response_code(500);
    header('Content-Type: application/json');
    
    echo json_encode([
        'error' => [
            'message' => 'Internal server error',
            'type' => 'server_error',
            'code' => 'internal_error'
        ]
    ]);
}
