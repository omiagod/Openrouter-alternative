<?php

namespace App\Middleware;

use PDO;
use PDOException;
use DateTime;

/**
 * Rate Limiting Middleware
 * 
 * Enforces per-user request limits using MySQL-based counters
 * with sliding window rate limiting.
 */
class RateLimitMiddleware
{
    private PDO $db;
    private array $config;

    public function __construct(PDO $db, array $config = [])
    {
        $this->db = $db;
        $this->config = array_merge([
            'default_request_limit' => 60,
            'default_token_limit' => 100000,
            'window_size' => 60, // seconds
            'cleanup_probability' => 0.01, // 1% chance to run cleanup
        ], $config);
    }

    /**
     * Main middleware handler
     * 
     * @param array $request Request data including user context
     * @param callable $next Next middleware in chain
     * @return array Response data
     */
    public function handle(array $request, callable $next): array
    {
        try {
            // User should be set by AuthMiddleware
            if (!isset($request['user_id'])) {
                return $this->serverErrorResponse('User context not found');
            }

            $userId = $request['user_id'];
            $user = $request['user'];

            // Check rate limits
            $rateLimitResult = $this->checkRateLimit($userId, $user['tier']);
            
            if (!$rateLimitResult['allowed']) {
                return $this->rateLimitResponse($rateLimitResult);
            }

            // Increment request counter
            $this->incrementRequestCount($userId, $user['tier']);

            // Continue to next middleware
            $response = $next($request);

            // Add rate limit headers to response
            $response['headers'] = array_merge(
                $response['headers'] ?? [],
                $this->getRateLimitHeaders($rateLimitResult)
            );

            // Randomly run cleanup
            if (mt_rand() / mt_getrandmax() < $this->config['cleanup_probability']) {
                $this->cleanupExpiredWindows();
            }

            return $response;

        } catch (PDOException $e) {
            error_log('[RateLimitMiddleware] Database error: ' . $e->getMessage());
            return $this->serverErrorResponse('Rate limiting service unavailable');
        } catch (\Exception $e) {
            error_log('[RateLimitMiddleware] Error: ' . $e->getMessage());
            return $this->serverErrorResponse('Rate limiting failed');
        }
    }

