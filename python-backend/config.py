"""
Configuration module for OpenRouter Alternative Python Backend
Modified from original lmarena2api config to support new authentication flow
"""

import os
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Config:
    """Configuration class for the Python backend service"""
    
    # Server configuration
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    
    # Arena API configuration
    arena_base_url: str = field(default_factory=lambda: os.getenv("ARENA_BASE_URL", "https://beta.lmarena.ai"))
    arena_api_timeout: int = field(default_factory=lambda: int(os.getenv("ARENA_API_TIMEOUT", "30")))
    arena_connect_timeout: int = field(default_factory=lambda: int(os.getenv("ARENA_CONNECT_TIMEOUT", "10")))
    arena_max_retries: int = field(default_factory=lambda: int(os.getenv("ARENA_MAX_RETRIES", "3")))
    arena_retry_delay: float = field(default_factory=lambda: float(os.getenv("ARENA_RETRY_DELAY", "1.0")))
    
    # Authentication configuration
    require_auth: bool = field(default_factory=lambda: os.getenv("REQUIRE_AUTH", "true").lower() == "true")
    cookie_validation: bool = field(default_factory=lambda: os.getenv("COOKIE_VALIDATION", "true").lower() == "true")
    
    # Default cookies (fallback if not provided in headers)
    default_la_cookie: Optional[str] = field(default_factory=lambda: os.getenv("DEFAULT_LA_COOKIE"))
    default_cf_clearance: Optional[str] = field(default_factory=lambda: os.getenv("DEFAULT_CF_CLEARANCE"))
    
    # Request configuration
    user_agent: str = field(default_factory=lambda: os.getenv("USER_AGENT", "OpenRouter-Alternative-Backend/1.0"))
    max_request_size: int = field(default_factory=lambda: int(os.getenv("MAX_REQUEST_SIZE", "10485760")))  # 10MB
    
    # Rate limiting
    enable_rate_limiting: bool = field(default_factory=lambda: os.getenv("ENABLE_RATE_LIMITING", "false").lower() == "true")
    rate_limit_requests: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_REQUESTS", "60")))
    rate_limit_window: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_WINDOW", "60")))
    
    # Logging configuration
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    log_format: str = field(default_factory=lambda: os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    
    # Proxy configuration
    proxy_url: Optional[str] = field(default_factory=lambda: os.getenv("PROXY_URL"))
    proxy_auth: Optional[str] = field(default_factory=lambda: os.getenv("PROXY_AUTH"))
    
    # SSL configuration
    ssl_verify: bool = field(default_factory=lambda: os.getenv("SSL_VERIFY", "true").lower() == "true")
    ssl_cert_path: Optional[str] = field(default_factory=lambda: os.getenv("SSL_CERT_PATH"))
    ssl_key_path: Optional[str] = field(default_factory=lambda: os.getenv("SSL_KEY_PATH"))
    
    # Model configuration
    supported_models: List[str] = field(default_factory=lambda: [
        "gpt-4o-latest",
        "gpt-4.1-2025-04-14",
        "gpt-4.1-mini-2025-04-14",
        "claude-3-5-haiku-20241022",
        "claude-3-5-sonnet-20241022",
        "claude-3-7-sonnet-20250219",
        "claude-opus-4-20250514",
        "claude-sonnet-4-20250514",
        "gemini-2.0-flash-001",
        "gemini-2.5-flash-preview-04-17",
        "gemini-2.5-pro-preview-05-06",
        "llama-3.3-70b-instruct",
        "llama-4-maverick-03-26-experimental",
        "deepseek-v3-0324",
        "grok-3-mini-beta",
        "grok-3-preview-02-24",
        "o3-2025-04-16",
        "o3-mini",
        "o4-mini-2025-04-16",
        "qwen-max-2025-01-25",
        "dall-e-3",
        "gpt-image-1",
        "gemini-2.0-flash-preview-image-generation",
        "imagen-3.0-generate-002",
        "flux-1.1-pro",
        "ideogram-v2",
        "photon",
        "recraft-v3"
    ])
    
    # Model mapping (if needed to map OpenAI model names to Arena model IDs)
    model_mapping: Dict[str, str] = field(default_factory=lambda: {
        "gpt-4": "gpt-4o-latest",
        "gpt-4-turbo": "gpt-4.1-2025-04-14",
        "gpt-3.5-turbo": "gpt-4.1-mini-2025-04-14",
        "claude-3-sonnet": "claude-3-5-sonnet-20241022",
        "claude-3-haiku": "claude-3-5-haiku-20241022",
        "gemini-pro": "gemini-2.0-flash-001",
        "llama-3": "llama-3.3-70b-instruct"
    })
    
    # Usage tracking
    track_usage: bool = field(default_factory=lambda: os.getenv("TRACK_USAGE", "true").lower() == "true")
    usage_endpoint: Optional[str] = field(default_factory=lambda: os.getenv("USAGE_ENDPOINT"))
    
    # Performance settings
    max_concurrent_requests: int = field(default_factory=lambda: int(os.getenv("MAX_CONCURRENT_REQUESTS", "100")))
    request_timeout: int = field(default_factory=lambda: int(os.getenv("REQUEST_TIMEOUT", "300")))  # 5 minutes
    
    def __post_init__(self):
        """Post-initialization validation and setup"""
        self._validate_config()
        self._setup_logging()
    
    def _validate_config(self):
        """Validate configuration values"""
        if self.port < 1 or self.port > 65535:
            raise ValueError(f"Invalid port number: {self.port}")
        
        if self.arena_api_timeout <= 0:
            raise ValueError(f"Invalid API timeout: {self.arena_api_timeout}")
        
        if self.max_request_size <= 0:
            raise ValueError(f"Invalid max request size: {self.max_request_size}")
        
        if self.require_auth and not (self.default_la_cookie and self.default_cf_clearance):
            logger.warning("Authentication required but no default cookies provided")
    
    def _setup_logging(self):
        """Set up logging configuration"""
        log_level = getattr(logging, self.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=log_level,
            format=self.log_format
        )
    
    def get_model_id(self, model_name: str) -> str:
        """Get the actual model ID for a given model name"""
        return self.model_mapping.get(model_name, model_name)
    
    def is_model_supported(self, model_name: str) -> bool:
        """Check if a model is supported"""
        actual_model = self.get_model_id(model_name)
        return actual_model in self.supported_models
    
    def get_request_headers(self, auth_context: Dict[str, Any]) -> Dict[str, str]:
        """Get standard request headers"""
        headers = {
            "User-Agent": auth_context.get("user_agent", self.user_agent),
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Add authentication cookies
        la_cookie = auth_context.get("la_cookie", self.default_la_cookie)
        cf_clearance = auth_context.get("cf_clearance", self.default_cf_clearance)
        
        if la_cookie and cf_clearance:
            headers["Cookie"] = f"LA_COOKIE={la_cookie}; CF_CLEARANCE={cf_clearance}"
        
        return headers
    
    def get_proxy_config(self) -> Optional[Dict[str, str]]:
        """Get proxy configuration if available"""
        if not self.proxy_url:
            return None
        
        proxy_config = {
            "http": self.proxy_url,
            "https": self.proxy_url
        }
        
        if self.proxy_auth:
            # Proxy auth should be in format "username:password"
            proxy_config["auth"] = self.proxy_auth
        
        return proxy_config
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary (excluding sensitive data)"""
        config_dict = {}
        for key, value in self.__dict__.items():
            if not key.startswith('_') and 'cookie' not in key.lower() and 'auth' not in key.lower():
                config_dict[key] = value
        return config_dict
