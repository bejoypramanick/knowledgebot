export const AWS_CONFIG = {
  region: 'ap-south-1',
  endpoints: {
    // Your actual API Gateway endpoint
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



