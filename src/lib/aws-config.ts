export const AWS_CONFIG = {
  region: 'ap-south-1',
  endpoints: {
    // WebSocket API Gateway endpoint
    websocket: import.meta.env.VITE_WEBSOCKET_URL || 'wss://a1kn0j91k8.execute-api.ap-south-1.amazonaws.com/prod',
    // Fallback HTTP API Gateway endpoint for non-chat operations
    apiGateway: import.meta.env.VITE_API_GATEWAY_URL || 'https://a1kn0j91k8.execute-api.ap-south-1.amazonaws.com/prod',
  },
  s3: {
    mainBucket: 'chatbot-storage-ap-south-1',
  },
  dynamodb: {
    conversationsTable: 'chatbot-conversations',
    knowledgeBaseTable: 'chatbot-knowledge-base',
    ordersTable: 'chatbot-orders',
  }
};



