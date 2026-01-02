import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  ExternalLink,
  MapPin,
  Eye,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Clock,
  Reply
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTheme } from '@/hooks/use-theme';
import { formatTimestampDDMMYYYY } from '@/lib/timezone-utils';
import { chatbotConfig } from '@/config/chatbot.config';
import { Avatar } from './Avatar';
import DocumentViewer from './DocumentViewer';

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
  metadata: Record<string, unknown>;
}

interface EnhancedChatMessageProps {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  sources?: DocumentSource[];
  onSourceClick?: (source: DocumentSource) => void;
  onReply?: (messageId: string, messageText: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  replyTo?: {
    id: string;
    text: string;
    sender: 'user' | 'bot';
  };
}

const EnhancedChatMessage: React.FC<EnhancedChatMessageProps> = ({
  id,
  text,
  sender,
  timestamp,
  sources = [],
  onSourceClick,
  onReply,
  onScrollToMessage,
  replyTo
}) => {
  const [showSources, setShowSources] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const displayTimestamp = formatTimestampDDMMYYYY(timestamp);
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  const handleSourceClick = (source: DocumentSource) => {
    setSelectedSource(source);
    setShowDocumentViewer(true);
    onSourceClick?.(source);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getElementTypeIcon = (elementType: string) => {
    const type = (elementType || '').toLowerCase();
    if (type.includes('title') || type.includes('heading')) return '📄';
    if (type.includes('table')) return '📊';
    if (type.includes('figure') || type.includes('image')) return '🖼️';
    if (type.includes('list')) return '📋';
    return '📝';
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getSimilarityBadgeVariant = (score: number) => {
    if (score >= 0.8) return 'default';
    if (score >= 0.6) return 'secondary';
    return 'outline';
  };


  return (
    <>
      <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
        <div className={`flex items-start gap-2 sm:gap-3 ${isMobile ? 'max-w-[85%]' : 'max-w-[70%]'} ${sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <Avatar 
            type={sender} 
            size="sm" 
            className="flex-shrink-0 mt-1" 
          />

          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
            theme === 'light'
              ? sender === 'user'
                ? 'bg-black text-white rounded-tr-sm'
                : 'bg-gray-200 text-black rounded-tl-sm'
              : sender === 'user'
                ? 'bg-gray-700 text-white rounded-tr-sm border border-gray-600'
                : 'bg-gray-700 text-white rounded-tl-sm'
            }`}>
            {/* Reply To Preview */}
            {replyTo && (
              <div 
                className={`mb-2 pb-2 border-l-4 pl-2 pr-2 py-1 rounded cursor-pointer transition-colors text-xs overflow-hidden ${
                  theme === 'light'
                    ? sender === 'user'
                      ? 'border-gray-400 bg-gray-50 hover:bg-gray-100'
                      : 'border-gray-400 bg-gray-50 hover:bg-gray-100'
                    : sender === 'user'
                      ? 'border-gray-500 bg-gray-800 hover:bg-gray-700'
                      : 'border-gray-500 bg-gray-800 hover:bg-gray-700'
                }`}
                onClick={() => onScrollToMessage?.(replyTo.id)}
                title="Click to jump to original message"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Reply className={`h-3 w-3 flex-shrink-0 ${
                    theme === 'light' ? 'text-gray-500' : 'text-gray-300'
                  }`} />
                  <span className={`font-medium truncate ${
                    theme === 'light' ? 'text-gray-700' : 'text-white'
                  }`}>{replyTo.sender === 'user' ? 'You' : chatbotConfig.welcome.botName}</span>
                </div>
                <p className={`mt-1 break-words line-clamp-2 overflow-hidden ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-200'
                }`}>{replyTo.text}</p>
              </div>
            )}
            <div className="flex items-start justify-between gap-2 group">
              <p className={`text-[15px] leading-relaxed flex-1 whitespace-pre-wrap break-words ${
                theme === 'light'
                  ? sender === 'user' ? 'text-white' : 'text-black'
                  : 'text-white'
              }`}>{text}</p>
              <div className="flex items-center gap-1">
                {onReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      theme === 'light'
                        ? 'hover:bg-gray-200'
                        : 'hover:bg-gray-700'
                    }`}
                    onClick={() => onReply(id, text)}
                    title="Reply to this message"
                  >
                    <Reply className={`h-3 w-3 ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-300'
                    }`} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                    theme === 'light'
                      ? 'hover:bg-gray-200'
                      : 'hover:bg-gray-700'
                  }`}
                  onClick={() => copyToClipboard(text)}
                >
                  {copiedText === text ? (
                    <Check className={`h-3 w-3 ${
                      theme === 'light' ? 'text-green-600' : 'text-green-400'
                    }`} />
                  ) : (
                    <Copy className={`h-3 w-3 ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-300'
                    }`} />
                  )}
                </Button>
              </div>
            </div>

            {/* Enhanced Sources Display */}
            {sources && sources.length > 0 && sender === 'bot' && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setShowSources(!showSources)}
                    >
                      {showSources ? (
                        <ChevronDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ChevronRight className="h-3 w-3 mr-1" />
                      )}
                      {sources.length} source{sources.length !== 1 ? 's' : ''}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setShowDocumentViewer(true)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {!isMobile && "View Documents"}
                    </Button>
                  </div>
                </div>

                {showSources && (
                  <div className="space-y-2">
                    {sources.map((source, index) => (
                      <Card
                        key={source.chunk_id || index}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSourceClick(source)}
                      >
                        <CardContent className="p-2 sm:p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className={`flex items-center gap-2 mb-1 ${isMobile ? 'flex-wrap' : ''}`}>
                                <span className="text-sm">
                                  {getElementTypeIcon(source.element_type || '')}
                                </span>
                                <span className="text-xs font-medium truncate">
                                  {source.original_filename}
                                </span>
                                <Badge
                                  variant={getSimilarityBadgeVariant(source.similarity_score)}
                                  className={`text-xs ${getSimilarityColor(source.similarity_score)}`}
                                >
                                  {Math.round(source.similarity_score * 100)}%
                                </Badge>
                              </div>

                              <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isMobile ? 'flex-wrap' : ''}`}>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Page {source.page_number}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {source.element_type || 'Unknown'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Level {source.hierarchy_level}
                                </Badge>
                              </div>

                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {source.content.length > (isMobile ? 80 : 100)
                                  ? `${source.content.substring(0, isMobile ? 80 : 100)}...`
                                  : source.content}
                              </p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={`flex items-center gap-1 mt-2 ${
              theme === 'light'
                ? sender === 'user' ? 'text-gray-400' : 'text-gray-500'
                : 'text-gray-400'
            }`}>
              <Clock className="h-3 w-3" />
              <span className="text-xs">
                {displayTimestamp}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {showDocumentViewer && (
        <DocumentViewer
          sources={sources}
          isOpen={showDocumentViewer}
          onClose={() => setShowDocumentViewer(false)}
          highlightedChunkId={selectedSource?.chunk_id}
        />
      )}
    </>
  );
};

export default EnhancedChatMessage;
