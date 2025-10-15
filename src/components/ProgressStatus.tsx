/**
 * ProgressStatus Component - Real-time processing status indicator
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Loader2, CheckCircle, AlertCircle, Clock, SkipForward } from 'lucide-react';

export interface ProgressStatus {
  id: string;
  type: 'progress' | 'error';
  message: string;
  phase: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed' | 'timeout' | 'skipped';
  timestamp: string;
  dismissible?: boolean;
}

interface ProgressStatusProps {
  status: ProgressStatus;
  onDismiss: (id: string) => void;
}

const ProgressStatusComponent: React.FC<ProgressStatusProps> = ({ status, onDismiss }) => {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'starting':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'timeout':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-yellow-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    if (status.type === 'error') {
      return 'border-red-200 bg-red-50';
    }
    
    switch (status.status) {
      case 'starting':
        return 'border-blue-200 bg-blue-50';
      case 'in_progress':
        return 'border-blue-200 bg-blue-50';
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
      case 'timeout':
        return 'border-red-200 bg-red-50';
      case 'skipped':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getPhaseDisplayName = (phase: string) => {
    const phaseMap: Record<string, string> = {
      'embedding_generation': 'Generating Embeddings',
      'vector_search': 'Vector Search',
      'graph_search': 'Knowledge Graph Search',
      'database_search': 'Database Search',
      'response_generation': 'Response Generation',
      'rag_search': 'RAG Search'
    };
    return phaseMap[phase] || phase;
  };

  const getStatusDisplayName = (status: string) => {
    const statusMap: Record<string, string> = {
      'starting': 'Starting',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'failed': 'Failed',
      'timeout': 'Timeout',
      'skipped': 'Skipped'
    };
    return statusMap[status] || status;
  };

  return (
    <Card className={`p-3 mb-2 ${getStatusColor()} transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-gray-900">
                {status.message}
              </span>
              <Badge 
                variant={status.type === 'error' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {getPhaseDisplayName(status.phase)}
              </Badge>
              <Badge 
                variant="outline"
                className="text-xs"
              >
                {getStatusDisplayName(status.status)}
              </Badge>
            </div>
            <div className="text-xs text-gray-500">
              {new Date(status.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        {status.dismissible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(status.id)}
            className="h-6 w-6 p-0 hover:bg-gray-200"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ProgressStatusComponent;
