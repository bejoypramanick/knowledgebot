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
  Clock
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { formatTimestamp, getFullTimestamp } from '@/lib/timezone-utils';
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
  metadata: any;
}

interface EnhancedChatMessageProps {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  sources?: DocumentSource[];
  onSourceClick?: (source: DocumentSource) => void;
}

const EnhancedChatMessage: React.FC<EnhancedChatMessageProps> = ({
  id,
  text,
  sender,
  timestamp,
  sources = [],
  onSourceClick
}) => {
  const [showSources, setShowSources] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [displayTimestamp, setDisplayTimestamp] = useState<string>('');
  const isMobile = useIsMobile();

  // Update timestamp periodically for relative format
  useEffect(() => {
    const updateTimestamp = () => {
      setDisplayTimestamp(formatTimestamp(timestamp, { format: chatbotConfig.timestamps.format }));
    };

    updateTimestamp();
    const interval = setInterval(updateTimestamp, chatbotConfig.timestamps.updateInterval);

    return () => clearInterval(interval);
  }, [timestamp]);

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

          <div className={`px-4 py-3 rounded-2xl shadow-sm ${sender === 'user'
            ? 'bg-[#4F46E5] text-white rounded-tr-sm'
            : 'bg-[#F3F4F6] text-gray-900 rounded-tl-sm'
            }`}>
            <div className="flex items-start justify-between gap-2 group">
              <p className="text-[15px] leading-relaxed flex-1 whitespace-pre-wrap break-words">{text}</p>
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                  sender === 'user' ? 'hover:bg-white/20' : 'hover:bg-gray-200'
                }`}
                onClick={() => copyToClipboard(text)}
              >
                {copiedText === text ? (
                  <Check className={`h-3 w-3 ${sender === 'user' ? 'text-white' : 'text-green-600'}`} />
                ) : (
                  <Copy className={`h-3 w-3 ${sender === 'user' ? 'text-white/70' : 'text-gray-500'}`} />
                )}
              </Button>
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

            <div className={`flex items-center gap-1 mt-2 ${sender === 'user'
              ? 'text-white/70'
              : 'text-gray-500'
              }`}>
              <Clock className="h-3 w-3" />
              <span
                className="text-xs cursor-help"
                title={getFullTimestamp(timestamp)}
              >
                {displayTimestamp || formatTimestamp(timestamp, { format: chatbotConfig.timestamps.format })}
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
