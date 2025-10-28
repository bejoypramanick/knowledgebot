import { useState, useEffect, useRef, useCallback } from 'react';

interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  step?: string;
  message?: string;
  data?: {
    progress?: number;
    document_name?: string;
  };
  success?: boolean;
  document_key?: string;
  error?: string;
}

interface UseWebSocketOptions {
  endpoint?: string;
  autoConnect?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { endpoint, autoConnect = false } = options;
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async () => {
    if (!endpoint) {
      console.warn('WebSocket endpoint not provided');
      return;
    }

    try {
      const ws = new WebSocket(endpoint);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);

          if (data.type === 'connection') {
            setConnectionId(data.connectionId);
          } else if (data.action === 'progressUpdate') {
            // Handle progress updates from document processing
            console.log(`Progress update: ${data.data?.progress}% - ${data.message}`);
            setProgress(prev => [...prev, {
              type: 'progress',
              step: data.step,
              message: data.message,
              data: data.data
            } as ProgressUpdate]);
            setCurrentStep(data.step || '');
            setCurrentProgress(data.data?.progress || 0);
          } else if (data.action === 'processingComplete') {
            // Handle completion notification
            console.log('Processing completed:', data.success);
            setProgress(prev => [...prev, {
              type: 'complete',
              success: data.success,
              error: data.error
            } as ProgressUpdate]);
            setCurrentProgress(100);
            if (data.success) {
              setCurrentStep('completed');
            } else {
              setCurrentStep('error');
              setError(data.error || 'Processing failed');
            }
          } else if (data.action === 'error') {
            // Handle errors
            console.error('WebSocket error:', data.message);
            setError(data.message || 'An error occurred');
            setCurrentStep('error');
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error occurred');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionId(null);
        wsRef.current = null;
      };
    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setError('Failed to connect');
    }
  }, [endpoint]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionId(null);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress([]);
    setCurrentStep('');
    setCurrentProgress(0);
    setError(null);
  }, []);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log('WebSocket message sent:', message);
      return true;
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', message);
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoConnect && endpoint) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, endpoint, connect, disconnect]);

  return {
    connectionId,
    isConnected,
    progress,
    currentStep,
    currentProgress,
    error,
    connect,
    disconnect,
    resetProgress,
    sendMessage,
  };
};

