import React from 'react';
import { Avatar as RadixAvatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { chatbotConfig } from '@/config/chatbot.config';

interface AvatarProps {
  type: 'user' | 'bot';
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  isTyping?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-12 w-12 text-base',
};

export const Avatar: React.FC<AvatarProps> = ({
  type,
  size = 'md',
  showStatus = false,
  isTyping = false,
  className = '',
}) => {
  const config = type === 'user' ? chatbotConfig.avatar.user : chatbotConfig.avatar.bot;
  const sizeClass = sizeClasses[size];

  const renderAvatar = () => {
    if (config.type === 'image' && typeof config.value === 'string' && config.value.startsWith('http')) {
      return (
        <RadixAvatar className={`${sizeClass} ${className}`}>
          <AvatarImage src={config.value} alt={type} />
          <AvatarFallback className="bg-primary/20">
            {config.type === 'emoji' ? config.value : type === 'user' ? 'U' : 'B'}
          </AvatarFallback>
        </RadixAvatar>
      );
    }

    // Emoji or initials
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center font-medium ${className}`}
        style={{
          backgroundColor: config.backgroundColor || (type === 'user' ? '#4F46E5' : '#F3F4F6'),
          border: config.borderColor ? `2px solid ${config.borderColor}` : 'none',
        }}
      >
        {config.type === 'emoji' ? (
          <span className="text-lg">{config.value}</span>
        ) : (
          <span className="text-white">{config.value}</span>
        )}
      </div>
    );
  };

  return (
    <div className="relative inline-block">
      {renderAvatar()}
      {isTyping && (
        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse border-2 border-background" />
      )}
      {showStatus && !isTyping && (
        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
      )}
    </div>
  );
};

