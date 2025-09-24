import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Filter, FileText, Database as DatabaseIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const knowledgeBaseData = [
  {
    id: 1,
    name: "Getting Started Guide",
    category: "Documentation",
    lastUpdated: "2024-01-15",
    status: "Active",
    author: "Admin"
  },
  {
    id: 2,
    name: "Troubleshooting FAQ",
    category: "Support",
    lastUpdated: "2024-01-10",
    status: "Active", 
    author: "Support Team"
  },
  {
    id: 3,
    name: "API Documentation",
    category: "Technical",
    lastUpdated: "2024-01-08",
    status: "Draft",
    author: "Dev Team"
  },
  {
    id: 4,
    name: "User Manual v2.0",
    category: "Documentation",
    lastUpdated: "2024-01-05",
    status: "Active",
    author: "Product Team"
  },
  {
    id: 5,
    name: "Security Guidelines",
    category: "Policy",
    lastUpdated: "2024-01-03",
    status: "Active",
    author: "Security Team"
  },
];

const KnowledgeBaseManagement = () => {
  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge-base Management</h1>
            <p className="text-muted-foreground">Manage your AI assistant's knowledge and training data</p>
          </div>
          <Button className="bg-gradient-primary border-0 shadow-glow">
            <Plus className="h-4 w-4 mr-2" />
            Add New Entry
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search knowledge base articles..." 
                  className="pl-10 bg-muted/30 border-border/20 focus:border-primary/50"
                />
              </div>
              <Button variant="outline" size="sm" className="backdrop-blur-sm border-border/20">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Base Table */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-foreground flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
              <span>Knowledge Base Articles</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/20 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/50">
                    <TableHead className="text-foreground font-semibold">Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Category</TableHead>
                    <TableHead className="text-foreground font-semibold">Last Updated</TableHead>
                    <TableHead className="text-foreground font-semibold">Author</TableHead>
                    <TableHead className="text-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knowledgeBaseData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span>{item.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.lastUpdated}</TableCell>
                      <TableCell className="text-muted-foreground">{item.author}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.status === "Active" ? "default" : "secondary"}
                          className={item.status === "Active" 
                            ? "bg-green-500/20 text-green-500 border-green-500/20" 
                            : "bg-yellow-500/20 text-yellow-500 border-yellow-500/20"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-primary opacity-10 rounded-full -mr-8 -mt-8"></div>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <DatabaseIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">25</div>
              <div className="text-sm text-muted-foreground">Total Articles</div>
            </CardContent>
          </Card>
          
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-accent opacity-10 rounded-full -mr-8 -mt-8"></div>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <FileText className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">18</div>
              <div className="text-sm text-muted-foreground">Active Articles</div>
            </CardContent>
          </Card>
          
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-primary opacity-10 rounded-full -mr-8 -mt-8"></div>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-yellow-500/20 rounded-xl">
                  <Edit className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">7</div>
              <div className="text-sm text-muted-foreground">Draft Articles</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManagement;