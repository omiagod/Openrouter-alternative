-- AI API Provider Service Database Schema
-- Compatible with MySQL 5.7+ and cPanel shared hosting

-- Create database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS ai_api_provider CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE ai_api_provider;

-- Users table for managing user accounts and authentication
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `la_cookie` TEXT NOT NULL COMMENT 'LA_COOKIE authentication token',
    `cf_clearance` TEXT NOT NULL COMMENT 'CF_CLEARANCE Cloudflare token',
    `tier` ENUM('free', 'premium', 'enterprise') DEFAULT 'free',
    `status` ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_status` (`status`),
    INDEX `idx_tier` (`tier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions for tracking active sessions
CREATE TABLE IF NOT EXISTS `user_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `session_token` VARCHAR(255) UNIQUE NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` TEXT,
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_session_token` (`session_token`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usage logs for billing and analytics
CREATE TABLE IF NOT EXISTS `usage_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `prompt_tokens` INT NOT NULL DEFAULT 0,
    `completion_tokens` INT NOT NULL DEFAULT 0,
    `total_tokens` INT NOT NULL DEFAULT 0,
    `cost` DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    `request_id` VARCHAR(255) NULL,
    `endpoint` VARCHAR(100) NOT NULL,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_model` (`model`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_request_id` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Model pricing configuration
CREATE TABLE IF NOT EXISTS `model_pricing` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `model` VARCHAR(100) UNIQUE NOT NULL,
    `price_per_1k_tokens` DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `active` BOOLEAN DEFAULT TRUE,
    `tier_multiplier_free` DECIMAL(3,2) DEFAULT 1.00,
    `tier_multiplier_premium` DECIMAL(3,2) DEFAULT 0.80,
    `tier_multiplier_enterprise` DECIMAL(3,2) DEFAULT 0.60,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_model` (`model`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limits tracking
CREATE TABLE IF NOT EXISTS `rate_limits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `window_start` DATETIME NOT NULL,
    `window_type` ENUM('minute', 'hour', 'day') NOT NULL DEFAULT 'minute',
    `request_count` INT NOT NULL DEFAULT 0,
    `token_count` INT NOT NULL DEFAULT 0,
    `request_limit` INT NOT NULL DEFAULT 60,
    `token_limit` INT NOT NULL DEFAULT 100000,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_user_window` (`user_id`, `window_start`, `window_type`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_window_start` (`window_start`),
    INDEX `idx_window_type` (`window_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data for model pricing
INSERT INTO `model_pricing` (`model`, `price_per_1k_tokens`, `currency`, `active`) VALUES
('gpt-4o-latest', 0.015000, 'USD', TRUE),
('gpt-4.1-2025-04-14', 0.020000, 'USD', TRUE),
('claude-3-5-sonnet-20241022', 0.015000, 'USD', TRUE),
('claude-3-5-haiku-20241022', 0.008000, 'USD', TRUE),
('gemini-2.0-flash-001', 0.010000, 'USD', TRUE),
('llama-3.3-70b-instruct', 0.005000, 'USD', TRUE),
('dall-e-3', 0.040000, 'USD', TRUE),
('flux-1.1-pro', 0.030000, 'USD', TRUE),
('imagen-3.0-generate-002', 0.035000, 'USD', TRUE);

-- Sample user for testing (password: 'testpassword123')
INSERT INTO `users` (`email`, `password_hash`, `la_cookie`, `cf_clearance`, `tier`, `status`) VALUES
('test@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
'sample_la_cookie_token_here', 'sample_cf_clearance_token_here', 'free', 'active');
