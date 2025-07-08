<?php

namespace App\Middleware;

use PDO;
use PDOException;

/**
 * Authentication Middleware
 * 
 * Validates LA_COOKIE and CF_CLEARANCE tokens from incoming requests
 * and sets user context for downstream processing.
 */
class AuthMiddleware
{
    private PDO $db;
    private array $config;

    public function __construct(PDO $db, array $config = [])
    {
        $this->db = $db;
        $this->config = array_merge([
            'cookie_required' => true,
            'log_failures' => true,
            'session_timeout' => 3600, // 1 hour
        ], $config);
    }

    /**
     * Main middleware handler
     * 
     * @param array $request Request data including headers
     * @param callable $next Next middleware in chain
     * @return array Response data
     */
    public function handle(array $request, callable $next): array
    {
        try {
            // Extract cookies from request headers
            $cookies = $this->extractCookies($request);
            
            if (!$this->validateCookies($cookies)) {
                return $this->unauthorizedResponse('Invalid or missing authentication cookies');
            }

            // Get user from cookies
            $user = $this->extractUserFromCookies($cookies);
            
            if (!$user) {
                return $this->unauthorizedResponse('User not found or inactive');
            }

            // Set user context in request
            $request['user'] = $user;
            $request['user_id'] = $user['id'];

            // Continue to next middleware
            return $next($request);

        } catch (PDOException $e) {
            $this->logError('Database error in authentication: ' . $e->getMessage());
            return $this->serverErrorResponse('Authentication service unavailable');
        } catch (\Exception $e) {
            $this->logError('Authentication error: ' . $e->getMessage());
            return $this->serverErrorResponse('Authentication failed');
        }
    }

    /**
     * Extract cookies from request headers
     * 
     * @param array $request Request data
     * @return array Extracted cookies
     */
    private function extractCookies(array $request): array
    {
        $cookies = [
            'la_cookie' => null,
            'cf_clearance' => null
        ];

        // Check for cookies in headers
        if (isset($request['headers']['Cookie'])) {
            $cookieHeader = $request['headers']['Cookie'];
            
            // Parse LA_COOKIE
            if (preg_match('/LA_COOKIE=([^;]+)/', $cookieHeader, $matches)) {
                $cookies['la_cookie'] = trim($matches[1]);
            }
            
            // Parse CF_CLEARANCE
            if (preg_match('/CF_CLEARANCE=([^;]+)/', $cookieHeader, $matches)) {
                $cookies['cf_clearance'] = trim($matches[1]);
            }
        }

        // Also check for direct header values (for API clients)
        if (isset($request['headers']['X-LA-Cookie'])) {
            $cookies['la_cookie'] = $request['headers']['X-LA-Cookie'];
        }
        
        if (isset($request['headers']['X-CF-Clearance'])) {
            $cookies['cf_clearance'] = $request['headers']['X-CF-Clearance'];
        }

        return $cookies;
    }

    /**
     * Validate cookie presence and format
     * 
     * @param array $cookies Extracted cookies
     * @return bool True if cookies are valid
     */
    private function validateCookies(array $cookies): bool
    {
        if (!$this->config['cookie_required']) {
            return true;
        }

        // Check if both required cookies are present
        if (empty($cookies['la_cookie']) || empty($cookies['cf_clearance'])) {
            $this->logFailure('Missing required cookies', $cookies);
            return false;
        }

        // Basic format validation
        if (strlen($cookies['la_cookie']) < 10 || strlen($cookies['cf_clearance']) < 10) {
            $this->logFailure('Invalid cookie format', $cookies);
            return false;
        }

        return true;
    }

    /**
     * Extract user from database using cookies
     * 
     * @param array $cookies Validated cookies
     * @return array|null User data or null if not found
     */
    private function extractUserFromCookies(array $cookies): ?array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT id, email, tier, status, created_at, updated_at
                FROM users 
                WHERE la_cookie = :la_cookie 
                AND cf_clearance = :cf_clearance 
                AND status = 'active'
                LIMIT 1
            ");

            $stmt->execute([
                ':la_cookie' => $cookies['la_cookie'],
                ':cf_clearance' => $cookies['cf_clearance']
            ]);

            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                // Update last access time
                $this->updateLastAccess($user['id']);
                return $user;
            }

            $this->logFailure('User not found for provided cookies', $cookies);
            return null;

        } catch (PDOException $e) {
            $this->logError('Database error in user lookup: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Update user's last access time
     * 
     * @param int $userId User ID
     */
    private function updateLastAccess(int $userId): void
    {
        try {
            $stmt = $this->db->prepare("UPDATE users SET updated_at = NOW() WHERE id = :user_id");
            $stmt->execute([':user_id' => $userId]);
        } catch (PDOException $e) {
            // Log but don't fail authentication for this
            $this->logError('Failed to update last access: ' . $e->getMessage());
        }
    }

    /**
     * Log authentication failure
     * 
     * @param string $message Failure message
     * @param array $cookies Cookie data (sanitized)
     */
    private function logFailure(string $message, array $cookies): void
    {
        if (!$this->config['log_failures']) {
            return;
        }

        $sanitizedCookies = [
            'la_cookie_length' => isset($cookies['la_cookie']) ? strlen($cookies['la_cookie']) : 0,
            'cf_clearance_length' => isset($cookies['cf_clearance']) ? strlen($cookies['cf_clearance']) : 0,
        ];

        error_log(sprintf(
            '[AuthMiddleware] %s - Cookies: %s - IP: %s - User-Agent: %s',
            $message,
            json_encode($sanitizedCookies),
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ));
    }

    /**
     * Log general errors
     * 
     * @param string $message Error message
     */
    private function logError(string $message): void
    {
        error_log('[AuthMiddleware] ' . $message);
    }

    /**
     * Return unauthorized response in OpenAI format
     * 
     * @param string $message Error message
     * @return array Response data
     */
    private function unauthorizedResponse(string $message): array
    {
        return [
            'status' => 401,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'error' => [
                    'message' => $message,
                    'type' => 'invalid_request_error',
                    'code' => 'invalid_authorization'
                ]
            ])
        ];
    }

    /**
     * Return server error response in OpenAI format
     * 
     * @param string $message Error message
     * @return array Response data
     */
    private function serverErrorResponse(string $message): array
    {
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
}
