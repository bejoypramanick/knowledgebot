import React, { useRef, useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle } from 'lucide-react';
import { chatbotConfig } from '@/config/chatbot.config';

interface MultilineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

export const MultilineInput: React.FC<MultilineInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  isLoading = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [rows, setRows] = useState(chatbotConfig.input.minRows);

  const maxChars = chatbotConfig.input.maxCharacters;
  const enterToSend = chatbotConfig.input.enterToSend;

  useEffect(() => {
    setCharacterCount(value.length);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // Approximate line height
      const minHeight = chatbotConfig.input.minRows * lineHeight;
      const maxHeight = chatbotConfig.input.maxRows * lineHeight;
      
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
      
      // Calculate rows
      const calculatedRows = Math.ceil(newHeight / lineHeight);
      setRows(Math.min(Math.max(calculatedRows, chatbotConfig.input.minRows), chatbotConfig.input.maxRows));
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (enterToSend) {
        if (!e.shiftKey) {
          e.preventDefault();
          if (value.trim() && !isExceedingLimit) {
            onSend();
          }
        }
      } else {
        if (e.shiftKey) {
          e.preventDefault();
          if (value.trim() && !isExceedingLimit) {
            onSend();
          }
        }
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxChars) {
      onChange(newValue);
    }
  };

  const isExceedingLimit = characterCount > maxChars;
  const isNearLimit = characterCount >= maxChars * 0.9;
  const remainingChars = maxChars - characterCount;
  const exceededBy = characterCount > maxChars ? characterCount - maxChars : 0;

  const getCounterColor = () => {
    if (isExceedingLimit) return 'text-red-500';
    if (isNearLimit) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getBorderColor = () => {
    if (isExceedingLimit) return 'border-red-500 focus:border-red-500';
    if (isNearLimit) return 'border-yellow-500 focus:border-yellow-500';
    return 'border-border';
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={rows}
            className={`resize-none min-h-[44px] pr-12 ${getBorderColor()} ${
              isExceedingLimit ? 'focus-visible:ring-red-500' : ''
            }`}
            style={{ 
              maxHeight: `${chatbotConfig.input.maxRows * 24}px`,
              overflowY: value.length > 0 ? 'auto' : 'hidden'
            }}
          />
          {chatbotConfig.input.showCounter && (
            <div className={`absolute bottom-2 right-2 text-xs ${getCounterColor()}`}>
              {characterCount} / {maxChars}
            </div>
          )}
        </div>
        <Button
          onClick={onSend}
          disabled={disabled || isLoading || !value.trim() || isExceedingLimit}
          size="icon"
          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 shrink-0"
        >
          {isLoading ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isExceedingLimit && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span>
            Message exceeds limit by {exceededBy} character{exceededBy !== 1 ? 's' : ''}. 
            Please shorten your message.
          </span>
        </div>
      )}

      {chatbotConfig.input.showCounter && !isExceedingLimit && isNearLimit && (
        <div className="text-xs text-yellow-500">
          Approaching character limit ({remainingChars} remaining)
        </div>
      )}
    </div>
  );
};

