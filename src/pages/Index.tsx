// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Demo Only Banner */}
      <div className="bg-red-600 text-white py-1 px-3 text-xs font-bold">
        <div className="flex items-center gap-2">
          <span className="text-lg">✗</span>
          <span>DEMO ONLY</span>
        </div>
        <div className="text-xs text-red-100 mt-0.5">
          NOT FOR ORID USE
        </div>
      </div>
      
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Welcome to KnowledgeBot</h1>
          <p className="text-xl text-muted-foreground mb-6">Your AI-powered knowledge assistant</p>
          <div className="bg-muted/30 border border-border/20 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>⚠️ Demo Notice:</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              This is a demonstration version only. Not intended for production use. Features may be incomplete or unstable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
