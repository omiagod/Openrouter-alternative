import { ReactElement } from 'react';

// Markdown processing utilities for chat messages
// This file handles markdown rendering, syntax highlighting, and content sanitization

// Code language detection patterns
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  javascript: [/\b(function|const|let|var|=&gt;|console\.log)\b/],
  typescript: [/\b(interface|type|enum|namespace|declare)\b/, /:\s*(string|number|boolean|any)\b/],
  python: [/\b(def|import|from|class|if __name__|print)\b/, /^\s*#.*$/m],
  java: [/\b(public|private|protected|class|interface|extends|implements)\b/],
  cpp: [/\b(#include|using namespace|std::|cout|cin)\b/],
  c: [/\b(#include|printf|scanf|malloc|free)\b/],
  csharp: [/\b(using|namespace|public|private|class|interface)\b/],
  php: [/&lt;\?php/, /\$\w+/, /\b(echo|print|function|class)\b/],
  ruby: [/\b(def|class|module|require|puts)\b/, /^\s*#.*$/m],
  go: [/\b(package|import|func|var|type|interface)\b/],
  rust: [/\b(fn|let|mut|struct|enum|impl|use)\b/],
  sql: [/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i],
  html: [/&lt;\/?\w+[^&gt;]*&gt;/],
  css: [/\{[^}]*\}/, /\.[a-zA-Z-]+\s*\{/],
  json: [/^\s*[\{\[]/, /"\w+":\s*["\d\{\[]/],
  yaml: [/^\s*\w+:\s*/, /^\s*-\s+/m],
  xml: [/&lt;\?xml/, /&lt;\/?\w+[^&gt;]*&gt;/],
  bash: [/^\s*#!/, /\b(echo|grep|sed|awk|curl|wget)\b/],
  powershell: [/\$\w+/, /\b(Get-|Set-|New-|Remove-)\w+/],
  markdown: [/^#+\s/, /\*\*.*\*\*/, /\[.*\]\(.*\)/],
};

// Detect programming language from code content
export function detectLanguage(code: string): string {
  const trimmedCode = code.trim();
  
  if (!trimmedCode) {
    return 'text';
  }

  // Check for explicit language indicators
  const firstLine = trimmedCode.split('\n')[0].toLowerCase();
  
  // Shebang detection
  if (firstLine.startsWith('#!')) {
    if (firstLine.includes('python')) return 'python';
    if (firstLine.includes('node') || firstLine.includes('javascript')) return 'javascript';
    if (firstLine.includes('bash') || firstLine.includes('sh')) return 'bash';
    if (firstLine.includes('ruby')) return 'ruby';
    if (firstLine.includes('php')) return 'php';
  }

  // Pattern matching
  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    const matchCount = patterns.reduce((count, pattern) => {
      return count + (pattern.test(trimmedCode) ? 1 : 0);
    }, 0);
    
    if (matchCount > 0) {
      return language;
    }
  }

  return 'text';
}

// Extract code blocks from markdown content
export function extractCodeBlocks(content: string): Array<{ language: string; code: string; index: number }> {
  const codeBlocks: Array<{ language: string; code: string; index: number }> = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || detectLanguage(match[2]);
    const code = match[2].trim();
    const index = match.index;
    
    codeBlocks.push({ language, code, index });
  }
  
  return codeBlocks;
}

// Sanitize markdown content to prevent XSS
export function sanitizeMarkdown(content: string): string {
  // Remove potentially dangerous HTML tags and attributes
  const dangerousTags = /<(script|iframe|object|embed|form|input|button)[^>]*>.*?<\/\1>/gi;
  const dangerousAttributes = /(on\w+|javascript:|data:text\/html)/gi;
  
  let sanitized = content
    .replace(dangerousTags, '')
    .replace(dangerousAttributes, '');
  
  // Escape HTML entities in code blocks to prevent execution
  sanitized = sanitized.replace(/```[\s\S]*?```/g, (match) => {
    return match
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  });
  
  return sanitized;
}

// Format code for display with proper indentation
export function formatCode(code: string, language: string): string {
  const lines = code.split('\n');
  
  // Remove common leading whitespace
  const minIndent = lines
    .filter(line => line.trim().length > 0)
    .reduce((min, line) => {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      return Math.min(min, indent);
    }, Infinity);
  
  if (minIndent > 0 && minIndent !== Infinity) {
    return lines
      .map(line => line.slice(minIndent))
      .join('\n');
  }
  
  return code;
}

// Generate a unique ID for code blocks
export function generateCodeBlockId(content: string, index: number): string {
  const hash = content
    .split('')
    .reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  
  return `code-block-${Math.abs(hash)}-${index}`;
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Estimate reading time for content
export function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Convert markdown links to safe format
export function processMdLinks(content: string): string {
  // Convert markdown links to safe format with target="_blank" and rel="noopener noreferrer"
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  return content.replace(linkRegex, (match, text, url) => {
    // Validate URL to prevent javascript: and data: URLs
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return `[${text}](${url})`;
      }
    } catch {
      // Invalid URL, return as plain text
      return `${text} (${url})`;
    }
    
    return `${text} (${url})`;
  });
}

// Process inline code
export function processInlineCode(content: string): string {
  // Handle inline code blocks with proper escaping
  return content.replace(/`([^`]+)`/g, (match, code) => {
    const escapedCode = code
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    
    return `\`${escapedCode}\``;
  });
}

// Main markdown processing function
export function processMarkdown(content: string): string {
  let processed = content;
  
  // Sanitize content
  processed = sanitizeMarkdown(processed);
  
  // Process links
  processed = processMdLinks(processed);
  
  // Process inline code
  processed = processInlineCode(processed);
  
  return processed;
}

// Custom markdown components for react-markdown
export const markdownComponents = {
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text';
    
    if (inline) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }
    
    return (
      <div className="relative group">
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
          <code className={`language-${language} font-mono text-sm`} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },
  
  a: ({ href, children, ...props }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  
  blockquote: ({ children, ...props }: any) => (
    <blockquote
      className="border-l-4 border-muted-foreground/20 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-border" {...props}>
        {children}
      </table>
    </div>
  ),
  
  th: ({ children, ...props }: any) => (
    <th className="border border-border bg-muted px-4 py-2 text-left font-semibold" {...props}>
      {children}
    </th>
  ),
  
  td: ({ children, ...props }: any) => (
    <td className="border border-border px-4 py-2" {...props}>
      {children}
    </td>
  ),
};
