import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatState, 
  Conversation, 
  ChatMessage, 
  UserSettings, 
  DEFAULT_SETTINGS,
  ConversationSummary 
} from '@/types/chat';
import { 
  ChatParameters, 
  DEFAULT_PARAMETERS, 
  ModelInfo 
} from '@/types/openrouter';
import {
  saveConversation,
  loadConversations,
  deleteConversation as deleteStoredConversation,
  saveSettings,
  loadSettings,
  saveApiKey,
  loadApiKey,
  saveSelectedModel,
  loadSelectedModel,
  saveChatParameters,
  loadChatParameters,
} from '@/lib/storage';

interface ChatStore extends ChatState {
  // Actions
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean, messageId?: string) => void;
  setError: (error: string | null) => void;
  
  // Conversation management
  createConversation: (title?: string) => string;
  loadConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
  clearCurrentConversation: () => void;
  
  // Message management
  addMessage: (message: Omit<ChatMessage, 'role'> & { role?: ChatMessage['role'] }) => void;
  updateMessage: (messageIndex: number, content: string) => void;
  deleteMessage: (messageIndex: number) => void;
  retryMessage: (messageIndex: number) => void;
  
  // Model and parameters
  setSelectedModel: (model: string) => void;
  setChatParameters: (parameters: Partial<ChatParameters>) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  setModelsLoading: (loading: boolean) => void;
  
  // API key management
  setApiKey: (apiKey: string, isValid?: boolean) => void;
  validateApiKey: () => Promise<boolean>;
  
  // Settings
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  
  // Initialization
  initialize: () => void;
  
  // Utilities
  getConversationSummaries: () => ConversationSummary[];
  exportConversations: () => string;
  importConversations: (data: string) => boolean;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  currentConversation: null,
  conversations: [],
  isLoading: false,
  isStreaming: false,
  streamingMessageId: null,
  selectedModel: DEFAULT_PARAMETERS.temperature ? 'openai/gpt-3.5-turbo' : 'openai/gpt-3.5-turbo',
  chatParameters: DEFAULT_PARAMETERS,
  availableModels: [],
  modelsLoading: false,
  apiKey: null,
  apiKeyValid: false,
  settings: DEFAULT_SETTINGS,
  error: null,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setStreaming: (streaming, messageId) => set({ 
    isStreaming: streaming, 
    streamingMessageId: messageId || null 
  }),
  
  setError: (error) => set({ error }),

  // Conversation management
  createConversation: (title) => {
    const id = uuidv4();
    const now = new Date();
    const conversation: Conversation = {
      id,
      title: title || 'New Conversation',
      messages: [],
      model: get().selectedModel,
      parameters: get().chatParameters,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      currentConversation: conversation,
      conversations: [
        { 
          id: conversation.id,
          title: conversation.title,
          model: conversation.model,
          messageCount: 0,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        ...state.conversations,
      ],
    }));

    saveConversation(conversation);
    return id;
  },

  loadConversation: (conversationId) => {
    const conversations = loadConversations();
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (conversation) {
      set({ currentConversation: conversation });
    }
  },

  deleteConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter(c => c.id !== conversationId),
      currentConversation: state.currentConversation?.id === conversationId 
        ? null 
        : state.currentConversation,
    }));

    deleteStoredConversation(conversationId);
  },

  updateConversationTitle: (conversationId, title) => {
    set((state) => {
      const updatedConversations = state.conversations.map(c =>
        c.id === conversationId ? { ...c, title, updatedAt: new Date() } : c
      );

      let updatedCurrentConversation = state.currentConversation;
      if (state.currentConversation?.id === conversationId) {
        updatedCurrentConversation = {
          ...state.currentConversation,
          title,
          updatedAt: new Date(),
        };
        saveConversation(updatedCurrentConversation);
      }

      return {
        conversations: updatedConversations,
        currentConversation: updatedCurrentConversation,
      };
    });
  },

  clearCurrentConversation: () => {
    set({ currentConversation: null });
  },

  // Message management
  addMessage: (message) => {
    const fullMessage: ChatMessage = {
      role: message.role || 'user',
      content: message.content,
      name: message.name,
    };

    set((state) => {
      if (!state.currentConversation) {
        // Create a new conversation if none exists
        const id = get().createConversation();
        const newConversation = get().currentConversation;
        if (!newConversation) return state;

        const updatedConversation = {
          ...newConversation,
          messages: [fullMessage],
          updatedAt: new Date(),
        };

        saveConversation(updatedConversation);
        return { currentConversation: updatedConversation };
      }

      const updatedConversation = {
        ...state.currentConversation,
        messages: [...state.currentConversation.messages, fullMessage],
        updatedAt: new Date(),
      };

      // Auto-generate title from first user message
      if (updatedConversation.messages.length === 1 && fullMessage.role === 'user') {
        const title = fullMessage.content.slice(0, 50) + (fullMessage.content.length > 50 ? '...' : '');
        updatedConversation.title = title;
      }

      saveConversation(updatedConversation);

      // Update conversation summary
      const updatedConversations = state.conversations.map(c =>
        c.id === updatedConversation.id
          ? {
              ...c,
              title: updatedConversation.title,
              messageCount: updatedConversation.messages.length,
              lastMessage: fullMessage.content.slice(0, 100),
              updatedAt: updatedConversation.updatedAt,
            }
          : c
      );

      return {
        currentConversation: updatedConversation,
        conversations: updatedConversations,
      };
    });
  },

  updateMessage: (messageIndex, content) => {
    set((state) => {
      if (!state.currentConversation) return state;

      const updatedMessages = [...state.currentConversation.messages];
      if (messageIndex >= 0 && messageIndex < updatedMessages.length) {
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content,
        };

        const updatedConversation = {
          ...state.currentConversation,
          messages: updatedMessages,
          updatedAt: new Date(),
        };

        saveConversation(updatedConversation);
        return { currentConversation: updatedConversation };
      }

      return state;
    });
  },

  deleteMessage: (messageIndex) => {
    set((state) => {
      if (!state.currentConversation) return state;

      const updatedMessages = state.currentConversation.messages.filter(
        (_, index) => index !== messageIndex
      );

      const updatedConversation = {
        ...state.currentConversation,
        messages: updatedMessages,
        updatedAt: new Date(),
      };

      saveConversation(updatedConversation);
      return { currentConversation: updatedConversation };
    });
  },

  retryMessage: (messageIndex) => {
    // This would trigger a new API call with the same prompt
    // Implementation depends on how the chat API is called
    console.log('Retry message at index:', messageIndex);
  },

  // Model and parameters
  setSelectedModel: (model) => {
    set({ selectedModel: model });
    saveSelectedModel(model);
  },

  setChatParameters: (parameters) => {
    set((state) => {
      const updatedParameters = { ...state.chatParameters, ...parameters };
      saveChatParameters(updatedParameters);
      return { chatParameters: updatedParameters };
    });
  },

  setAvailableModels: (models) => {
    set({ availableModels: models });
  },

  setModelsLoading: (loading) => {
    set({ modelsLoading: loading });
  },

  // API key management
  setApiKey: (apiKey, isValid = false) => {
    set({ apiKey, apiKeyValid: isValid });
    if (apiKey) {
      saveApiKey(apiKey);
    }
  },

  validateApiKey: async () => {
    const { apiKey } = get();
    if (!apiKey) return false;

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const { valid } = await response.json();
      set({ apiKeyValid: valid });
      return valid;
    } catch {
      set({ apiKeyValid: false });
      return false;
    }
  },

  // Settings
  updateSettings: (settings) => {
    set((state) => {
      const updatedSettings = { ...state.settings, ...settings };
      saveSettings(updatedSettings);
      return { settings: updatedSettings };
    });
  },

  resetSettings: () => {
    set({ settings: DEFAULT_SETTINGS });
    saveSettings(DEFAULT_SETTINGS);
  },

  // Initialization
  initialize: () => {
    const conversations = loadConversations();
    const settings = loadSettings();
    const apiKey = loadApiKey();
    const selectedModel = loadSelectedModel();
    const chatParameters = loadChatParameters();

    const conversationSummaries: ConversationSummary[] = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      model: conv.model,
      messageCount: conv.messages.length,
      lastMessage: conv.messages[conv.messages.length - 1]?.content.slice(0, 100),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    set({
      conversations: conversationSummaries,
      settings,
      apiKey,
      selectedModel: selectedModel || DEFAULT_SETTINGS.defaultModel,
      chatParameters: { ...DEFAULT_PARAMETERS, ...chatParameters },
    });
  },

  // Utilities
  getConversationSummaries: () => {
    return get().conversations;
  },

  exportConversations: () => {
    const conversations = loadConversations();
    const settings = get().settings;
    
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      conversations,
      settings,
    };

    return JSON.stringify(exportData, null, 2);
  },

  importConversations: (data) => {
    try {
      const importData = JSON.parse(data);
      // Implementation would handle importing conversations
      // This is a simplified version
      console.log('Import data:', importData);
      return true;
    } catch {
      return false;
    }
  },
}));
