import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import ChatView from './ChatView';
import ChatInput from './ChatInput';
import ModelSelector from './ModelSelector';
import SettingsPanel from './SettingsPanel';
import ApiKeyInput from './ApiKeyInput';
import { 
  Settings, 
  MessageSquare, 
  Plus, 
  Menu, 
  X,
  Zap,
  AlertCircle 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const {
    currentConversation,
    conversations,
    isLoading,
    isStreaming,
    streamingMessageId,
    selectedModel,
    availableModels,
    modelsLoading,
    apiKey,
    apiKeyValid,
    settings,
    error,
    createConversation,
    loadConversation,
    deleteConversation,
    addMessage,
    setSelectedModel,
    setAvailableModels,
    setModelsLoading,
    setApiKey,
    setError,
    clearCurrentConversation,
  } = useChatStore();

  // Check API key on mount
  useEffect(() => {
    if (!apiKey || !apiKeyValid) {
      setShowApiKeyInput(true);
    } else {
      setShowApiKeyInput(false);
      loadModels();
    }
  }, [apiKey, apiKeyValid]);

  // Load available models
  const loadModels = async () => {
    if (!apiKey) return;

    setModelsLoading(true);
    try {
      const response = await fetch('/api/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load models');
      }

      const data = await response.json();
      setAvailableModels(data.data || []);
    } catch (error) {
      console.error('Failed to load models:', error);
      toast.error('Failed to load models');
    } finally {
      setModelsLoading(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!apiKey || !apiKeyValid) {
      toast.error('Please enter a valid API key first');
      setShowApiKeyInput(true);
      return;
    }

    if (!content.trim()) return;

    // Add user message
    addMessage({ content, role: 'user' });

    // Add assistant message placeholder
    const assistantMessageId = Date.now().toString();
    addMessage({ content: '', role: 'assistant' });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: currentConversation?.messages || [],
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                assistantContent += content;
                // Update the last message with new content
                const messages = currentConversation?.messages || [];
                const lastIndex = messages.length - 1;
                if (lastIndex >= 0) {
                  // This would need to be implemented in the store
                  // updateMessage(lastIndex, assistantContent);
                }
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Handle API key validation
  const handleApiKeySubmit = async (newApiKey: string) => {
    try {
      const response = await fetch('/api/models', {
        headers: {
          'Authorization': `Bearer ${newApiKey}`,
        },
      });

      if (response.ok) {
        setApiKey(newApiKey, true);
        setShowApiKeyInput(false);
        toast.success('API key validated successfully');
        loadModels();
      } else {
        throw new Error('Invalid API key');
      }
    } catch (error) {
      toast.error('Invalid API key');
      setApiKey(newApiKey, false);
    }
  };

  // Handle creating new conversation
  const handleNewConversation = () => {
    createConversation();
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-80 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h1 className="text-lg font-semibold">OpenRouter Alt</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 hover:bg-muted rounded-md transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-muted rounded-md transition-colors lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* New Conversation Button */}
          <div className="p-4">
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center gap-2 p-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Conversation
            </button>
          </div>

          {/* Model Selector */}
          <div className="px-4 pb-4">
            <ModelSelector
              selectedModel={selectedModel}
              availableModels={availableModels}
              onModelChange={setSelectedModel}
              loading={modelsLoading}
            />
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Recent Conversations
            </h3>
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    loadConversation(conv.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full text-left p-3 rounded-md transition-colors hover:bg-muted',
                    currentConversation?.id === conv.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.messageCount} messages
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-muted rounded-md transition-colors lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {currentConversation?.title || 'OpenRouter Alternative'}
              </span>
            </div>
          </div>

          {!apiKeyValid && (
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">API Key Required</span>
            </button>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {showApiKeyInput ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="max-w-md w-full">
                <ApiKeyInput
                  apiKey={apiKey}
                  onApiKeyChange={handleApiKeySubmit}
                  isValid={apiKeyValid}
                />
              </div>
            </div>
          ) : (
            <>
              <ChatView
                conversation={currentConversation}
                isStreaming={isStreaming}
                streamingMessageId={streamingMessageId}
              />
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading || isStreaming || !apiKeyValid}
              />
            </>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={() => {}}
      />

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
