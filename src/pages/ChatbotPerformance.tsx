import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Users, Clock, Target, ArrowUp, Activity } from "lucide-react";

const performanceData = [
  { month: 'Jan', interactions: 980 },
  { month: 'Feb', interactions: 1100 },
  { month: 'Mar', interactions: 1350 },
  { month: 'Apr', interactions: 1200 },
  { month: 'May', interactions: 1450 },
  { month: 'Jun', interactions: 1245 },
];

const satisfactionData = [
  { day: 'Mon', score: 4.2 },
  { day: 'Tue', score: 4.5 },
  { day: 'Wed', score: 3.8 },
  { day: 'Thu', score: 4.1 },
  { day: 'Fri', score: 4.7 },
  { day: 'Sat', score: 4.3 },
  { day: 'Sun', score: 4.0 },
];

const ChatbotPerformance = () => {
  return (
    <div className="h-full bg-gradient-secondary overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Chatbot Performance</h1>
            <p className="text-muted-foreground">Monitor your AI assistant's performance and user engagement</p>
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">
            <Activity className="h-4 w-4 text-primary animate-glow" />
            <span className="text-sm font-medium text-primary">Live Monitoring</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-primary opacity-10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Interactions</p>
                  <p className="text-2xl font-bold text-foreground">1,245</p>
                  <div className="flex items-center mt-2">
                    <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500 font-medium">+12.5%</span>
                  </div>
                </div>
                <div className="p-3 bg-primary/20 rounded-xl">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-accent opacity-10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Average Engagement</p>
                  <p className="text-2xl font-bold text-foreground">14<span className="text-sm text-muted-foreground">min</span></p>
                  <div className="flex items-center mt-2">
                    <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500 font-medium">+8.2%</span>
                  </div>
                </div>
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-primary opacity-10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Deflection Rate</p>
                  <p className="text-2xl font-bold text-foreground">80<span className="text-sm text-muted-foreground">%</span></p>
                  <div className="flex items-center mt-2">
                    <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500 font-medium">+5.1%</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-accent opacity-10 rounded-full -mr-10 -mt-10"></div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                  <p className="text-2xl font-bold text-foreground">99.9<span className="text-sm text-muted-foreground">%</span></p>
                  <div className="flex items-center mt-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-glow"></div>
                    <span className="text-xs text-green-500 font-medium">Operational</span>
                  </div>
                </div>
                <div className="p-3 bg-orange-500/20 rounded-xl">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Interactions Chart */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
                <span>Total Interactions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Bar dataKey="interactions" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Satisfaction */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
                <span>User Satisfaction Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={satisfactionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-6 flex justify-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-xs text-muted-foreground">Excellent (4.5-5.0)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-xs text-muted-foreground">Good (3.5-4.4)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-xs text-muted-foreground">Poor (0-3.4)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPerformance;