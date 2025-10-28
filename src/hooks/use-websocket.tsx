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
          } else if (data.type === 'progress') {
            setProgress(prev => [...prev, data as ProgressUpdate]);
            setCurrentStep(data.step || '');
            setCurrentProgress(data.data?.progress || 0);
          } else if (data.type === 'complete') {
            setProgress(prev => [...prev, data as ProgressUpdate]);
            setCurrentProgress(100);
            if (data.success) {
              setCurrentStep('completed');
            } else {
              setError(data.error || 'Processing failed');
            }
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
  };
};

