# cPanel Deployment Guide for OpenRouter Alternative

This guide provides step-by-step instructions for deploying the OpenRouter Alternative AI API provider service on cPanel shared hosting.

## Prerequisites

- cPanel hosting account with:
  - PHP 8.0+ support
  - MySQL database access
  - Node.js/Python application support (for backend)
  - SSL certificate (recommended)
- Access to cPanel File Manager or FTP
- Basic knowledge of cPanel interface

## Deployment Steps

### 1. Database Setup

#### 1.1 Create MySQL Database
1. Log into cPanel
2. Navigate to **MySQL Databases**
3. Create a new database (e.g., `yourusername_ai_api`)
4. Create a database user with full privileges
5. Note down the database credentials

#### 1.2 Import Database Schema
1. Navigate to **phpMyAdmin**
2. Select your database
3. Go to **Import** tab
4. Upload and execute `config/database.sql`
5. Verify all tables are created successfully

### 2. File Upload

#### 2.1 Upload PHP Files
1. Open **File Manager** in cPanel
2. Navigate to your domain's public_html directory
3. Upload all files from the project root:
   ```
   public/
   app/
   config/
   routes/
   .env.example
   ```

#### 2.2 Set Up Environment Configuration
1. Copy `.env.example` to `.env`
2. Edit `.env` with your specific settings:
   ```bash
   # Database Configuration
   DB_HOST=localhost
   DB_NAME=yourusername_ai_api
   DB_USER=yourusername_dbuser
   DB_PASS=your_database_password
   
   # Application Settings
   APP_URL=https://yourdomain.com
   DEBUG=false
   
   # Python Backend URL (will be set up in step 3)
   PYTHON_SERVICE_URL=https://yourdomain.com:8000
   ```

#### 2.3 Set File Permissions
1. Set directory permissions to 755:
   - `app/`
   - `config/`
   - `routes/`
   - `public/`

2. Set file permissions to 644:
   - All `.php` files
   - `.htaccess`
   - `.env`

### 3. Python Backend Setup

#### 3.1 Create Python Application
1. In cPanel, navigate to **Setup Python App**
2. Click **Create Application**
3. Configure:
   - Python version: 3.8+
   - Application root: `/python-backend`
   - Application URL: Leave blank (will use port)
   - Application startup file: `main.py`
   - Application Entry point: `app`

#### 3.2 Install Dependencies
1. Open the Python app terminal
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

#### 3.3 Configure Python Environment
1. Create `.env` file in python-backend directory:
   ```bash
   HOST=0.0.0.0
   PORT=8000
   DEBUG=false
   ARENA_BASE_URL=https://beta.lmarena.ai
   REQUIRE_AUTH=true
   ```

#### 3.4 Start Python Application
1. In cPanel Python Apps, click **Start** for your application
2. Note the assigned port number
3. Update `PYTHON_SERVICE_URL` in main `.env` file

### 4. Domain Configuration

#### 4.1 Set Document Root
1. In cPanel, go to **Subdomains** or **Addon Domains**
2. Set document root to `/public_html/public`
3. This ensures `index.php` is the entry point

#### 4.2 SSL Configuration (Recommended)
1. Navigate to **SSL/TLS** in cPanel
2. Install SSL certificate (Let's Encrypt is usually available)
3. Force HTTPS redirects
4. Update `HTTPS_ONLY=true` in `.env`

### 5. Testing and Verification

#### 5.1 Health Check
Test the health endpoint:
```bash
curl https://yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-08T...",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "memory": "ok"
  }
}
```

#### 5.2 Models Endpoint
Test the models endpoint:
```bash
curl -H "X-LA-Cookie: your_la_cookie" \
     -H "X-CF-Clearance: your_cf_clearance" \
     https://yourdomain.com/v1/models
```

#### 5.3 Chat Completions
Test chat completions:
```bash
curl -X POST https://yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-LA-Cookie: your_la_cookie" \
  -H "X-CF-Clearance: your_cf_clearance" \
  -d '{
    "model": "gpt-4o-latest",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 6. User Management

#### 6.1 Add Users
Insert users directly into the database:
```sql
INSERT INTO users (email, password_hash, la_cookie, cf_clearance, tier, status) 
VALUES (
  'user@example.com',
  '$2y$10$...',  -- bcrypt hash of password
  'user_la_cookie_token',
  'user_cf_clearance_token',
  'free',
  'active'
);
```

#### 6.2 Update Model Pricing
```sql
INSERT INTO model_pricing (model, price_per_1k_tokens, currency, active) 
VALUES ('gpt-4o-latest', 0.015000, 'USD', TRUE)
ON DUPLICATE KEY UPDATE price_per_1k_tokens = 0.015000;
```

### 7. Monitoring and Maintenance

#### 7.1 Log Files
Monitor logs in:
- cPanel Error Logs
- Python application logs
- Custom application logs (if configured)

#### 7.2 Database Maintenance
Regularly clean up:
```sql
-- Clean old rate limit records
DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Clean old usage logs (optional, for storage management)
DELETE FROM usage_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

#### 7.3 Performance Optimization
1. Enable cPanel caching if available
2. Monitor resource usage in cPanel
3. Optimize database queries if needed
4. Consider upgrading hosting plan for high traffic

### 8. Troubleshooting

#### 8.1 Common Issues

**Database Connection Errors:**
- Verify database credentials in `.env`
- Check database user permissions
- Ensure database exists

**Python Backend Not Starting:**
- Check Python app logs in cPanel
- Verify all dependencies are installed
- Check port availability

**Authentication Failures:**
- Verify LA_COOKIE and CF_CLEARANCE tokens
- Check user exists in database
- Ensure cookies are properly formatted

**Rate Limiting Issues:**
- Check rate_limits table for current usage
- Verify user tier settings
- Clean up expired rate limit records

#### 8.2 Debug Mode
For troubleshooting, temporarily enable debug mode:
```bash
# In .env
DEBUG=true
LOG_LEVEL=debug
DISPLAY_ERRORS=true
```

**Remember to disable debug mode in production!**

### 9. Security Considerations

1. **Environment Variables:** Never commit `.env` files to version control
2. **Database Security:** Use strong passwords and limit database user permissions
3. **SSL/HTTPS:** Always use HTTPS in production
4. **File Permissions:** Ensure proper file permissions (644 for files, 755 for directories)
5. **Regular Updates:** Keep PHP and Python dependencies updated
6. **Access Logs:** Monitor access logs for suspicious activity

### 10. Scaling Considerations

For high-traffic scenarios:
1. Consider upgrading to VPS or dedicated hosting
2. Implement Redis caching for rate limiting
3. Use CDN for static assets
4. Optimize database with proper indexing
5. Consider load balancing for multiple backend instances

## Support

For issues specific to this deployment:
1. Check the application logs
2. Verify all configuration settings
3. Test individual components (database, Python backend, PHP frontend)
4. Consult cPanel documentation for hosting-specific issues
