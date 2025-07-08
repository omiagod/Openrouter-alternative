<?php

namespace App\Services;

use PDO;
use PDOException;
use DateTime;

/**
 * Usage Service
 * 
 * Tracks API usage for rate limiting and analytics.
 * Manages usage statistics and provides analytics data.
 */
class UsageService
{
    private PDO $db;
    private array $config;

    public function __construct(PDO $db, array $config = [])
    {
        $this->db = $db;
        $this->config = array_merge([
            'window_size' => 60, // seconds
            'cleanup_interval' => 3600, // 1 hour
            'analytics_retention' => 30 // days
        ], $config);
    }

    /**
     * Track API request for rate limiting
     * 
     * @param int $userId User ID
     * @param string $tier User tier
     * @param int $tokens Token count (optional)
     * @return bool Success status
     */
    public function trackRequest(int $userId, string $tier, int $tokens = 0): bool
    {
        try {
            $windowStart = $this->getCurrentWindowStart();
            $limits = $this->getTierLimits($tier);

            $this->db->beginTransaction();

            // Insert or update rate limit record
            $stmt = $this->db->prepare("
                INSERT INTO rate_limits 
                (user_id, window_start, window_type, request_count, token_count, request_limit, token_limit)
                VALUES (:user_id, :window_start, 'minute', 1, :tokens, :request_limit, :token_limit)
                ON DUPLICATE KEY UPDATE
                    request_count = request_count + 1,
                    token_count = token_count + :tokens,
                    updated_at = NOW()
            ");

            $result = $stmt->execute([
                ':user_id' => $userId,
                ':window_start' => $windowStart,
                ':tokens' => $tokens,
                ':request_limit' => $limits['requests'],
                ':token_limit' => $limits['tokens']
            ]);

            $this->db->commit();
            return $result;

        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log('[UsageService] Error tracking request: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get user usage within time window
     * 
     * @param int $userId User ID
     * @param string $windowType Window type (minute, hour, day)
     * @return array Usage data
     */
    public function getUserUsage(int $userId, string $windowType = 'minute'): array
    {
        try {
            $windowStart = $this->getWindowStart($windowType);

            $stmt = $this->db->prepare("
                SELECT request_count, token_count, request_limit, token_limit, updated_at
                FROM rate_limits 
                WHERE user_id = :user_id 
                AND window_start = :window_start 
                AND window_type = :window_type
                LIMIT 1
            ");

            $stmt->execute([
                ':user_id' => $userId,
                ':window_start' => $windowStart,
                ':window_type' => $windowType
            ]);

            $usage = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$usage) {
                return [
                    'request_count' => 0,
                    'token_count' => 0,
                    'request_limit' => 0,
                    'token_limit' => 0,
                    'window_start' => $windowStart,
                    'window_type' => $windowType
                ];
            }

            return array_merge($usage, [
                'window_start' => $windowStart,
                'window_type' => $windowType
            ]);

        } catch (PDOException $e) {
            error_log('[UsageService] Error getting user usage: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Check if user can make additional requests
     * 
     * @param int $userId User ID
     * @param string $tier User tier
     * @return array Rate limit status
     */
    public function checkRateLimit(int $userId, string $tier): array
    {
        $usage = $this->getUserUsage($userId, 'minute');
        $limits = $this->getTierLimits($tier);

        $requestsRemaining = max(0, $limits['requests'] - ($usage['request_count'] ?? 0));
        $tokensRemaining = max(0, $limits['tokens'] - ($usage['token_count'] ?? 0));

        return [
            'allowed' => $requestsRemaining > 0,
            'requests_remaining' => $requestsRemaining,
            'tokens_remaining' => $tokensRemaining,
            'request_limit' => $limits['requests'],
            'token_limit' => $limits['tokens'],
            'reset_time' => strtotime($usage['window_start'] ?? 'now') + $this->config['window_size']
        ];
    }

    /**
     * Clean up expired rate limit windows
     * 
     * @return int Number of records cleaned up
     */
    public function cleanupExpiredWindows(): int
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
                error_log("[UsageService] Cleaned up {$deleted} expired rate limit windows");
            }

            return $deleted;

        } catch (PDOException $e) {
            error_log('[UsageService] Error during cleanup: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get usage statistics for analytics
     * 
     * @param array $options Query options
     * @return array Usage statistics
     */
    public function getUsageStats(array $options = []): array
    {
        try {
            $options = array_merge([
                'period' => 'day',
                'user_id' => null,
                'model' => null,
                'limit' => 100
            ], $options);

            $whereConditions = [];
            $params = [];

            // Date condition
            $dateCondition = $this->getDateConditionForPeriod($options['period']);
            $whereConditions[] = $dateCondition;

            // User filter
            if ($options['user_id']) {
                $whereConditions[] = 'user_id = :user_id';
                $params[':user_id'] = $options['user_id'];
            }

            // Model filter
            if ($options['model']) {
                $whereConditions[] = 'model = :model';
                $params[':model'] = $options['model'];
            }

            $whereClause = implode(' AND ', $whereConditions);

            // Get overall statistics
            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT model) as unique_models,
                    SUM(total_tokens) as total_tokens,
                    SUM(cost) as total_cost,
                    AVG(total_tokens) as avg_tokens_per_request
                FROM usage_logs 
                WHERE {$whereClause}
            ");

            $stmt->execute($params);
            $overall = $stmt->fetch(PDO::FETCH_ASSOC);

            // Get top models
            $stmt = $this->db->prepare("
                SELECT 
                    model,
                    COUNT(*) as requests,
                    SUM(total_tokens) as tokens,
                    SUM(cost) as cost
                FROM usage_logs 
                WHERE {$whereClause}
                GROUP BY model
                ORDER BY requests DESC
                LIMIT 10
            ");

            $stmt->execute($params);
            $topModels = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Get top users (if not filtering by user)
            $topUsers = [];
            if (!$options['user_id']) {
                $stmt = $this->db->prepare("
                    SELECT 
                        ul.user_id,
                        u.email,
                        u.tier,
                        COUNT(*) as requests,
                        SUM(ul.total_tokens) as tokens,
                        SUM(ul.cost) as cost
                    FROM usage_logs ul
                    JOIN users u ON ul.user_id = u.id
                    WHERE {$whereClause}
                    GROUP BY ul.user_id, u.email, u.tier
                    ORDER BY requests DESC
                    LIMIT 10
                ");

                $stmt->execute($params);
                $topUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            return [
                'overall' => $overall,
                'top_models' => $topModels,
                'top_users' => $topUsers,
                'period' => $options['period']
            ];

        } catch (PDOException $e) {
            error_log('[UsageService] Error getting usage stats: ' . $e->getMessage());
            return [
                'overall' => null,
                'top_models' => [],
                'top_users' => [],
                'period' => $options['period']
            ];
        }
    }

    /**
     * Update rate limits for a user
     * 
     * @param int $userId User ID
     * @param array $limits New limits
     * @return bool Success status
     */
    public function updateRateLimits(int $userId, array $limits): bool
    {
        try {
            // This would typically update a user_limits table
            // For now, we'll just log the change
            error_log("[UsageService] Rate limits updated for user {$userId}: " . json_encode($limits));
            return true;

        } catch (\Exception $e) {
            error_log('[UsageService] Error updating rate limits: ' . $e->getMessage());
            return false;
        }
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
            'requests' => 60,
            'tokens' => 100000
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
     * @param string $windowType Window type
     * @return string Window start timestamp
     */
    private function getWindowStart(string $windowType): string
    {
        $now = time();
        
        switch ($windowType) {
            case 'hour':
                $windowSize = 3600; // 1 hour
                break;
            case 'day':
                $windowSize = 86400; // 1 day
                break;
            case 'minute':
            default:
                $windowSize = $this->config['window_size'];
                break;
        }
        
        $windowStart = floor($now / $windowSize) * $windowSize;
        return date('Y-m-d H:i:s', $windowStart);
    }

    /**
     * Get current minute window start time
     * 
     * @return string Window start timestamp
     */
    private function getCurrentWindowStart(): string
    {
        return $this->getWindowStart('minute');
    }

    /**
     * Get date condition for period
     * 
     * @param string $period Period (day, week, month, year)
     * @return string SQL date condition
     */
    private function getDateConditionForPeriod(string $period): string
    {
        switch ($period) {
            case 'hour':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)";
            case 'day':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
            case 'week':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
            case 'month':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
            case 'year':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
            default:
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
        }
    }
}
