/**
 * KnowledgeBot - AI-Powered Knowledge Assistant
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 * 
 * PROPRIETARY SOFTWARE - See LICENSE file for terms and conditions.
 * Commercial use prohibited without explicit written permission.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, MoreHorizontal, Bot, Loader2, FileText, Layers, Calendar, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatbotAPI, ChatMessage, ChatResponse } from "@/lib/chatbot-api";
import { AWS_CONFIG } from "@/lib/aws-config";
import EnhancedChatMessage from "@/components/EnhancedChatMessage";
import DocumentViewer from "@/components/DocumentViewer";
import DocumentContextPanel from "@/components/DocumentContextPanel";
import DocumentPreview from "@/components/DocumentPreview";
import SourceHighlighter from "@/components/SourceHighlighter";
import StructureSearchPanel from "@/components/StructureSearchPanel";
import DocumentStructureViewer from "@/components/DocumentStructureViewer";

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

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  metadata?: {
    sources?: DocumentSource[];
    orderStatus?: any;
  };
}

const Chatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [apiClient] = useState(new ChatbotAPI(AWS_CONFIG.endpoints.websocket));
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initialize session and WebSocket connection on component mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const session = await apiClient.createChatSession();
        setSessionId(session.id);
        
        // Connect to WebSocket
        try {
          await apiClient.connect();
        } catch (error) {
          console.warn('WebSocket connection failed, will retry automatically:', error);
        }
        
        // Set up connection status handler
        apiClient.onConnectionChange((connected) => {
          setIsConnected(connected);
          if (!connected) {
            setError('Connection lost. Attempting to reconnect...');
          } else {
            setError(null);
          }
        });
        
        // Add welcome message
        const welcomeMessage: Message = {
          id: 'welcome',
          text: "Hello! I'm your AI assistant. How can I help you today?",
          sender: 'bot',
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      } catch (err) {
        console.error('Error initializing session:', err);
        setError('Failed to initialize chat session. Please refresh the page.');
      }
    };

    initializeSession();

    // Cleanup on unmount
    return () => {
      apiClient.disconnect();
    };
  }, [apiClient]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !sessionId || isLoading || !isConnected) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: newMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await apiClient.sendMessage(newMessage, sessionId);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        metadata: {
          sources: response.sources || []
        }
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Update all sources for document visualization
      if (response.sources && response.sources.length > 0) {
        setAllSources(prev => [...prev, ...response.sources]);
        
        // Set selected document ID if we have sources
        if (response.sources.length > 0 && !selectedDocumentId) {
          setSelectedDocumentId(response.sources[0].document_id);
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.response?.data?.message || 'Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error. Please try again or check your connection.",
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearAllChats = () => {
    setMessages([]);
    setAllSources([]);
    setSelectedSource(null);
    setSelectedDocumentId(null);
    setError(null);
    
    // Add welcome message back
    const welcomeMessage: Message = {
      id: 'welcome',
      text: "Hello! I'm your AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
  };

  return (
    <div className="h-full bg-gradient-secondary flex flex-col overflow-hidden">
      {/* Demo Only Banner */}
      <div className="bg-red-600 text-white py-1 px-3 text-xs font-bold flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">✗</span>
          <span>DEMO ONLY</span>
        </div>
        <div className="text-xs text-red-100 mt-0.5">
          NOT FOR PROD USE
        </div>
      </div>
      
      <div className="w-full flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-primary border-b border-border/20 backdrop-blur-sm px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-primary-foreground">Chat with Mr. Helpful</h1>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'}></div>
              </div>
            </div>
            {/* Document Visualization Controls */}
            <div className={`flex items-center gap-1 sm:gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllChats}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    title="View Sources"
                  >
                    <FileText className="h-4 w-4 sm:mr-1" />
                    {!isMobile && "View Sources"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowContextPanel(true)}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  title="Doc Structure"
                >
                  <Layers className="h-4 w-4 sm:mr-1" />
                  {!isMobile && "Doc Structure"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-4 sm:px-6 py-2 flex-shrink-0">
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          </div>
        )}

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((message, index) => (
            <EnhancedChatMessage
              key={message.id}
              id={message.id}
              text={message.text}
              sender={message.sender}
              timestamp={message.timestamp}
              sources={message.metadata?.sources}
              onSourceClick={(source) => {
                setSelectedSource(source);
                setShowDocumentPreview(true);
              }}
            />
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className={`flex items-start space-x-2 ${isMobile ? 'max-w-xs' : 'max-w-xs lg:max-w-md'}`}>
                <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/20 text-foreground">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Thinking...</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border/20 bg-card/50 backdrop-blur-sm p-3 sm:p-4 flex-shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-8 h-8 sm:w-10 sm:h-10 p-0 hover:bg-muted/50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isLoading ? "Please wait..." : "Type here..."}
              disabled={isLoading || !sessionId}
              className="flex-1 bg-background/50 border-border/20 focus:border-primary/50 disabled:opacity-50 text-sm sm:text-base"
            />
            <Button 
              onClick={handleSendMessage}
              size="sm" 
              disabled={isLoading || !newMessage.trim() || !sessionId}
              className="w-8 h-8 sm:w-10 sm:h-10 p-0 bg-gradient-primary border-0 shadow-glow hover:shadow-glow/80 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Demo Disclaimer */}
        <div className="bg-muted/30 border-t border-border/20 px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="text-center text-xs text-muted-foreground">
            <p className="mb-1">
              <strong>⚠️ Demo Notice:</strong> This is a demonstration version only.
            </p>
            <p>
              Not intended for production use. Features may be incomplete or unstable.
            </p>
          </div>
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
    </div>
  );
};

export default Chatbot;

