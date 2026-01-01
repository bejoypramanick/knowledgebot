/**
 * KnowledgeBot - AI-Powered Knowledge Assistant
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 * 
 * PROPRIETARY SOFTWARE - See LICENSE file for terms and conditions.
 * Commercial use prohibited without explicit written permission.
 */

export interface ChatbotConfig {
  input: {
    maxCharacters: number;
    minRows: number;
    maxRows: number;
    showCounter: boolean;
    enterToSend: boolean; // true = Enter sends, Shift+Enter newline; false = opposite
  };
  retry: {
    maxAttempts: number;
    initialDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
  };
  welcome: {
    botName: string;
    message: string;
    suggestedActions: string[];
    showOnFirstVisit: boolean;
  };
  avatar: {
    user: {
      type: 'emoji' | 'image' | 'initials';
      value: string;
      backgroundColor?: string;
      borderColor?: string;
    };
    bot: {
      type: 'emoji' | 'image';
      value: string;
      backgroundColor?: string;
    };
  };
  timestamps: {
    format: 'relative' | 'absolute';
    updateInterval: number; // milliseconds
  };
  infiniteScroll: {
    initialLoad: number;
    loadMore: number;
    threshold: number; // pixels from top to trigger load
  };
  suggestedQuestions: {
    enabled: boolean;
    count: number;
    contextWindow: number; // number of messages to analyze
  };
}

const defaultConfig: ChatbotConfig = {
  input: {
    maxCharacters: 2000,
    minRows: 1,
    maxRows: 6,
    showCounter: true,
    enterToSend: true,
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
  },
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
  },
  welcome: {
    botName: "Mr. Helpful",
    message: "👋 Hi! I'm Mr. Helpful, your AI assistant. How can I help you today?",
    suggestedActions: [
      "Tell me about your services",
      "How does pricing work?",
      "Contact support",
      "What can you help me with?"
    ],
    showOnFirstVisit: true,
  },
  avatar: {
    user: {
      type: 'emoji',
      value: '👤',
      backgroundColor: '#4F46E5',
      borderColor: '#6366F1',
    },
    bot: {
      type: 'emoji',
      value: '🤖',
      backgroundColor: '#F3F4F6',
    },
  },
  timestamps: {
    format: 'relative',
    updateInterval: 60000, // 1 minute
  },
  infiniteScroll: {
    initialLoad: 20,
    loadMore: 20,
    threshold: 100,
  },
  suggestedQuestions: {
    enabled: true,
    count: 4,
    contextWindow: 5,
  },
};

// Load config from localStorage or use default
export const loadConfig = (): ChatbotConfig => {
  try {
    const stored = localStorage.getItem('chatbot-config');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultConfig, ...parsed };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return defaultConfig;
};

// Save config to localStorage
export const saveConfig = (config: ChatbotConfig): void => {
  try {
    localStorage.setItem('chatbot-config', JSON.stringify(config));
  } catch (error) {
    console.error('Error saving config:', error);
  }
};

// Get current config
export const chatbotConfig = loadConfig();

// Update specific config section
export const updateConfig = <K extends keyof ChatbotConfig>(
  section: K,
  updates: Partial<ChatbotConfig[K]>
): ChatbotConfig => {
  const newConfig = {
    ...chatbotConfig,
    [section]: {
      ...chatbotConfig[section],
      ...updates,
    },
  };
  saveConfig(newConfig);
  return newConfig;
};

