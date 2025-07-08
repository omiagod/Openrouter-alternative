import { Conversation, UserSettings, StorageData, ExportData, ImportResult, DEFAULT_SETTINGS } from '@/types/chat';

// Storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'openrouter_conversations',
  SETTINGS: 'openrouter_settings',
  API_KEY: 'openrouter_api_key',
  SELECTED_MODEL: 'openrouter_selected_model',
  CHAT_PARAMETERS: 'openrouter_chat_parameters',
} as const;

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Safe localStorage operations with error handling
function safeGetItem(key: string): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to get item from localStorage: ${key}`, error);
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to set item in localStorage: ${key}`, error);
    return false;
  }
}

function safeRemoveItem(key: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove item from localStorage: ${key}`, error);
    return false;
  }
}

// JSON serialization with error handling
function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback;
  }
}

function safeJSONStringify(data: unknown): string | null {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('Failed to stringify JSON:', error);
    return null;
  }
}

// Conversation management
export function saveConversations(conversations: Conversation[]): boolean {
  const json = safeJSONStringify(conversations);
  if (!json) {
    return false;
  }
  return safeSetItem(STORAGE_KEYS.CONVERSATIONS, json);
}

export function loadConversations(): Conversation[] {
  const json = safeGetItem(STORAGE_KEYS.CONVERSATIONS);
  if (!json) {
    return [];
  }

  const conversations = safeJSONParse<Conversation[]>(json, []);
  
  // Convert date strings back to Date objects
  return conversations.map(conv => ({
    ...conv,
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
  }));
}

export function saveConversation(conversation: Conversation): boolean {
  const conversations = loadConversations();
  const existingIndex = conversations.findIndex(c => c.id === conversation.id);
  
  if (existingIndex >= 0) {
    conversations[existingIndex] = conversation;
  } else {
    conversations.push(conversation);
  }
  
  return saveConversations(conversations);
}

export function deleteConversation(conversationId: string): boolean {
  const conversations = loadConversations();
  const filteredConversations = conversations.filter(c => c.id !== conversationId);
  return saveConversations(filteredConversations);
}

export function getConversation(conversationId: string): Conversation | null {
  const conversations = loadConversations();
  return conversations.find(c => c.id === conversationId) || null;
}

// Settings management
export function saveSettings(settings: UserSettings): boolean {
  const json = safeJSONStringify(settings);
  if (!json) {
    return false;
  }
  return safeSetItem(STORAGE_KEYS.SETTINGS, json);
}

export function loadSettings(): UserSettings {
  const json = safeGetItem(STORAGE_KEYS.SETTINGS);
  if (!json) {
    return DEFAULT_SETTINGS;
  }

  const settings = safeJSONParse<UserSettings>(json, DEFAULT_SETTINGS);
  
  // Merge with defaults to ensure all properties exist
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
}

// API key management
export function saveApiKey(apiKey: string): boolean {
  return safeSetItem(STORAGE_KEYS.API_KEY, apiKey);
}

export function loadApiKey(): string | null {
  return safeGetItem(STORAGE_KEYS.API_KEY);
}

export function clearApiKey(): boolean {
  return safeRemoveItem(STORAGE_KEYS.API_KEY);
}

// Model and parameters
export function saveSelectedModel(model: string): boolean {
  return safeSetItem(STORAGE_KEYS.SELECTED_MODEL, model);
}

export function loadSelectedModel(): string | null {
  return safeGetItem(STORAGE_KEYS.SELECTED_MODEL);
}

export function saveChatParameters(parameters: Record<string, unknown>): boolean {
  const json = safeJSONStringify(parameters);
  if (!json) {
    return false;
  }
  return safeSetItem(STORAGE_KEYS.CHAT_PARAMETERS, json);
}

export function loadChatParameters(): Record<string, unknown> {
  const json = safeGetItem(STORAGE_KEYS.CHAT_PARAMETERS);
  if (!json) {
    return {};
  }
  return safeJSONParse<Record<string, unknown>>(json, {});
}

// Bulk operations
export function loadAllData(): StorageData {
  return {
    conversations: loadConversations(),
    settings: loadSettings(),
    apiKey: loadApiKey() || undefined,
    selectedModel: loadSelectedModel() || undefined,
    chatParameters: loadChatParameters(),
  };
}

export function saveAllData(data: Partial<StorageData>): boolean {
  let success = true;

  if (data.conversations) {
    success = saveConversations(data.conversations) && success;
  }

  if (data.settings) {
    success = saveSettings(data.settings) && success;
  }

  if (data.apiKey) {
    success = saveApiKey(data.apiKey) && success;
  }

  if (data.selectedModel) {
    success = saveSelectedModel(data.selectedModel) && success;
  }

  if (data.chatParameters) {
    success = saveChatParameters(data.chatParameters) && success;
  }

  return success;
}

// Export/Import functionality
export function exportData(): ExportData {
  const data = loadAllData();
  
  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    conversations: data.conversations,
    settings: data.settings,
  };
}

export function importData(exportData: ExportData): ImportResult {
  const result: ImportResult = {
    success: false,
    conversationsImported: 0,
    errors: [],
  };

  try {
    // Validate export data structure
    if (!exportData.conversations || !Array.isArray(exportData.conversations)) {
      result.errors.push('Invalid export data: conversations not found or not an array');
      return result;
    }

    if (!exportData.settings || typeof exportData.settings !== 'object') {
      result.errors.push('Invalid export data: settings not found or not an object');
      return result;
    }

    // Import conversations
    const existingConversations = loadConversations();
    const importedConversations = [...existingConversations];
    
    for (const conversation of exportData.conversations) {
      try {
        // Validate conversation structure
        if (!conversation.id || !conversation.messages || !Array.isArray(conversation.messages)) {
          result.errors.push(`Invalid conversation: ${conversation.id || 'unknown'}`);
          continue;
        }

        // Convert date strings to Date objects
        const processedConversation: Conversation = {
          ...conversation,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
        };

        // Check if conversation already exists
        const existingIndex = importedConversations.findIndex(c => c.id === conversation.id);
        if (existingIndex >= 0) {
          importedConversations[existingIndex] = processedConversation;
        } else {
          importedConversations.push(processedConversation);
        }

        result.conversationsImported++;
      } catch (error) {
        result.errors.push(`Failed to import conversation ${conversation.id}: ${error}`);
      }
    }

    // Save imported conversations
    if (!saveConversations(importedConversations)) {
      result.errors.push('Failed to save imported conversations');
      return result;
    }

    // Import settings
    const mergedSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...exportData.settings,
    };

    if (!saveSettings(mergedSettings)) {
      result.errors.push('Failed to save imported settings');
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Import failed: ${error}`);
    return result;
  }
}

// Clear all data
export function clearAllData(): boolean {
  let success = true;

  Object.values(STORAGE_KEYS).forEach(key => {
    success = safeRemoveItem(key) && success;
  });

  return success;
}

// Storage quota management
export function getStorageUsage(): { used: number; available: number } | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }

    // Estimate available space (most browsers have ~5-10MB limit)
    const estimated = 5 * 1024 * 1024; // 5MB
    
    return {
      used,
      available: Math.max(0, estimated - used),
    };
  } catch {
    return null;
  }
}
