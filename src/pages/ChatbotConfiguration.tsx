import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const ChatbotConfiguration = () => {
  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Chatbot Configuration</h1>
            <p className="text-muted-foreground">Configure your AI assistant settings and behavior</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" size="sm" className="backdrop-blur-sm">Cancel</Button>
            <Button size="sm" className="bg-gradient-primary border-0 shadow-glow">Save Changes</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admin Settings */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
                <span>Admin Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm font-medium">Automation</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm font-medium">Security</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm font-medium">System prompt</span>
                  <Switch />
                </div>
              </div>
              
              <Separator className="bg-border/30" />
              
              <div className="space-y-3 p-4 rounded-lg bg-gradient-accent/10">
                <h4 className="text-sm font-semibold text-foreground">Chatbot Info</h4>
                <p className="text-xs text-muted-foreground">Configure your chatbot settings and personality</p>
              </div>
            </CardContent>
          </Card>

          {/* Response Policy & Data Management */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
                <span>Response Policy</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm">Pre-defined parameters</span>
                  <Badge variant="secondary" className="bg-primary/20 text-primary-foreground">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm">Default framework</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm">The Conversational Agent</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm">The human Problem Solver</span>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <span className="text-sm">The Identifier Agent</span>
                  <Switch defaultChecked />
                </div>
              </div>

              <Separator className="bg-border/30" />

              <div className="p-4 rounded-lg bg-gradient-accent/10">
                <h4 className="text-sm font-semibold mb-3 text-foreground">Data Management</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• User data security protocols</p>
                  <p>• Storage optimization settings</p>
                  <p>• Privacy compliance checks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications & Performance */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
                <span>System Controls</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gradient-accent/10">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">Notifications</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Email alerts</span>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Push notifications</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gradient-accent/10">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">Performance</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Enable monitoring</span>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gradient-accent/10">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">Knowledge Base</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-sync</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatbotConfiguration;