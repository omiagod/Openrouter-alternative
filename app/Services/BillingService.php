<?php

namespace App\Services;

use PDO;
use PDOException;

/**
 * Billing Service
 * 
 * Calculates usage costs and manages billing records.
 * Handles pricing calculations based on user tiers and model rates.
 */
class BillingService
{
    private PDO $db;
    private array $config;

    public function __construct(PDO $db, array $config = [])
    {
        $this->db = $db;
        $this->config = array_merge([
            'default_currency' => 'USD',
            'default_price_per_1k' => 0.001,
            'cache_pricing' => true,
            'pricing_cache_ttl' => 300 // 5 minutes
        ], $config);
    }

    /**
     * Calculate cost for token usage
     * 
     * @param array $usageData Usage data with tokens and model
     * @param string $userTier User tier (free, premium, enterprise)
     * @return float Calculated cost
     */
    public function calculateCost(array $usageData, string $userTier = 'free'): float
    {
        try {
            $pricing = $this->getModelPricing($usageData['model']);
            
            if (!$pricing) {
                // Use default pricing if model not found
                $basePrice = $this->config['default_price_per_1k'];
                $multiplier = 1.0;
            } else {
                $basePrice = (float)$pricing['price_per_1k_tokens'];
                $multiplier = $this->getTierMultiplier($pricing, $userTier);
            }

            // Calculate cost: (total_tokens / 1000) * price_per_1k_tokens * tier_multiplier
            $totalTokens = $usageData['total_tokens'] ?? 0;
            $cost = ($totalTokens / 1000) * $basePrice * $multiplier;
            
            return round($cost, 6); // Round to 6 decimal places

        } catch (\Exception $e) {
            error_log('[BillingService] Error calculating cost: ' . $e->getMessage());
            return 0.0;
        }
    }

