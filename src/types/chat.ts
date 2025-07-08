import { ChatMessage, ChatParameters, ModelInfo } from './openrouter';

// Conversation management types
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  parameters: ChatParameters;
  createdAt: Date;
  updatedAt: Date;
  tokenCount?: number;
  estimatedCost?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chat application state
export interface ChatState {
  // Current conversation
  currentConversation: Conversation | null;
  
  // All conversations
  conversations: ConversationSummary[];
  
  // UI state
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  
  // Selected model and parameters
  selectedModel: string;
  chatParameters: ChatParameters;
  
  // Available models
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  
  // API key
  apiKey: string | null;
  apiKeyValid: boolean;
  
  // Settings
  settings: UserSettings;
  
  // Error state
  error: string | null;
}

// User settings and preferences
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showTokenCount: boolean;
  showCostEstimate: boolean;
  autoSave: boolean;
  maxConversations: number;
  defaultModel: string;
  defaultParameters: ChatParameters;
  enableSounds: boolean;
  compactMode: boolean;
}

// UI component props
export interface ChatInterfaceProps {
  className?: string;
}

export interface ChatViewProps {
  conversation: Conversation | null;
  isStreaming: boolean;
  streamingMessageId: string | null;
  onRetry?: (messageIndex: number) => void;
  onEdit?: (messageIndex: number, newContent: string) => void;
  onDelete?: (messageIndex: number) => void;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  isStreaming?: boolean;
  isLast?: boolean;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
  onRetry?: () => void;
}

export interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export interface ModelSelectorProps {
  selectedModel: string;
  availableModels: ModelInfo[];
  onModelChange: (modelId: string) => void;
  loading?: boolean;
}

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsChange: (settings: Partial<UserSettings>) => void;
}

export interface ParameterControlsProps {
  parameters: ChatParameters;
  onParametersChange: (parameters: Partial<ChatParameters>) => void;
  disabled?: boolean;
}

export interface ApiKeyInputProps {
  apiKey: string | null;
  onApiKeyChange: (apiKey: string) => void;
  onValidate?: () => void;
  isValid?: boolean;
  isValidating?: boolean;
}

// Action types for state management
export type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_STREAMING'; payload: { isStreaming: boolean; messageId?: string } }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: Conversation | null }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageIndex: number; content: string } }
  | { type: 'DELETE_MESSAGE'; payload: { conversationId: string; messageIndex: number } }
  | { type: 'SET_MODEL'; payload: string }
  | { type: 'SET_PARAMETERS'; payload: Partial<ChatParameters> }
  | { type: 'SET_AVAILABLE_MODELS'; payload: ModelInfo[] }
  | { type: 'SET_MODELS_LOADING'; payload: boolean }
  | { type: 'SET_API_KEY'; payload: { apiKey: string; isValid: boolean } }
  | { type: 'SET_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CREATE_CONVERSATION'; payload: Conversation }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'UPDATE_CONVERSATION_TITLE'; payload: { id: string; title: string } };

// Storage types
export interface StorageData {
  conversations: Conversation[];
  settings: UserSettings;
  apiKey?: string;
  selectedModel?: string;
  chatParameters?: ChatParameters;
}

// Export/import types
export interface ExportData {
  version: string;
  exportDate: string;
  conversations: Conversation[];
  settings: UserSettings;
}

export interface ImportResult {
  success: boolean;
  conversationsImported: number;
  errors: string[];
}

// Utility types
export type MessageRole = ChatMessage['role'];
export type ConversationId = string;
export type MessageIndex = number;

// Default values
export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  fontSize: 'medium',
  showTokenCount: true,
  showCostEstimate: false,
  autoSave: true,
  maxConversations: 50,
  defaultModel: 'openai/gpt-3.5-turbo',
  defaultParameters: {
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    stream: true,
  },
  enableSounds: false,
  compactMode: false,
};
