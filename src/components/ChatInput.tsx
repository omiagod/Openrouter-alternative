import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message...",
  maxLength = 4000,
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    onSendMessage(trimmedMessage);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    const newLength = message.length + pastedText.length;
    
    if (newLength > maxLength) {
      e.preventDefault();
      const remainingLength = maxLength - message.length;
      const truncatedText = pastedText.slice(0, remainingLength);
      setMessage(prev => prev + truncatedText);
    }
  };

  const handleFileUpload = () => {
    // TODO: Implement file upload functionality
    console.log('File upload clicked');
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      // TODO: Implement voice recording stop
    } else {
      // Start recording
      setIsRecording(true);
      // TODO: Implement voice recording start
    }
  };

  const canSend = message.trim().length > 0 && !disabled;
  const characterCount = message.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className={cn('border-t border-border bg-background p-4', className)}>
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end gap-2">
            {/* File Upload Button */}
            <button
              type="button"
              onClick={handleFileUpload}
              disabled={disabled}
              className={cn(
                'flex-shrink-0 p-2 rounded-md transition-colors',
                'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              title="Attach file"
            >
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <TextareaAutosize
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={placeholder}
                disabled={disabled}
                maxRows={6}
                minRows={1}
                className={cn(
                  'w-full resize-none rounded-lg border border-border bg-background px-4 py-3 pr-12',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                  'placeholder:text-muted-foreground',
                  disabled && 'opacity-50 cursor-not-allowed',
                  isOverLimit && 'border-destructive focus:ring-destructive'
                )}
                style={{ minHeight: '44px' }}
              />

              {/* Character Count */}
              {(isNearLimit || isOverLimit) && (
                <div className={cn(
                  'absolute bottom-1 right-12 text-xs',
                  isOverLimit ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {characterCount}/{maxLength}
                </div>
              )}
            </div>

            {/* Voice Recording Button */}
            <button
              type="button"
              onClick={handleVoiceRecord}
              disabled={disabled}
              className={cn(
                'flex-shrink-0 p-2 rounded-md transition-colors',
                'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                isRecording && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              title={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isRecording ? (
                <Square className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!canSend || isOverLimit}
              className={cn(
                'flex-shrink-0 p-2 rounded-md transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                canSend && !isOverLimit
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
              title="Send message (Enter)"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute -top-12 left-0 right-0 flex items-center justify-center">
              <div className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                Recording... Click to stop
              </div>
            </div>
          )}
        </form>

        {/* Helper Text */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Press Enter to send, Shift+Enter for new line</span>
            {disabled && (
              <span className="text-destructive">
                Chat is disabled
              </span>
            )}
          </div>
          
          {!isNearLimit && !isOverLimit && (
            <span>
              {characterCount > 0 && `${characterCount} characters`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
