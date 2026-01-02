import React, { useState, useEffect } from 'react';
import { Avatar } from './Avatar';
import { SuggestedQuestions } from './SuggestedQuestions';
import { chatbotConfig } from '@/config/chatbot.config';
import { useTheme } from '@/hooks/use-theme';

interface WelcomeMessageProps {
  onQuestionClick: (question: string) => void;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  onQuestionClick,
}) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [isTyping, setIsTyping] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    // Check if this is first visit
    const hasVisited = localStorage.getItem('chatbot-has-visited');
    
    if (!hasVisited && chatbotConfig.welcome.showOnFirstVisit) {
      // Show welcome after a short delay
      setTimeout(() => {
        setShowWelcome(true);
        // Simulate typing indicator
        setTimeout(() => {
          setIsTyping(false);
        }, 1500);
      }, 500);
      
      localStorage.setItem('chatbot-has-visited', 'true');
    } else {
      setIsTyping(false);
    }
  }, []);

  if (!showWelcome && !chatbotConfig.welcome.showOnFirstVisit) {
    return null;
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-[70%]">
        <Avatar type="bot" size="md" isTyping={isTyping} />
        <div className={`px-4 py-3 rounded-2xl ${
          theme === 'light'
            ? 'bg-gray-200 text-black rounded-tl-sm'
            : 'bg-gray-700 text-white rounded-tl-sm'
        }`}>
          {isTyping ? (
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className={`h-2 w-2 rounded-full animate-bounce ${
                  theme === 'light' ? 'bg-gray-400' : 'bg-gray-500'
                }`} style={{ animationDelay: '0ms' }} />
                <div className={`h-2 w-2 rounded-full animate-bounce ${
                  theme === 'light' ? 'bg-gray-400' : 'bg-gray-500'
                }`} style={{ animationDelay: '150ms' }} />
                <div className={`h-2 w-2 rounded-full animate-bounce ${
                  theme === 'light' ? 'bg-gray-400' : 'bg-gray-500'
                }`} style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            <>
              <p className={`text-sm sm:text-base mb-3 leading-relaxed ${
                theme === 'light' ? 'text-black' : 'text-white'
              }`}>
                {chatbotConfig.welcome.message}
              </p>
              <SuggestedQuestions
                messages={[]}
                onQuestionClick={onQuestionClick}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

