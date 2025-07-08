# OpenRouter Alternative - AI API Provider Service

An AI API provider service built on top of lmarena2api, designed for cPanel shared hosting environments. This service provides OpenAI-compatible API endpoints with authentication, rate limiting, usage tracking, and billing capabilities.

## Architecture

This project uses a hybrid PHP+Python architecture:
- **PHP Gateway**: Handles authentication, rate limiting, billing, and OpenAI-compatible API endpoints
- **Python Backend**: Modified lmarena2api service for actual model routing via Passenger
- **MySQL Database**: User management, session tracking, usage logging, and billing

## Features

- ✅ OpenAI-compatible API endpoints (`/v1/chat/completions`, `/v1/models`, `/v1/images/generations`)
- ✅ Cookie-based authentication (LA_COOKIE and CF_CLEARANCE validation)
- ✅ Per-user rate limiting with sliding window
- ✅ Usage tracking and billing system
- ✅ MySQL-based user management
- ✅ cPanel shared hosting optimized
- ✅ Streaming and non-streaming response support

## Quick Start

1. Upload files to your cPanel hosting account
2. Import the database schema from `config/database.sql`
3. Configure environment variables in `.env`
4. Set up the Python backend via cPanel's Application Manager
5. Access your API at `https://yourdomain.com/v1/`

## API Endpoints

- `POST /v1/chat/completions` - Chat completions (OpenAI compatible)
- `GET /v1/models` - List available models
- `POST /v1/images/generations` - Image generation
- `GET /health` - Health check

## Documentation

- [Deployment Guide](deployment/cpanel-setup.md)
- [Configuration Reference](config/app.php)
- [Database Schema](config/database.sql)

## Requirements

- PHP 8.0+
- MySQL 5.7+
- cPanel hosting with Node.js/Python support
- SSL certificate (recommended)