// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Development Banner */}
      <div className="bg-amber-500 text-amber-900 text-center py-2 px-4 text-sm font-medium">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-amber-700 rounded-full animate-pulse"></div>
          <span>🚧 In Development - This is a prototype version</span>
        </div>
      </div>
      
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Welcome to KnowledgeBot</h1>
          <p className="text-xl text-muted-foreground mb-6">Your AI-powered knowledge assistant</p>
          <div className="bg-muted/30 border border-border/20 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>⚠️ Development Notice:</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              This application is currently in active development. Please do not use this as a production application. Features may be incomplete or unstable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
