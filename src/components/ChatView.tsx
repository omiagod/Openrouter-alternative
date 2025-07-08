import { useEffect, useRef } from 'react';
import { Conversation } from '@/types/chat';
import { cn } from '@/lib/utils';
import MessageBubble from './MessageBubble';
import LoadingSpinner from './LoadingSpinner';
import { Bot, User, AlertCircle } from 'lucide-react';

interface ChatViewProps {
  conversation: Conversation | null;
  isStreaming: boolean;
  streamingMessageId: string | null;
  className?: string;
  onRetry?: (messageIndex: number) => void;
  onEdit?: (messageIndex: number, newContent: string) => void;
  onDelete?: (messageIndex: number) => void;
}

export default function ChatView({
  conversation,
  isStreaming,
  streamingMessageId,
  className,
  onRetry,
  onEdit,
  onDelete,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages, isStreaming]);

  // Show welcome message when no conversation
  if (!conversation) {
    return (
      <div className={cn('flex-1 flex items-center justify-center p-8', className)}>
        <div className="text-center max-w-md space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Bot className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Welcome to OpenRouter Alternative</h2>
            <p className="text-muted-foreground">
              Start a conversation by typing a message below. Choose from various AI models 
              and enjoy real-time streaming responses.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">💬 Natural Conversations</h3>
              <p className="text-muted-foreground text-xs">
                Chat naturally with AI models using streaming responses
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">🎯 Multiple Models</h3>
              <p className="text-muted-foreground text-xs">
                Choose from GPT, Claude, Gemini, and more
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">💾 Auto-Save</h3>
              <p className="text-muted-foreground text-xs">
                Your conversations are automatically saved locally
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">🔒 Privacy First</h3>
              <p className="text-muted-foreground text-xs">
                Your API key and data stay in your browser
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show empty conversation state
  if (conversation.messages.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center p-8', className)}>
        <div className="text-center max-w-sm space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-muted/50 rounded-full">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Start the conversation</h3>
            <p className="text-muted-foreground text-sm">
              Type your first message to begin chatting with {conversation.model}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn('flex-1 overflow-y-auto p-4 space-y-4', className)}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Conversation Header */}
        <div className="text-center py-4 border-b border-border">
          <h2 className="text-lg font-medium">{conversation.title}</h2>
          <p className="text-sm text-muted-foreground">
            Using {conversation.model} • {conversation.messages.length} messages
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-6">
          {conversation.messages.map((message, index) => {
            const isLastMessage = index === conversation.messages.length - 1;
            const isStreamingThis = isStreaming && isLastMessage && message.role === 'assistant';

            return (
              <div
                key={index}
                className={cn(
                  'flex gap-3 group',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                )}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                {/* Message Content */}
                <div className={cn(
                  'flex-1 min-w-0',
                  message.role === 'user' ? 'text-right' : 'text-left'
                )}>
                  <MessageBubble
                    message={message}
                    index={index}
                    isStreaming={isStreamingThis}
                    isLast={isLastMessage}
                    onEdit={onEdit ? (newContent) => onEdit(index, newContent) : undefined}
                    onDelete={onDelete ? () => onDelete(index) : undefined}
                    onRetry={onRetry && message.role === 'assistant' ? () => onRetry(index) : undefined}
                  />
                  
                  {/* Timestamp */}
                  <div className={cn(
                    'mt-1 text-xs text-muted-foreground',
                    message.role === 'user' ? 'text-right' : 'text-left'
                  )}>
                    {new Date().toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Streaming Indicator */}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="bg-muted rounded-lg p-3 max-w-xs">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="small" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {conversation.messages.length > 0 && !isStreaming && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>End of conversation</span>
            </div>
          </div>
        )}
      </div>

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
