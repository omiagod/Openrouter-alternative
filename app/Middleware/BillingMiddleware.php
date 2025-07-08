<?php

namespace App\Middleware;

use PDO;
use PDOException;

/**
 * Billing Middleware
 * 
 * Tracks API usage for billing purposes after successful API calls.
 * Captures usage statistics and calculates costs based on model pricing.
 */
class BillingMiddleware
{
    private PDO $db;
    private array $config;

    public function __construct(PDO $db, array $config = [])
    {
        $this->db = $db;
        $this->config = array_merge([
            'enabled' => true,
            'default_currency' => 'USD',
            'batch_size' => 100,
            'log_errors' => true,
        ], $config);
    }

    /**
     * Main middleware handler (runs after API call)
     * 
     * @param array $request Request data including user context
     * @param callable $next Next middleware in chain
     * @return array Response data
     */
    public function handle(array $request, callable $next): array
    {
        // Execute the API call first
        $response = $next($request);

        // Only track usage for successful responses
        if (isset($response['status']) && $response['status'] === 200) {
            $this->trackUsage($request, $response);
        }

        return $response;
    }

    /**
     * Track API usage for billing
     * 
     * @param array $request Request data
     * @param array $response Response data
     */
    private function trackUsage(array $request, array $response): void
    {
        if (!$this->config['enabled']) {
            return;
        }

        try {
            // Extract usage data from response
            $usageData = $this->extractUsageData($request, $response);
            
            if ($usageData) {
                // Calculate cost
                $cost = $this->calculateCost($usageData);
                
                // Record usage
                $this->recordUsage($usageData, $cost);
                
                // Update token count in rate limiting
                $this->updateTokenCount($usageData);
            }

        } catch (\Exception $e) {
            if ($this->config['log_errors']) {
                error_log('[BillingMiddleware] Error tracking usage: ' . $e->getMessage());
            }
            // Don't fail the request if billing fails
        }
    }

