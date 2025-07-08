import { useState } from 'react';
import { Eye, EyeOff, Key, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import LoadingSpinner from './LoadingSpinner';

interface ApiKeyInputProps {
  apiKey: string | null;
  onApiKeyChange: (apiKey: string) => void;
  isValid?: boolean;
  isValidating?: boolean;
  className?: string;
}

export default function ApiKeyInput({
  apiKey,
  onApiKeyChange,
  isValid = false,
  isValidating = false,
  className,
}: ApiKeyInputProps) {
  const [inputValue, setInputValue] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setHasAttempted(true);
      onApiKeyChange(inputValue.trim());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setHasAttempted(false);
  };

  const getStatusIcon = () => {
    if (isValidating) {
      return <LoadingSpinner size="small" />;
    }
    
    if (hasAttempted) {
      if (isValid) {
        return <Check className="h-4 w-4 text-green-500" />;
      } else {
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      }
    }
    
    return <Key className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusMessage = () => {
    if (isValidating) {
      return 'Validating API key...';
    }
    
    if (hasAttempted) {
      if (isValid) {
        return 'API key is valid and ready to use';
      } else {
        return 'Invalid API key. Please check and try again.';
      }
    }
    
    return null;
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 bg-primary/10 rounded-full">
            <Key className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">Enter Your API Key</h2>
        <p className="text-muted-foreground text-sm">
          You need an OpenRouter API key to use this chat interface.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="api-key" className="text-sm font-medium">
            OpenRouter API Key
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={inputValue}
              onChange={handleInputChange}
              placeholder="sk-or-..."
              className={cn(
                'w-full px-3 py-2 pr-20 border rounded-md bg-background',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                hasAttempted && !isValid && 'border-destructive',
                hasAttempted && isValid && 'border-green-500'
              )}
              disabled={isValidating}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {getStatusIcon()}
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1 hover:bg-muted rounded transition-colors"
                disabled={isValidating}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          
          {getStatusMessage() && (
            <p className={cn(
              'text-xs',
              isValid ? 'text-green-600' : 'text-destructive'
            )}>
              {getStatusMessage()}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!inputValue.trim() || isValidating}
          className={cn(
            'w-full py-2 px-4 bg-primary text-primary-foreground rounded-md',
            'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        >
          {isValidating ? 'Validating...' : 'Validate API Key'}
        </button>
      </form>

      <div className="space-y-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Don't have an API key?
          </p>
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Get one from OpenRouter
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Security Note
          </h4>
          <p className="text-xs text-muted-foreground">
            Your API key is stored locally in your browser and is never sent to our servers. 
            It's only used to authenticate with OpenRouter's API directly.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Supported Formats
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• OpenRouter keys: <code className="bg-background px-1 rounded">sk-or-...</code></li>
            <li>• OpenAI keys: <code className="bg-background px-1 rounded">sk-...</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
