import React, { useRef, useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle, Paperclip, X, FileText } from 'lucide-react';
import { chatbotConfig } from '@/config/chatbot.config';
import { useTheme } from '@/hooks/use-theme';

interface MultilineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  onFileSelect?: (files: FileList | null) => void;
  attachments?: File[];
  onRemoveAttachment?: (index: number) => void;
  replyTo?: {
    id: string;
    text: string;
    sender: 'user' | 'bot';
  } | null;
  onCancelReply?: () => void;
}

export const MultilineInput: React.FC<MultilineInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  isLoading = false,
  onFileSelect,
  attachments = [],
  onRemoveAttachment,
  replyTo,
  onCancelReply,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [rows, setRows] = useState(chatbotConfig.input.minRows);
  const { theme } = useTheme();

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

  const handleSendClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isLoading && value.trim() && !isExceedingLimit) {
      onSend();
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect?.(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`w-full space-y-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      {/* Reply Preview */}
      {replyTo && (
        <div className={`border rounded-lg p-2 flex items-start justify-between gap-2 ${
          theme === 'light'
            ? 'bg-gray-100 border-gray-200'
            : 'bg-zinc-800 border-zinc-700'
        }`}>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium mb-1 ${
              theme === 'light' ? 'text-black' : 'text-white'
            }`}>
              Replying to {replyTo.sender === 'user' ? 'you' : chatbotConfig.welcome.botName}
            </div>
            <p className={`text-xs truncate ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>{replyTo.text}</p>
          </div>
          {onCancelReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelReply}
              className={`h-6 w-6 p-0 shrink-0 ${
                theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-zinc-700'
              }`}
            >
              <X className={`h-3 w-3 ${theme === 'light' ? 'text-gray-500' : 'text-gray-300'}`} />
            </Button>
          )}
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm ${
                theme === 'light'
                  ? 'bg-gray-100 text-black'
                  : 'bg-zinc-800 text-white'
              }`}
            >
              <FileText className={`h-4 w-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`} />
              <span className="truncate max-w-[150px]">{file.name}</span>
              <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
              {onRemoveAttachment && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAttachment(index)}
                  className={`h-5 w-5 p-0 ${theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-zinc-700'}`}
                >
                  <X className={`h-3 w-3 ${theme === 'light' ? 'text-gray-500' : 'text-gray-300'}`} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* File Upload Button */}
        {onFileSelect && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              accept="*/*"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isLoading}
              className={`h-10 w-10 shrink-0 touch-manipulation ${
                theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-800'
              }`}
              title="Attach files"
            >
              <Paperclip className={`h-4 w-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`} />
            </Button>
          </>
        )}
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
            } ${
              theme === 'light' 
                ? 'bg-white text-black border-gray-200 placeholder:text-gray-400' 
                : 'bg-zinc-900 text-white border-zinc-700 placeholder:text-gray-500'
            }`}
            style={{ 
              maxHeight: `${chatbotConfig.input.maxRows * 24}px`,
              overflowY: value.length > 0 ? 'auto' : 'hidden',
              touchAction: 'manipulation'
            }}
          />
          {chatbotConfig.input.showCounter && (
            <div className={`absolute bottom-2 right-2 text-xs ${getCounterColor()}`}>
              {characterCount} / {maxChars}
            </div>
          )}
        </div>
        <Button
          onClick={handleSendClick}
          onTouchEnd={handleSendClick}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={disabled || isLoading || !value.trim() || isExceedingLimit}
          size="icon"
          type="button"
          className={`h-10 w-10 min-h-[44px] min-w-[44px] rounded-full shrink-0 touch-manipulation z-10 relative cursor-pointer disabled:opacity-50 ${
            theme === 'light'
              ? 'bg-black hover:bg-gray-800 active:bg-gray-900 text-white'
              : 'bg-white hover:bg-gray-200 active:bg-gray-300 text-black'
          }`}
          style={{ 
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {isLoading ? (
            <div className={`h-4 w-4 border-2 rounded-full animate-spin ${
              theme === 'light'
                ? 'border-white border-t-transparent'
                : 'border-black border-t-transparent'
            }`} />
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