    /**
     * Extract usage data from request and response
     * 
     * @param array $request Request data
     * @param array $response Response data
     * @return array|null Usage data or null if not extractable
     */
    private function extractUsageData(array $request, array $response): ?array
    {
        // Parse response body to get usage information
        $responseBody = json_decode($response['body'] ?? '{}', true);
        
        if (!$responseBody || !isset($responseBody['usage'])) {
            return null;
        }

        $usage = $responseBody['usage'];
        
        // Extract model from request
        $requestBody = json_decode($request['body'] ?? '{}', true);
        $model = $requestBody['model'] ?? 'unknown';
        
        // Determine endpoint
        $endpoint = $this->getEndpointFromRequest($request);

        return [
            'user_id' => $request['user_id'],
            'model' => $model,
            'prompt_tokens' => $usage['prompt_tokens'] ?? 0,
            'completion_tokens' => $usage['completion_tokens'] ?? 0,
            'total_tokens' => $usage['total_tokens'] ?? 0,
            'endpoint' => $endpoint,
            'request_id' => $this->generateRequestId($request),
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Calculate cost based on usage and model pricing
     * 
     * @param array $usageData Usage data
     * @return float Calculated cost
     */
    private function calculateCost(array $usageData): float
    {
        try {
            // Get user tier for pricing multiplier
            $userTier = $this->getUserTier($usageData['user_id']);
            
            // Get model pricing
            $stmt = $this->db->prepare("
                SELECT price_per_1k_tokens, tier_multiplier_free, tier_multiplier_premium, tier_multiplier_enterprise
                FROM model_pricing 
                WHERE model = :model AND active = TRUE
                LIMIT 1
            ");

            $stmt->execute([':model' => $usageData['model']]);
            $pricing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$pricing) {
                // Use default pricing if model not found
                $basePrice = 0.001; // $0.001 per 1K tokens
                $multiplier = 1.0;
            } else {
                $basePrice = (float)$pricing['price_per_1k_tokens'];
                
                // Apply tier multiplier
                switch ($userTier) {
                    case 'premium':
                        $multiplier = (float)$pricing['tier_multiplier_premium'];
                        break;
                    case 'enterprise':
                        $multiplier = (float)$pricing['tier_multiplier_enterprise'];
                        break;
                    case 'free':
                    default:
                        $multiplier = (float)$pricing['tier_multiplier_free'];
                        break;
                }
            }

            // Calculate cost: (total_tokens / 1000) * price_per_1k_tokens * tier_multiplier
            $cost = ($usageData['total_tokens'] / 1000) * $basePrice * $multiplier;
            
            return round($cost, 6); // Round to 6 decimal places

        } catch (PDOException $e) {
            error_log('[BillingMiddleware] Error calculating cost: ' . $e->getMessage());
            return 0.0;
        }
    }

    /**
     * Record usage in the database
     * 
     * @param array $usageData Usage data
     * @param float $cost Calculated cost
     */
    private function recordUsage(array $usageData, float $cost): void
    {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO usage_logs 
                (user_id, model, prompt_tokens, completion_tokens, total_tokens, cost, request_id, endpoint, timestamp)
                VALUES (:user_id, :model, :prompt_tokens, :completion_tokens, :total_tokens, :cost, :request_id, :endpoint, :timestamp)
            ");

            $stmt->execute([
                ':user_id' => $usageData['user_id'],
                ':model' => $usageData['model'],
                ':prompt_tokens' => $usageData['prompt_tokens'],
                ':completion_tokens' => $usageData['completion_tokens'],
                ':total_tokens' => $usageData['total_tokens'],
                ':cost' => $cost,
                ':request_id' => $usageData['request_id'],
                ':endpoint' => $usageData['endpoint'],
                ':timestamp' => $usageData['timestamp']
            ]);

        } catch (PDOException $e) {
            error_log('[BillingMiddleware] Error recording usage: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Update token count in rate limiting table
     * 
     * @param array $usageData Usage data
     */
    private function updateTokenCount(array $usageData): void
    {
        try {
            $windowStart = $this->getCurrentWindowStart();
            
            $stmt = $this->db->prepare("
                UPDATE rate_limits 
                SET token_count = token_count + :tokens, updated_at = NOW()
                WHERE user_id = :user_id 
                AND window_start = :window_start 
                AND window_type = 'minute'
            ");

            $stmt->execute([
                ':tokens' => $usageData['total_tokens'],
                ':user_id' => $usageData['user_id'],
                ':window_start' => $windowStart
            ]);

        } catch (PDOException $e) {
            error_log('[BillingMiddleware] Error updating token count: ' . $e->getMessage());
        }
    }

    /**
     * Get user tier for pricing calculations
     * 
     * @param int $userId User ID
     * @return string User tier
     */
    private function getUserTier(int $userId): string
    {
        try {
            $stmt = $this->db->prepare("SELECT tier FROM users WHERE id = :user_id LIMIT 1");
            $stmt->execute([':user_id' => $userId]);
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result['tier'] ?? 'free';

        } catch (PDOException $e) {
            error_log('[BillingMiddleware] Error getting user tier: ' . $e->getMessage());
            return 'free';
        }
    }

    /**
     * Get endpoint from request
     * 
     * @param array $request Request data
     * @return string Endpoint name
     */
    private function getEndpointFromRequest(array $request): string
    {
        $path = $request['path'] ?? '';
        
        if (strpos($path, '/chat/completions') !== false) {
            return 'chat_completions';
        } elseif (strpos($path, '/images/generations') !== false) {
            return 'image_generations';
        } elseif (strpos($path, '/models') !== false) {
            return 'models';
        }
        
        return 'unknown';
    }

    /**
     * Generate unique request ID for tracking
     * 
     * @param array $request Request data
     * @return string Request ID
     */
    private function generateRequestId(array $request): string
    {
        return 'req_' . uniqid() . '_' . substr(md5(json_encode($request)), 0, 8);
    }

    /**
     * Get current window start time (same as RateLimitMiddleware)
     * 
     * @return string Window start timestamp
     */
    private function getCurrentWindowStart(): string
    {
        $windowSize = 60; // 60 seconds
        $now = time();
        $windowStart = floor($now / $windowSize) * $windowSize;
        
        return date('Y-m-d H:i:s', $windowStart);
    }
}