    /**
     * Record usage in the database
     * 
     * @param array $usageData Usage data
     * @param float $cost Calculated cost
     * @return bool Success status
     */
    public function recordUsage(array $usageData, float $cost): bool
    {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO usage_logs 
                (user_id, model, prompt_tokens, completion_tokens, total_tokens, cost, request_id, endpoint, timestamp)
                VALUES (:user_id, :model, :prompt_tokens, :completion_tokens, :total_tokens, :cost, :request_id, :endpoint, :timestamp)
            ");

            return $stmt->execute([
                ':user_id' => $usageData['user_id'],
                ':model' => $usageData['model'],
                ':prompt_tokens' => $usageData['prompt_tokens'] ?? 0,
                ':completion_tokens' => $usageData['completion_tokens'] ?? 0,
                ':total_tokens' => $usageData['total_tokens'] ?? 0,
                ':cost' => $cost,
                ':request_id' => $usageData['request_id'] ?? null,
                ':endpoint' => $usageData['endpoint'] ?? 'unknown',
                ':timestamp' => $usageData['timestamp'] ?? date('Y-m-d H:i:s')
            ]);

        } catch (PDOException $e) {
            error_log('[BillingService] Error recording usage: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get user usage history
     * 
     * @param int $userId User ID
     * @param array $options Query options (limit, offset, date_from, date_to)
     * @return array Usage records
     */
    public function getUserUsage(int $userId, array $options = []): array
    {
        try {
            $options = array_merge([
                'limit' => 100,
                'offset' => 0,
                'date_from' => null,
                'date_to' => null,
                'model' => null
            ], $options);

            $whereConditions = ['user_id = :user_id'];
            $params = [':user_id' => $userId];

            if ($options['date_from']) {
                $whereConditions[] = 'timestamp >= :date_from';
                $params[':date_from'] = $options['date_from'];
            }

            if ($options['date_to']) {
                $whereConditions[] = 'timestamp <= :date_to';
                $params[':date_to'] = $options['date_to'];
            }

            if ($options['model']) {
                $whereConditions[] = 'model = :model';
                $params[':model'] = $options['model'];
            }

            $whereClause = implode(' AND ', $whereConditions);

            $stmt = $this->db->prepare("
                SELECT id, model, prompt_tokens, completion_tokens, total_tokens, cost, 
                       request_id, endpoint, timestamp
                FROM usage_logs 
                WHERE {$whereClause}
                ORDER BY timestamp DESC
                LIMIT :limit OFFSET :offset
            ");

            // Bind parameters
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $options['limit'], PDO::PARAM_INT);
            $stmt->bindValue(':offset', $options['offset'], PDO::PARAM_INT);

            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);

        } catch (PDOException $e) {
            error_log('[BillingService] Error getting user usage: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get user usage summary
     * 
     * @param int $userId User ID
     * @param string $period Period (day, week, month, year)
     * @return array Usage summary
     */
    public function getUserUsageSummary(int $userId, string $period = 'month'): array
    {
        try {
            $dateCondition = $this->getDateConditionForPeriod($period);

            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(prompt_tokens) as total_prompt_tokens,
                    SUM(completion_tokens) as total_completion_tokens,
                    SUM(total_tokens) as total_tokens,
                    SUM(cost) as total_cost,
                    COUNT(DISTINCT model) as unique_models
                FROM usage_logs 
                WHERE user_id = :user_id AND {$dateCondition}
            ");

            $stmt->execute([':user_id' => $userId]);
            $summary = $stmt->fetch(PDO::FETCH_ASSOC);

            // Get model breakdown
            $stmt = $this->db->prepare("
                SELECT 
                    model,
                    COUNT(*) as requests,
                    SUM(total_tokens) as tokens,
                    SUM(cost) as cost
                FROM usage_logs 
                WHERE user_id = :user_id AND {$dateCondition}
                GROUP BY model
                ORDER BY cost DESC
            ");

            $stmt->execute([':user_id' => $userId]);
            $modelBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return [
                'summary' => $summary,
                'model_breakdown' => $modelBreakdown,
                'period' => $period,
                'currency' => $this->config['default_currency']
            ];

        } catch (PDOException $e) {
            error_log('[BillingService] Error getting usage summary: ' . $e->getMessage());
            return [
                'summary' => null,
                'model_breakdown' => [],
                'period' => $period,
                'currency' => $this->config['default_currency']
            ];
        }
    }

    /**
     * Update model pricing
     * 
     * @param string $model Model name
     * @param float $pricePerK Price per 1000 tokens
     * @param array $tierMultipliers Tier multipliers
     * @return bool Success status
     */
    public function updateModelPricing(string $model, float $pricePerK, array $tierMultipliers = []): bool
    {
        try {
            $tierMultipliers = array_merge([
                'free' => 1.00,
                'premium' => 0.80,
                'enterprise' => 0.60
            ], $tierMultipliers);

            $stmt = $this->db->prepare("
                INSERT INTO model_pricing 
                (model, price_per_1k_tokens, currency, tier_multiplier_free, tier_multiplier_premium, tier_multiplier_enterprise, active)
                VALUES (:model, :price, :currency, :tier_free, :tier_premium, :tier_enterprise, TRUE)
                ON DUPLICATE KEY UPDATE
                    price_per_1k_tokens = :price,
                    tier_multiplier_free = :tier_free,
                    tier_multiplier_premium = :tier_premium,
                    tier_multiplier_enterprise = :tier_enterprise,
                    updated_at = NOW()
            ");

            return $stmt->execute([
                ':model' => $model,
                ':price' => $pricePerK,
                ':currency' => $this->config['default_currency'],
                ':tier_free' => $tierMultipliers['free'],
                ':tier_premium' => $tierMultipliers['premium'],
                ':tier_enterprise' => $tierMultipliers['enterprise']
            ]);

        } catch (PDOException $e) {
            error_log('[BillingService] Error updating model pricing: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get model pricing from database
     * 
     * @param string $model Model name
     * @return array|null Pricing data or null if not found
     */
    private function getModelPricing(string $model): ?array
    {
        try {
            $stmt = $this->db->prepare("
                SELECT price_per_1k_tokens, tier_multiplier_free, tier_multiplier_premium, tier_multiplier_enterprise
                FROM model_pricing 
                WHERE model = :model AND active = TRUE
                LIMIT 1
            ");

            $stmt->execute([':model' => $model]);
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

        } catch (PDOException $e) {
            error_log('[BillingService] Error getting model pricing: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get tier multiplier from pricing data
     * 
     * @param array $pricing Pricing data
     * @param string $tier User tier
     * @return float Tier multiplier
     */
    private function getTierMultiplier(array $pricing, string $tier): float
    {
        switch ($tier) {
            case 'premium':
                return (float)$pricing['tier_multiplier_premium'];
            case 'enterprise':
                return (float)$pricing['tier_multiplier_enterprise'];
            case 'free':
            default:
                return (float)$pricing['tier_multiplier_free'];
        }
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
            case 'day':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
            case 'week':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
            case 'month':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
            case 'year':
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
            default:
                return "timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        }
    }
}