    /**
     * Check if user can make a request within rate limits
     * 
     * @param int $userId User ID
     * @param string $tier User tier (free, premium, enterprise)
     * @return array Rate limit status and metadata
     */
    private function checkRateLimit(int $userId, string $tier): array
    {
        $limits = $this->getTierLimits($tier);
        $windowStart = $this->getCurrentWindowStart();

        try {
            // Get or create current window record
            $stmt = $this->db->prepare("
                SELECT request_count, token_count, request_limit, token_limit
                FROM rate_limits 
                WHERE user_id = :user_id 
                AND window_start = :window_start 
                AND window_type = 'minute'
            ");

            $stmt->execute([
                ':user_id' => $userId,
                ':window_start' => $windowStart
            ]);

            $current = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$current) {
                // Create new window record
                $this->createRateLimitWindow($userId, $windowStart, $limits);
                $current = [
                    'request_count' => 0,
                    'token_count' => 0,
                    'request_limit' => $limits['requests'],
                    'token_limit' => $limits['tokens']
                ];
            }

            $allowed = $current['request_count'] < $current['request_limit'];

            return [
                'allowed' => $allowed,
                'current_requests' => $current['request_count'],
                'request_limit' => $current['request_limit'],
                'current_tokens' => $current['token_count'],
                'token_limit' => $current['token_limit'],
                'window_start' => $windowStart,
                'reset_time' => strtotime($windowStart) + $this->config['window_size']
            ];

        } catch (PDOException $e) {
            error_log('[RateLimitMiddleware] Error checking rate limit: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Increment request count for current window
     * 
     * @param int $userId User ID
     * @param string $tier User tier
     */
    private function incrementRequestCount(int $userId, string $tier): void
    {
        $windowStart = $this->getCurrentWindowStart();

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("
                UPDATE rate_limits 
                SET request_count = request_count + 1, updated_at = NOW()
                WHERE user_id = :user_id 
                AND window_start = :window_start 
                AND window_type = 'minute'
            ");

            $stmt->execute([
                ':user_id' => $userId,
                ':window_start' => $windowStart
            ]);

            // If no rows were updated, create the window
            if ($stmt->rowCount() === 0) {
                $limits = $this->getTierLimits($tier);
                $this->createRateLimitWindow($userId, $windowStart, $limits);
                
                // Try increment again
                $stmt->execute([
                    ':user_id' => $userId,
                    ':window_start' => $windowStart
                ]);
            }

            $this->db->commit();

        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log('[RateLimitMiddleware] Error incrementing request count: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Create new rate limit window record
     * 
     * @param int $userId User ID
     * @param string $windowStart Window start time
     * @param array $limits Rate limits for user tier
     */
    private function createRateLimitWindow(int $userId, string $windowStart, array $limits): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO rate_limits 
            (user_id, window_start, window_type, request_count, token_count, request_limit, token_limit)
            VALUES (:user_id, :window_start, 'minute', 0, 0, :request_limit, :token_limit)
            ON DUPLICATE KEY UPDATE updated_at = NOW()
        ");

        $stmt->execute([
            ':user_id' => $userId,
            ':window_start' => $windowStart,
            ':request_limit' => $limits['requests'],
            ':token_limit' => $limits['tokens']
        ]);
    }

    /**
     * Get rate limits based on user tier
     * 
     * @param string $tier User tier
     * @return array Rate limits
     */
    private function getTierLimits(string $tier): array
    {
        $baseLimits = [
            'requests' => $this->config['default_request_limit'],
            'tokens' => $this->config['default_token_limit']
        ];

        switch ($tier) {
            case 'premium':
                return [
                    'requests' => $baseLimits['requests'] * 5,
                    'tokens' => $baseLimits['tokens'] * 5
                ];
            case 'enterprise':
                return [
                    'requests' => $baseLimits['requests'] * 20,
                    'tokens' => $baseLimits['tokens'] * 20
                ];
            case 'free':
            default:
                return $baseLimits;
        }
    }

    /**
     * Get current window start time
     * 
     * @return string Window start timestamp
     */
    private function getCurrentWindowStart(): string
    {
        $now = new DateTime();
        $seconds = $now->getTimestamp();
        $windowSeconds = $this->config['window_size'];
        
        // Round down to window boundary
        $windowStart = floor($seconds / $windowSeconds) * $windowSeconds;
        
        return date('Y-m-d H:i:s', $windowStart);
    }

    /**
     * Clean up expired rate limit windows
     */
    private function cleanupExpiredWindows(): void
    {
        try {
            $cutoff = date('Y-m-d H:i:s', time() - ($this->config['window_size'] * 2));
            
            $stmt = $this->db->prepare("
                DELETE FROM rate_limits 
                WHERE window_start < :cutoff
            ");
            
            $stmt->execute([':cutoff' => $cutoff]);
            
            $deleted = $stmt->rowCount();
            if ($deleted > 0) {
                error_log("[RateLimitMiddleware] Cleaned up {$deleted} expired rate limit windows");
            }

        } catch (PDOException $e) {
            error_log('[RateLimitMiddleware] Error during cleanup: ' . $e->getMessage());
        }
    }

    /**
     * Get rate limit headers for response
     * 
     * @param array $rateLimitResult Rate limit check result
     * @return array Headers
     */
    private function getRateLimitHeaders(array $rateLimitResult): array
    {
        return [
            'X-RateLimit-Limit-Requests' => (string)$rateLimitResult['request_limit'],
            'X-RateLimit-Remaining-Requests' => (string)max(0, $rateLimitResult['request_limit'] - $rateLimitResult['current_requests']),
            'X-RateLimit-Limit-Tokens' => (string)$rateLimitResult['token_limit'],
            'X-RateLimit-Remaining-Tokens' => (string)max(0, $rateLimitResult['token_limit'] - $rateLimitResult['current_tokens']),
            'X-RateLimit-Reset' => (string)$rateLimitResult['reset_time']
        ];
    }

    /**
     * Return rate limit exceeded response
     * 
     * @param array $rateLimitResult Rate limit check result
     * @return array Response data
     */
    private function rateLimitResponse(array $rateLimitResult): array
    {
        $retryAfter = $rateLimitResult['reset_time'] - time();
        
        return [
            'status' => 429,
            'headers' => array_merge([
                'Content-Type' => 'application/json',
                'Retry-After' => (string)max(1, $retryAfter)
            ], $this->getRateLimitHeaders($rateLimitResult)),
            'body' => json_encode([
                'error' => [
                    'message' => 'Rate limit exceeded. Try again later.',
                    'type' => 'rate_limit_error',
                    'code' => 'rate_limit_exceeded'
                ]
            ])
        ];
    }

    /**
     * Return server error response
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
