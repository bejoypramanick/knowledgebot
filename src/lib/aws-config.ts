export const AWS_CONFIG = {
  region: 'ap-south-1',
  endpoints: {
    // Microservices API Gateway endpoint
    apiGateway: import.meta.env.VITE_API_GATEWAY_URL || 'https://your-microservices-api-gateway-url.execute-api.ap-south-1.amazonaws.com/dev',
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



