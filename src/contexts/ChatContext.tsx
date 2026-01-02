import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  onClearChats: (() => void) | null;
  setOnClearChats: (handler: (() => void) | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [onClearChats, setOnClearChats] = useState<(() => void) | null>(null);

  return (
    <ChatContext.Provider value={{ onClearChats, setOnClearChats }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

