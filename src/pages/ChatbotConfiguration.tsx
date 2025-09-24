import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const ChatbotConfiguration = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chatbot Configuration</h1>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">Cancel</Button>
          <Button size="sm">Save Changes</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Automation</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Security</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">System prompt</span>
                <Switch />
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Chatbot Info</h4>
              <p className="text-xs text-muted-foreground">Configure your chatbot settings</p>
            </div>
          </CardContent>
        </Card>

        {/* Response Policy & Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Response Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Pre-defined parameters</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Default framework</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">The Conversational Agent</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">The human Problem Solver</span>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">The Identifier Agent</span>
                <Switch defaultChecked />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Data Management</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>User data security</p>
                <p>Storage user data</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Performance</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable monitoring</span>
                <Switch defaultChecked />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Knowledge Base</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-sync</span>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatbotConfiguration;