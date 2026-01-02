import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { chatbotConfig } from '@/config/chatbot.config';
import { useTheme } from '@/hooks/use-theme';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

interface SuggestedQuestionsProps {
  messages: ChatMessage[];
  onQuestionClick: (question: string) => void;
  className?: string;
}

// Simple context analysis - in production, this could use AI
const generateSuggestions = (messages: ChatMessage[]): string[] => {
  if (!chatbotConfig.suggestedQuestions.enabled) {
    return [];
  }

  const recentMessages = messages.slice(-chatbotConfig.suggestedQuestions.contextWindow);
  const lastBotMessage = [...recentMessages].reverse().find(m => m.sender === 'bot');
  const lastUserMessage = [...recentMessages].reverse().find(m => m.sender === 'user');

  // Analyze context from recent messages
  const context = (lastBotMessage?.text || '').toLowerCase() + ' ' + (lastUserMessage?.text || '').toLowerCase();

  // Default suggestions
  const defaultSuggestions = [
    "Tell me more about this",
    "Can you provide more details?",
    "What else should I know?",
    "How does this work?",
  ];

  // Context-aware suggestions based on keywords
  if (context.includes('price') || context.includes('cost') || context.includes('pricing')) {
    return [
      "What's included in the pricing?",
      "Are there any discounts available?",
      "What payment methods do you accept?",
      "Can I get a custom quote?",
    ];
  }

  if (context.includes('service') || context.includes('feature')) {
    return [
      "What other services do you offer?",
      "How does this compare to alternatives?",
      "What are the benefits?",
      "Can you show me examples?",
    ];
  }

  if (context.includes('help') || context.includes('support') || context.includes('problem')) {
    return [
      "How can I contact support?",
      "What are common solutions?",
      "Is there a troubleshooting guide?",
      "Can you walk me through this?",
    ];
  }

  if (context.includes('document') || context.includes('file') || context.includes('upload')) {
    return [
      "What file formats are supported?",
      "How do I upload documents?",
      "Where are my documents stored?",
      "Can I search my documents?",
    ];
  }

  // Return default if no specific context
  return defaultSuggestions.slice(0, chatbotConfig.suggestedQuestions.count);
};

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  messages,
  onQuestionClick,
  className = '',
}) => {
  const suggestions = useMemo(() => {
    if (messages.length === 0) {
      return chatbotConfig.welcome.suggestedActions.slice(0, chatbotConfig.suggestedQuestions.count);
    }
    return generateSuggestions(messages);
  }, [messages]);

  if (suggestions.length === 0) {
    return null;
  }

  const { theme } = useTheme();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onQuestionClick(suggestion)}
          className={`text-xs sm:text-sm h-auto py-2 px-3 rounded-full transition-all animate-fade-in ${
            theme === 'light'
              ? 'bg-black text-white border-black hover:bg-gray-800'
              : 'bg-black text-white border-white hover:bg-gray-900'
          }`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <MessageCircle className="h-3 w-3 mr-1.5" />
          {suggestion}
        </Button>
      ))}
    </div>
  );
};

