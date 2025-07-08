"""
Arena Client for OpenRouter Alternative Python Backend
Adapted from original lmarena2api client to work with new authentication system
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx

from config import Config

logger = logging.getLogger(__name__)


class ArenaClient:
    """Client for interacting with the LM Arena API"""
    
    def __init__(self, config: Config):
        self.config = config
        self.session = None
        self._setup_session()
    
    def _setup_session(self):
        """Set up HTTP session with proper configuration"""
        timeout = httpx.Timeout(
            connect=self.config.arena_connect_timeout,
            read=self.config.arena_api_timeout,
            write=self.config.arena_api_timeout,
            pool=self.config.arena_api_timeout
        )
        
        self.session = httpx.AsyncClient(
            timeout=timeout,
            verify=self.config.ssl_verify,
            limits=httpx.Limits(
                max_connections=self.config.max_concurrent_requests,
                max_keepalive_connections=20
            )
        )
    
    async def get_models(self, auth_context: Dict[str, Any]) -> List[str]:
        """Get list of available models"""
        try:
            # Return configured models for now
            # In a real implementation, this would query the Arena API
            return self.config.supported_models
        except Exception as e:
            logger.error(f"Error getting models: {e}")
            return self.config.supported_models
    
    async def chat_completion(self, request_body: Dict[str, Any], auth_context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle non-streaming chat completion"""
        try:
            # Validate model
            model = request_body.get("model")
            if not self.config.is_model_supported(model):
                raise ValueError(f"Unsupported model: {model}")
            
            # Convert OpenAI format to Arena format
            arena_request = self._convert_to_arena_format(request_body)
            
            # Make request to Arena API
            response_data = await self._make_arena_request(arena_request, auth_context)
            
            # Convert Arena response to OpenAI format
            openai_response = self._convert_to_openai_format(response_data, request_body)
            
            return openai_response
            
        except Exception as e:
            logger.error(f"Error in chat completion: {e}")
            raise
    
    async def stream_chat_completion(self, request_body: Dict[str, Any], auth_context: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """Handle streaming chat completion"""
        try:
            # Validate model
            model = request_body.get("model")
            if not self.config.is_model_supported(model):
                raise ValueError(f"Unsupported model: {model}")
            
            # Convert OpenAI format to Arena format
            arena_request = self._convert_to_arena_format(request_body)
            
            # Stream response from Arena API
            async for chunk in self._stream_arena_request(arena_request, auth_context):
                yield chunk
                
        except Exception as e:
            logger.error(f"Error in streaming chat completion: {e}")
            # Send error as SSE
            error_chunk = self._create_error_chunk(str(e))
            yield f"data: {json.dumps(error_chunk)}\n\n"
            yield "data: [DONE]\n\n"
    
    async def image_generation(self, request_body: Dict[str, Any], auth_context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle image generation"""
        try:
            # Convert to chat completion format for Arena API
            chat_request = {
                "model": request_body.get("model", "dall-e-3"),
                "messages": [
                    {
                        "role": "user",
                        "content": request_body["prompt"]
                    }
                ],
                "stream": False
            }
            
            # Make request to Arena API
            arena_request = self._convert_to_arena_format(chat_request, modality="image")
            response_data = await self._make_arena_request(arena_request, auth_context)
            
            # Extract image URLs from response
            image_urls = self._extract_image_urls(response_data)
            
            # Format as OpenAI image response
            return {
                "created": int(time.time()),
                "data": [
                    {
                        "url": url,
                        "revised_prompt": request_body["prompt"]
                    } for url in image_urls
                ]
            }
            
        except Exception as e:
            logger.error(f"Error in image generation: {e}")
            raise
    
    def _convert_to_arena_format(self, openai_request: Dict[str, Any], modality: str = "chat") -> Dict[str, Any]:
        """Convert OpenAI request format to Arena API format"""
        try:
            # Generate UUIDs for Arena API
            evaluation_id = str(uuid.uuid4()).lower()
            model_id = self.config.get_model_id(openai_request["model"])
            
            # Convert messages
            arena_messages = []
            message_ids = []
            
            for i, msg in enumerate(openai_request.get("messages", [])):
                message_id = str(uuid.uuid4()).lower()
                message_ids.append(message_id)
                
                # Handle content (string or array)
                content = msg["content"]
                if isinstance(content, list):
                    # Extract text from multimodal content
                    text_parts = []
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            text_parts.append(part.get("text", ""))
                    content = "\n".join(text_parts)
                
                # Determine parent message IDs
                parent_ids = [message_ids[i-1]] if i > 0 else []
                
                # Set model ID for assistant messages
                msg_model_id = model_id if msg["role"] == "assistant" else None
                
                # Convert system role to user role (Arena doesn't support system)
                role = "user" if msg["role"] == "system" else msg["role"]
                
                arena_message = {
                    "id": message_id,
                    "role": role,
                    "content": content,
                    "experimental_attachments": [],
                    "parentMessageIds": parent_ids,
                    "participantPosition": "a",
                    "modelId": msg_model_id,
                    "evaluationSessionId": evaluation_id,
                    "status": "pending",
                    "failureReason": None
                }
                
                arena_messages.append(arena_message)
            
            # Add assistant message for response
            assistant_message_id = str(uuid.uuid4()).lower()
            arena_messages.append({
                "id": assistant_message_id,
                "role": "assistant",
                "content": "",
                "experimental_attachments": [],
                "parentMessageIds": [message_ids[-1]] if message_ids else [],
                "participantPosition": "a",
                "modelId": model_id,
                "evaluationSessionId": evaluation_id,
                "status": "pending",
                "failureReason": None
            })
            
            # Create Arena request
            arena_request = {
                "id": evaluation_id,
                "mode": "direct",
                "modelAId": model_id,
                "userMessageId": message_ids[-1] if message_ids else assistant_message_id,
                "modelAMessageId": assistant_message_id,
                "messages": arena_messages,
                "modality": modality
            }
            
            return arena_request
            
        except Exception as e:
            logger.error(f"Error converting to Arena format: {e}")
            raise
    
    async def _make_arena_request(self, arena_request: Dict[str, Any], auth_context: Dict[str, Any]) -> Dict[str, Any]:
        """Make request to Arena API"""
        try:
            headers = self.config.get_request_headers(auth_context)
            url = f"{self.config.arena_base_url}/api/create-evaluation"
            
            response = await self.session.post(
                url,
                json=arena_request,
                headers=headers
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Arena API HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Error making Arena request: {e}")
            raise
    
    async def _stream_arena_request(self, arena_request: Dict[str, Any], auth_context: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """Stream response from Arena API"""
        try:
            headers = self.config.get_request_headers(auth_context)
            headers["Accept"] = "text/event-stream"
            
            url = f"{self.config.arena_base_url}/api/create-evaluation"
            
            async with self.session.stream("POST", url, json=arena_request, headers=headers) as response:
                response.raise_for_status()
                
                response_id = f"chatcmpl-{int(time.time())}"
                model = arena_request.get("modelAId", "unknown")
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]  # Remove "data: " prefix
                        
                        if data == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        
                        # Process Arena SSE data
                        chunk = self._process_arena_sse_data(data, response_id, model)
                        if chunk:
                            yield f"data: {json.dumps(chunk)}\n\n"
                            
        except Exception as e:
            logger.error(f"Error streaming Arena request: {e}")
            raise
    
    def _process_arena_sse_data(self, data: str, response_id: str, model: str) -> Optional[Dict[str, Any]]:
        """Process Arena SSE data and convert to OpenAI format"""
        try:
            # Parse Arena data format (e.g., "a0:content")
            if ":" not in data:
                return None
            
            prefix, content = data.split(":", 1)
            
            if prefix == "a0":  # Text content
                # Remove quotes if present
                if content.startswith('"') and content.endswith('"'):
                    content = json.loads(content)
                
                return {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {
                                "content": content,
                                "role": "assistant"
                            },
                            "finish_reason": None
                        }
                    ]
                }
            elif prefix in ["ae", "ad"]:  # End of message
                return {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {},
                            "finish_reason": "stop"
                        }
                    ]
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error processing Arena SSE data: {e}")
            return None
    
    def _convert_to_openai_format(self, arena_response: Dict[str, Any], original_request: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Arena response to OpenAI format"""
        try:
            # Extract content from Arena response
            content = arena_response.get("content", "")
            
            # Create OpenAI response
            response = {
                "id": f"chatcmpl-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": original_request.get("model", "unknown"),
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": content
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": self._estimate_tokens(str(original_request.get("messages", []))),
                    "completion_tokens": self._estimate_tokens(content),
                    "total_tokens": 0
                }
            }
            
            # Calculate total tokens
            response["usage"]["total_tokens"] = (
                response["usage"]["prompt_tokens"] + 
                response["usage"]["completion_tokens"]
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error converting to OpenAI format: {e}")
            raise
    
    def _extract_image_urls(self, arena_response: Dict[str, Any]) -> List[str]:
        """Extract image URLs from Arena response"""
        try:
            # This would need to be implemented based on Arena's actual response format
            # For now, return empty list
            return []
        except Exception as e:
            logger.error(f"Error extracting image URLs: {e}")
            return []
    
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count (rough approximation)"""
        # Very rough estimation: ~4 characters per token
        return max(1, len(text) // 4)
    
    def _create_error_chunk(self, error_message: str) -> Dict[str, Any]:
        """Create error chunk for streaming"""
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": "unknown",
            "choices": [
                {
                    "index": 0,
                    "delta": {
                        "content": f"Error: {error_message}",
                        "role": "assistant"
                    },
                    "finish_reason": "stop"
                }
            ]
        }
    
    async def close(self):
        """Close the HTTP session"""
        if self.session:
            await self.session.aclose()
