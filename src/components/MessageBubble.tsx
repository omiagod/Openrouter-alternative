import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  RotateCcw,
  MoreHorizontal 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/openrouter';
import { copyToClipboard } from '@/lib/markdown';
import { toast } from 'react-hot-toast';

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  isStreaming?: boolean;
  isLast?: boolean;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
  onRetry?: () => void;
}

export default function MessageBubble({
  message,
  index,
  isStreaming = false,
  isLast = false,
  onCopy,
  onEdit,
  onDelete,
  onRetry,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } else {
      toast.error('Failed to copy');
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      onEdit?.(editContent);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div
      className={cn(
        'group relative max-w-[85%] animate-in',
        message.role === 'user' ? 'ml-auto' : 'mr-auto'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Message Content */}
      <div
        className={cn(
          'rounded-lg p-4 relative',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
          isStreaming && 'animate-pulse'
        )}
      >
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[100px] p-2 bg-background border border-border rounded text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/80"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';

                  if (inline) {
                    return (
                      <code
                        className={cn(
                          'px-1.5 py-0.5 rounded text-sm font-mono',
                          message.role === 'user'
                            ? 'bg-primary-foreground/20'
                            : 'bg-background'
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div className="relative group/code">
                      <SyntaxHighlighter
                        style={isDarkMode ? oneDark : oneLight}
                        language={language || 'text'}
                        PreTag="div"
                        className="rounded-md !mt-2 !mb-2"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                      <button
                        onClick={() => copyToClipboard(String(children))}
                        className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background rounded opacity-0 group-hover/code:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  );
                },
                a({ href, children, ...props }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'underline',
                        message.role === 'user'
                          ? 'text-primary-foreground/80 hover:text-primary-foreground'
                          : 'text-primary hover:text-primary/80'
                      )}
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                blockquote({ children, ...props }) {
                  return (
                    <blockquote
                      className={cn(
                        'border-l-4 pl-4 italic',
                        message.role === 'user'
                          ? 'border-primary-foreground/30'
                          : 'border-muted-foreground/30'
                      )}
                      {...props}
                    >
                      {children}
                    </blockquote>
                  );
                },
                table({ children, ...props }) {
                  return (
                    <div className="overflow-x-auto">
                      <table
                        className="min-w-full border-collapse border border-border"
                        {...props}
                      >
                        {children}
                      </table>
                    </div>
                  );
                },
                th({ children, ...props }) {
                  return (
                    <th
                      className="border border-border bg-muted px-4 py-2 text-left font-semibold"
                      {...props}
                    >
                      {children}
                    </th>
                  );
                },
                td({ children, ...props }) {
                  return (
                    <td className="border border-border px-4 py-2" {...props}>
                      {children}
                    </td>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1 mt-2">
            <div className="w-1 h-1 bg-current rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-current rounded-full animate-pulse delay-75" />
            <div className="w-1 h-1 bg-current rounded-full animate-pulse delay-150" />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(showActions || isEditing) && !isStreaming && (
        <div
          className={cn(
            'absolute top-0 flex items-center gap-1 p-1 bg-background border border-border rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity',
            message.role === 'user' ? '-left-12' : '-right-12'
          )}
        >
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Copy message"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>

          {onEdit && (
            <button
              onClick={handleEdit}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              title="Edit message"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          )}

          {onRetry && message.role === 'assistant' && isLast && (
            <button
              onClick={onRetry}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              title="Retry generation"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors"
              title="Delete message"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          <button
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="More options"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
