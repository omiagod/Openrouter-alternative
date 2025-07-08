#!/usr/bin/env python3
"""
OpenRouter Alternative - Python Backend
Main FastAPI application entry point for the modified lmarena2api service.
"""

import os
import logging
import asyncio
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn

from config import Config
from client import ArenaClient


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting OpenRouter Alternative Python Backend")
    yield
    logger.info("Shutting down OpenRouter Alternative Python Backend")


# Initialize FastAPI app
app = FastAPI(
    title="OpenRouter Alternative Backend",
    description="Modified lmarena2api service for OpenRouter Alternative",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your needs
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize configuration
config = Config()

# Initialize Arena client
arena_client = ArenaClient(config)


async def get_auth_context(request: Request) -> Dict[str, Any]:
    """Extract authentication context from request headers"""
    la_cookie = request.headers.get("X-LA-Cookie") or request.headers.get("LA-Cookie")
    cf_clearance = request.headers.get("X-CF-Clearance") or request.headers.get("CF-Clearance")
    
    if not la_cookie or not cf_clearance:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Missing authentication cookies",
                    "type": "authentication_error",
                    "code": "missing_cookies"
                }
            }
        )
    
    return {
        "la_cookie": la_cookie,
        "cf_clearance": cf_clearance,
        "user_agent": request.headers.get("User-Agent", "OpenRouter-Alternative/1.0")
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "openrouter-alternative-backend",
        "version": "1.0.0",
        "timestamp": asyncio.get_event_loop().time()
    }


@app.get("/v1/models")
async def list_models(auth_context: Dict[str, Any] = Depends(get_auth_context)):
    """List available models"""
    try:
        models = await arena_client.get_models(auth_context)
        
        # Format in OpenAI-compatible format
        formatted_models = []
        for model in models:
            if isinstance(model, str):
                formatted_models.append({
                    "id": model,
                    "object": "model",
                    "created": 1677610602,
                    "owned_by": "openrouter-alternative"
                })
            elif isinstance(model, dict) and "id" in model:
                formatted_models.append({
                    "id": model["id"],
                    "object": "model",
                    "created": model.get("created", 1677610602),
                    "owned_by": model.get("owned_by", "openrouter-alternative")
                })
        
        return {
            "object": "list",
            "data": formatted_models
        }
        
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "message": "Failed to retrieve models",
                    "type": "server_error",
                    "code": "models_error"
                }
            }
        )


@app.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    auth_context: Dict[str, Any] = Depends(get_auth_context)
):
    """Handle chat completions"""
    try:
        # Parse request body
        body = await request.json()
        
        # Validate required fields
        if "model" not in body:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "message": "Missing required field: model",
                        "type": "invalid_request_error",
                        "code": "missing_model"
                    }
                }
            )
        
        if "messages" not in body or not isinstance(body["messages"], list):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "message": "Missing or invalid required field: messages",
                        "type": "invalid_request_error",
                        "code": "invalid_messages"
                    }
                }
            )
        
        # Check if streaming is requested
        is_streaming = body.get("stream", False)
        
        if is_streaming:
            return StreamingResponse(
                arena_client.stream_chat_completion(body, auth_context),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"
                }
            )
        else:
            response = await arena_client.chat_completion(body, auth_context)
            return response
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat completions: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "message": "Internal server error",
                    "type": "server_error",
                    "code": "internal_error"
                }
            }
        )


@app.post("/v1/images/generations")
async def image_generations(
    request: Request,
    auth_context: Dict[str, Any] = Depends(get_auth_context)
):
    """Handle image generations"""
    try:
        # Parse request body
        body = await request.json()
        
        # Validate required fields
        if "prompt" not in body:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "message": "Missing required field: prompt",
                        "type": "invalid_request_error",
                        "code": "missing_prompt"
                    }
                }
            )
        
        response = await arena_client.image_generation(body, auth_context)
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in image generations: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "message": "Internal server error",
                    "type": "server_error",
                    "code": "internal_error"
                }
            }
        )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": "Internal server error",
                "type": "server_error",
                "code": "internal_error"
            }
        }
    )


if __name__ == "__main__":
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    # Run the application
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info" if not debug else "debug"
    )
