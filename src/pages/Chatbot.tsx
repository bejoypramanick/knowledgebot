/**
 * KnowledgeBot - AI-Powered Knowledge Assistant
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 * 
 * PROPRIETARY SOFTWARE - See LICENSE file for terms and conditions.
 * Commercial use prohibited without explicit written permission.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Bot, Loader2, FileText, Layers, Trash2, ArrowDown, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";
import { ChatbotAPI, ChatResponse } from "@/lib/chatbot-api";
import { AWS_CONFIG } from "@/lib/aws-config";
import { chatbotConfig } from "@/config/chatbot.config";
import { retryWithBackoff, getRetryStatusMessage } from "@/lib/retry-utils";
import { notificationService } from "@/lib/notification-service";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import EnhancedChatMessage from "@/components/EnhancedChatMessage";
import { MultilineInput } from "@/components/MultilineInput";
import { WelcomeMessage } from "@/components/WelcomeMessage";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import DocumentViewer from "@/components/DocumentViewer";
import DocumentContextPanel from "@/components/DocumentContextPanel";
import DocumentPreview from "@/components/DocumentPreview";
import StructureSearchPanel from "@/components/StructureSearchPanel";
import DocumentStructureViewer from "@/components/DocumentStructureViewer";
import ProgressStatusComponent, { ProgressStatus } from "@/components/ProgressStatus";

interface DocumentSource {
  chunk_id?: string;
  document_id: string;
  source: string;
  s3_key: string;
  original_filename: string;
  page_number: number;
  element_type: string;
  hierarchy_level: number;
  similarity_score: number;
  content: string;
  metadata: any;
}

interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  url?: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  replyTo?: {
    id: string;
    text: string;
    sender: 'user' | 'bot';
  };
  attachments?: MessageAttachment[];
  metadata?: {
    sources?: DocumentSource[];
    orderStatus?: any;
  };
}

const Chatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; text: string; sender: 'user' | 'bot' } | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [apiClient] = useState(new ChatbotAPI(AWS_CONFIG.endpoints.websocket, AWS_CONFIG.endpoints.apiGateway));
  const [error, setError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<string>('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Document visualization state
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [showStructureSearch, setShowStructureSearch] = useState(false);
  const [showDocumentStructure, setShowDocumentStructure] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null);
  const [allSources, setAllSources] = useState<DocumentSource[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Progress status state
  const [progressStatuses, setProgressStatuses] = useState<ProgressStatus[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  // Infinite scroll state
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Request notification permission on mount
  useEffect(() => {
    if (chatbotConfig.notifications.enabled) {
      notificationService.requestPermission();
    }
  }, []);

  // Check scroll position for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      setShowScrollToBottom(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when messages change (only if near bottom)
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Infinite scroll handler
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    // In a real implementation, you would fetch older messages from your backend
    // For now, we'll simulate it
    setTimeout(() => {
      setIsLoadingMore(false);
      setHasMoreMessages(false); // Set to false when no more messages
    }, 1000);
  }, [isLoadingMore, hasMoreMessages]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: hasMoreMessages,
    loadMore: loadMoreMessages,
    threshold: chatbotConfig.infiniteScroll.threshold,
  });

  // Initialize session on component mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const session = await apiClient.createChatSession();
        setSessionId(session.id);
        setIsConnected(true);
      } catch (err) {
        console.error('Error initializing session:', err);
        setError('Failed to initialize chat session. Please refresh the page.');
      }
    };

    initializeSession();
  }, [apiClient]);

  const handleDismissProgress = (id: string) => {
    setProgressStatuses(prev => prev.filter(p => p.id !== id));
    if (progressStatuses.length === 1) {
      setShowProgress(false);
    }
  };

  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride || newMessage;
    if (!messageToSend.trim() || isLoading) return;

    const messageAttachments: MessageAttachment[] = attachments.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    }));

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageToSend,
      sender: 'user',
      timestamp: new Date().toISOString(),
      replyTo: replyToMessage || undefined,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    if (!messageOverride) {
      setNewMessage('');
      setReplyToMessage(null);
      setAttachments([]);
    }
    setIsLoading(true);
    setError(null);
    setRetryStatus('Sending...');

    // Clear previous progress statuses when starting new query
    setProgressStatuses([]);
    setShowProgress(true);

    // Use retry mechanism with exponential backoff
    let attemptCount = 0;
    const result = await retryWithBackoff(
      async () => {
        attemptCount++;
        setRetryStatus(getRetryStatusMessage(attemptCount, chatbotConfig.retry.maxAttempts));

        if (!sessionId) {
          const session = await apiClient.createChatSession();
          setSessionId(session.id);
        }

        return await apiClient.queryRAG(messageToSend, sessionId, 'hybrid');
      },
      {
        maxAttempts: chatbotConfig.retry.maxAttempts,
        initialDelay: chatbotConfig.retry.initialDelay,
        backoffMultiplier: chatbotConfig.retry.backoffMultiplier,
        maxDelay: chatbotConfig.retry.maxDelay,
      }
    );

    if (result.success && result.data) {
      const response = result.data;
      // Filter out unwanted text from bot response
      let cleanedResponse = response.response;
      // Remove the "targeted information" message
      cleanedResponse = cleanedResponse.replace(/\.\.\.?\s*and\s+I\s+can\s+provide\s+more\s+targeted\s+information!?/gi, '');
      cleanedResponse = cleanedResponse.replace(/\.\.\.?\s*and\s+I\s+can\s+provide\s+more\s+targeted\s+information\.?/gi, '');
      cleanedResponse = cleanedResponse.trim();
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: cleanedResponse,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        metadata: {
          sources: response.sources || []
        }
      };

      setMessages(prev => [...prev, botMessage]);

      // Show notification if enabled
      if (chatbotConfig.notifications.enabled) {
        notificationService.notify({
          title: chatbotConfig.welcome.botName,
          body: response.response.substring(0, 50) + (response.response.length > 50 ? '...' : ''),
          tag: botMessage.id,
        });
      }

      // Update all sources for document visualization
      if (response.sources && response.sources.length > 0) {
        setAllSources(prev => [...prev, ...response.sources]);

        if (response.sources.length > 0 && !selectedDocumentId) {
          setSelectedDocumentId(response.sources[0].document_id);
        }
      }

      setRetryStatus('');
    } else {
      console.error('Error sending message:', result.error);
      setError(result.error?.response?.data?.message || result.error?.message || 'Failed to send message. Please try again.');

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error. Please try again or check your connection.",
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setRetryStatus('Failed to send. Retry manually?');
    }

    setIsLoading(false);
  };

  const handleQuestionClick = async (question: string) => {
    // Automatically send the question
    await handleSendMessage(question);
  };

  const handleReply = (messageId: string, messageText: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyToMessage({
        id: messageId,
        text: messageText,
        sender: message.sender,
      });
      // Scroll to input area and ensure it's visible on mobile
      setTimeout(() => {
        const inputArea = document.querySelector('[data-input-area]') as HTMLElement;
        const textarea = document.querySelector('textarea') as HTMLElement;
        
        if (inputArea && isMobile) {
          // On mobile, scroll the entire page to show input area
          inputArea.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
          
          // Also scroll the messages container if needed
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        } else if (inputArea) {
          inputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Focus textarea after scroll completes
        setTimeout(() => {
          if (textarea) {
            textarea.focus();
            // On mobile, ensure textarea is visible after keyboard appears
            if (isMobile) {
              setTimeout(() => {
                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 400);
            }
          }
        }, 300);
      }, 100);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const validFiles = Array.from(files).filter(file => {
      // Accept all file types
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 50MB.`);
        return false;
      }
      return true;
    });

    setAttachments(prev => [...prev, ...validFiles]);
  };

  const handleClearAllChats = () => {
    setMessages([]);
    setAllSources([]);
    setSelectedSource(null);
    setSelectedDocumentId(null);
    setError(null);
    setReplyToMessage(null);
    setAttachments([]);
    notificationService.markAsRead();
  };

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScrollToMessage = (messageId: string) => {
    // Find the message element by data attribute
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a highlight effect
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const header = (
    <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-black" />
          </div>
        <div className="flex items-center space-x-2">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Chat with {chatbotConfig.welcome.botName}
          </h1>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} 
               title={isConnected ? 'Connected' : 'Disconnected'} />
        </div>
      </div>
      <div className={`flex items-center gap-1 sm:gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAllChats}
          className="bg-white border-gray-200 hover:bg-gray-50"
          title="Clear all chats"
        >
          <Trash2 className="h-4 w-4 sm:mr-1" />
          {!isMobile && "Clear All"}
        </Button>
        {allSources.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDocumentViewer(true)}
              className="bg-white border-gray-200 hover:bg-gray-50"
              title="View Sources"
            >
              <FileText className="h-4 w-4 sm:mr-1" />
              {!isMobile && "View Sources"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContextPanel(true)}
              className="bg-white border-gray-200 hover:bg-gray-50"
              title="Structure"
            >
              <Layers className="h-4 w-4 sm:mr-1" />
              {!isMobile && "Structure"}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStructureSearch(true)}
          className="bg-white border-gray-200 hover:bg-gray-50"
          title="Search"
        >
          <FileText className="h-4 w-4 sm:mr-1" />
          {!isMobile && "Search"}
        </Button>
        {selectedDocumentId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDocumentStructure(true)}
            className="bg-white border-gray-200 hover:bg-gray-50"
            title="Doc Structure"
          >
            <Layers className="h-4 w-4 sm:mr-1" />
            {!isMobile && "Doc Structure"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ResponsiveLayout header={header} className="bg-white">
      <div className="h-full flex flex-col overflow-hidden">
        {/* Error Message */}
        {error && (
          <div className="px-4 sm:px-6 py-2 flex-shrink-0">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {/* Retry Status */}
        {retryStatus && (
          <div className="px-4 sm:px-6 py-2 flex-shrink-0">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg flex items-center justify-between">
              <span>{retryStatus}</span>
              {retryStatus.includes('Retry manually') && (
                <Button size="sm" onClick={() => handleSendMessage()} variant="outline" className="border-yellow-300 hover:bg-yellow-100">
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Progress Status */}
        {showProgress && progressStatuses.length > 0 && (
          <div className="px-4 sm:px-6 py-2 flex-shrink-0">
            <div className="space-y-2">
              {progressStatuses.map((status) => (
                <ProgressStatusComponent
                  key={status.id}
                  status={status}
                  onDismiss={handleDismissProgress}
                />
              ))}
            </div>
          </div>
        )}

        {/* Chat History */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth"
          style={{
            paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined,
          }}
        >
          {/* Infinite scroll sentinel */}
          {hasMoreMessages && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isLoadingMore ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-sm text-muted-foreground">No more messages</div>
              )}
            </div>
          )}

          {/* Welcome Message */}
          {messages.length === 0 && (
            <WelcomeMessage onQuestionClick={handleQuestionClick} />
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div key={message.id} data-message-id={message.id}>
              <EnhancedChatMessage
                id={message.id}
                text={message.text}
                sender={message.sender}
                timestamp={message.timestamp}
                sources={message.metadata?.sources}
                replyTo={message.replyTo}
                onReply={handleReply}
                onScrollToMessage={handleScrollToMessage}
                onSourceClick={(source) => {
                  setSelectedSource(source);
                  setShowDocumentPreview(true);
                }}
              />
              {/* Display attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={`mt-2 flex flex-wrap gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        message.sender === 'user'
                          ? 'bg-white/30 text-white'
                          : 'bg-gray-100 border border-gray-200 text-black'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[200px]">{attachment.name}</span>
                        <span className="text-xs opacity-75">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Show suggested questions after bot's last message */}
              {message.sender === 'bot' && index === messages.length - 1 && (
                <div className="mt-3 ml-12 sm:ml-14">
                  <SuggestedQuestions
                    messages={messages}
                    onQuestionClick={handleQuestionClick}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className={`flex items-start space-x-2 ${isMobile ? 'max-w-[85%]' : 'max-w-[70%]'}`}>
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3 w-3 text-black" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    <p className="text-sm text-gray-900">Thinking...</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom FAB */}
        {showScrollToBottom && (
          <Button
            onClick={handleScrollToBottom}
            size="icon"
            className="fixed bottom-20 right-4 sm:right-6 h-12 w-12 rounded-full shadow-lg z-10 bg-black hover:bg-gray-800 text-white"
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        )}

        {/* Input Area */}
        <div
          data-input-area
          className="border-t border-gray-200 bg-white p-3 sm:p-4 flex-shrink-0 relative z-50"
          style={{
            paddingBottom: isMobile ? `calc(1rem + env(safe-area-inset-bottom))` : undefined,
            touchAction: 'manipulation',
          }}
        >
          <MultilineInput
            value={newMessage}
            onChange={setNewMessage}
            onSend={handleSendMessage}
            disabled={isLoading || !sessionId}
            placeholder={isLoading ? "Please wait..." : "Type your message..."}
            isLoading={isLoading}
            onFileSelect={handleFileUpload}
            attachments={attachments}
            onRemoveAttachment={(index) => setAttachments(prev => prev.filter((_, i) => i !== index))}
            replyTo={replyToMessage}
            onCancelReply={() => setReplyToMessage(null)}
          />
        </div>
      </div>

      {/* Document Visualization Components */}
      <DocumentViewer
        sources={allSources}
        isOpen={showDocumentViewer}
        onClose={() => setShowDocumentViewer(false)}
        highlightedChunkId={selectedSource?.chunk_id}
      />

      <DocumentContextPanel
        sources={allSources}
        selectedSource={selectedSource}
        onSourceSelect={(source) => {
          setSelectedSource(source);
          setShowDocumentPreview(true);
        }}
        isOpen={showContextPanel}
        onClose={() => setShowContextPanel(false)}
      />

      <DocumentPreview
        sources={allSources}
        selectedSource={selectedSource}
        onSourceSelect={setSelectedSource}
        isOpen={showDocumentPreview}
        onClose={() => setShowDocumentPreview(false)}
      />

      <StructureSearchPanel
        isOpen={showStructureSearch}
        onClose={() => setShowStructureSearch(false)}
        onSourceSelect={(source) => {
          setSelectedSource(source);
          setShowDocumentPreview(true);
        }}
        apiBaseUrl={AWS_CONFIG.endpoints.apiGateway}
      />

      <DocumentStructureViewer
        isOpen={showDocumentStructure}
        onClose={() => setShowDocumentStructure(false)}
        onSourceSelect={(source) => {
          setSelectedSource(source);
          setShowDocumentPreview(true);
        }}
        documentId={selectedDocumentId || ''}
        apiBaseUrl={AWS_CONFIG.endpoints.apiGateway}
      />
    </ResponsiveLayout>
  );
};

export default Chatbot;
