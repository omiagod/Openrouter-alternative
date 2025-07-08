<?php

/**
 * Application Configuration
 * 
 * Main configuration file with all necessary settings for the AI API provider service.
 * Uses environment variables for sensitive data and provides sensible defaults.
 */

return [
    // Application settings
    'app' => [
        'name' => 'OpenRouter Alternative',
        'version' => '1.0.0',
        'debug' => (bool)($_ENV['DEBUG'] ?? false),
        'timezone' => $_ENV['TIMEZONE'] ?? 'UTC',
        'url' => $_ENV['APP_URL'] ?? 'https://localhost',
    ],

    // Database configuration
    'database' => [
        'host' => $_ENV['DB_HOST'] ?? 'localhost',
        'port' => $_ENV['DB_PORT'] ?? 3306,
        'name' => $_ENV['DB_NAME'] ?? 'ai_api_provider',
        'username' => $_ENV['DB_USER'] ?? 'root',
        'password' => $_ENV['DB_PASS'] ?? '',
        'charset' => $_ENV['DB_CHARSET'] ?? 'utf8mb4',
        'collation' => $_ENV['DB_COLLATION'] ?? 'utf8mb4_unicode_ci',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
        ]
    ],

    // Backend service configuration (Python lmarena2api)
    'backend' => [
        'url' => $_ENV['PYTHON_SERVICE_URL'] ?? 'http://localhost:8000',
        'timeout' => (int)($_ENV['PYTHON_SERVICE_TIMEOUT'] ?? 30),
        'connect_timeout' => (int)($_ENV['PYTHON_CONNECT_TIMEOUT'] ?? 10),
        'max_retries' => (int)($_ENV['PYTHON_MAX_RETRIES'] ?? 3),
        'retry_delay' => (int)($_ENV['PYTHON_RETRY_DELAY'] ?? 1),
        'user_agent' => $_ENV['PYTHON_USER_AGENT'] ?? 'OpenRouter-Alternative-Proxy/1.0'
    ],

    // Authentication settings
    'auth' => [
        'cookie_required' => (bool)($_ENV['COOKIE_REQUIRED'] ?? true),
        'log_failures' => (bool)($_ENV['AUTH_LOG_FAILURES'] ?? true),
        'session_timeout' => (int)($_ENV['SESSION_TIMEOUT'] ?? 3600), // 1 hour
        'cookie_domain' => $_ENV['COOKIE_DOMAIN'] ?? '',
        'cookie_secure' => (bool)($_ENV['COOKIE_SECURE'] ?? true),
        'cookie_httponly' => (bool)($_ENV['COOKIE_HTTPONLY'] ?? true),
    ],

    // Rate limiting configuration
    'rate_limit' => [
        'default_request_limit' => (int)($_ENV['DEFAULT_RATE_LIMIT_REQUESTS'] ?? 60),
        'default_token_limit' => (int)($_ENV['DEFAULT_RATE_LIMIT_TOKENS'] ?? 100000),
        'window_size' => (int)($_ENV['RATE_LIMIT_WINDOW'] ?? 60), // seconds
        'cleanup_probability' => (float)($_ENV['RATE_LIMIT_CLEANUP_PROB'] ?? 0.01), // 1%
        'tier_multipliers' => [
            'free' => 1,
            'premium' => 5,
            'enterprise' => 20
        ]
    ],

    // Billing configuration
    'billing' => [
        'enabled' => (bool)($_ENV['BILLING_ENABLED'] ?? true),
        'default_currency' => $_ENV['DEFAULT_CURRENCY'] ?? 'USD',
        'default_price_per_1k' => (float)($_ENV['DEFAULT_PRICE_PER_1K'] ?? 0.001),
        'batch_size' => (int)($_ENV['BILLING_BATCH_SIZE'] ?? 100),
        'log_errors' => (bool)($_ENV['BILLING_LOG_ERRORS'] ?? true),
        'tier_multipliers' => [
            'free' => 1.00,
            'premium' => 0.80,
            'enterprise' => 0.60
        ]
    ],

    // Logging configuration
    'logging' => [
        'level' => $_ENV['LOG_LEVEL'] ?? 'error',
        'file' => $_ENV['LOG_FILE'] ?? 'php://stderr',
        'max_size' => $_ENV['LOG_MAX_SIZE'] ?? '10M',
        'rotate' => (bool)($_ENV['LOG_ROTATE'] ?? true),
        'format' => $_ENV['LOG_FORMAT'] ?? '[%datetime%] %level_name%: %message% %context%'
    ],

    // Security settings
    'security' => [
        'https_only' => (bool)($_ENV['HTTPS_ONLY'] ?? true),
        'hsts_max_age' => (int)($_ENV['HSTS_MAX_AGE'] ?? 31536000), // 1 year
        'content_security_policy' => $_ENV['CSP'] ?? "default-src 'self'",
        'x_frame_options' => $_ENV['X_FRAME_OPTIONS'] ?? 'DENY',
        'x_content_type_options' => $_ENV['X_CONTENT_TYPE_OPTIONS'] ?? 'nosniff',
        'referrer_policy' => $_ENV['REFERRER_POLICY'] ?? 'strict-origin-when-cross-origin'
    ],

    // CORS configuration
    'cors' => [
        'enabled' => (bool)($_ENV['CORS_ENABLED'] ?? true),
        'origins' => $_ENV['CORS_ORIGINS'] ?? '*',
        'methods' => $_ENV['CORS_METHODS'] ?? 'GET,POST,OPTIONS',
        'headers' => $_ENV['CORS_HEADERS'] ?? 'Content-Type,Authorization,X-LA-Cookie,X-CF-Clearance',
        'max_age' => (int)($_ENV['CORS_MAX_AGE'] ?? 86400) // 24 hours
    ],

    // Models configuration
    'models' => [
        'cache_ttl' => (int)($_ENV['MODELS_CACHE_TTL'] ?? 300), // 5 minutes
        'fallback_models' => [
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
        ]
    ],

    // Performance settings
    'performance' => [
        'memory_limit' => $_ENV['MEMORY_LIMIT'] ?? '128M',
        'max_execution_time' => (int)($_ENV['MAX_EXECUTION_TIME'] ?? 30),
        'max_input_vars' => (int)($_ENV['MAX_INPUT_VARS'] ?? 1000),
        'post_max_size' => $_ENV['POST_MAX_SIZE'] ?? '8M',
        'upload_max_filesize' => $_ENV['UPLOAD_MAX_FILESIZE'] ?? '2M'
    ],

    // Error handling
    'error_handling' => [
        'display_errors' => (bool)($_ENV['DISPLAY_ERRORS'] ?? false),
        'log_errors' => (bool)($_ENV['LOG_ERRORS'] ?? true),
        'error_reporting' => $_ENV['ERROR_REPORTING'] ?? 'E_ALL & ~E_NOTICE',
        'include_trace' => (bool)($_ENV['INCLUDE_TRACE'] ?? false),
        'default_error_message' => $_ENV['DEFAULT_ERROR_MESSAGE'] ?? 'An unexpected error occurred'
    ],

    // JSON handling
    'json' => [
        'max_depth' => (int)($_ENV['JSON_MAX_DEPTH'] ?? 512),
        'options' => JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        'memory_limit' => (int)($_ENV['JSON_MEMORY_LIMIT'] ?? 50 * 1024 * 1024), // 50MB
        'log_errors' => (bool)($_ENV['JSON_LOG_ERRORS'] ?? true)
    ],

    // Route configuration
    'routing' => [
        'prefix' => $_ENV['ROUTE_PREFIX'] ?? '',
        'case_sensitive' => (bool)($_ENV['ROUTE_CASE_SENSITIVE'] ?? false),
        'trailing_slash' => (bool)($_ENV['ROUTE_TRAILING_SLASH'] ?? false)
    ],

    // Cache configuration
    'cache' => [
        'enabled' => (bool)($_ENV['CACHE_ENABLED'] ?? true),
        'driver' => $_ENV['CACHE_DRIVER'] ?? 'file',
        'ttl' => (int)($_ENV['CACHE_TTL'] ?? 300), // 5 minutes
        'prefix' => $_ENV['CACHE_PREFIX'] ?? 'openrouter_alt_'
    ],

    // Monitoring and analytics
    'monitoring' => [
        'enabled' => (bool)($_ENV['MONITORING_ENABLED'] ?? true),
        'sample_rate' => (float)($_ENV['MONITORING_SAMPLE_RATE'] ?? 1.0),
        'track_performance' => (bool)($_ENV['TRACK_PERFORMANCE'] ?? true),
        'track_errors' => (bool)($_ENV['TRACK_ERRORS'] ?? true)
    ]
];
