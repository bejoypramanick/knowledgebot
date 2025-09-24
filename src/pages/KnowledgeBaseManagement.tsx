import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Filter } from "lucide-react";
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge-base Management</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add New Entry
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search knowledge base..." className="pl-10" />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Base Table */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {knowledgeBaseData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.category}</Badge>
                  </TableCell>
                  <TableCell>{item.lastUpdated}</TableCell>
                  <TableCell>{item.author}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={item.status === "Active" ? "default" : "secondary"}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">25</div>
            <div className="text-sm text-muted-foreground">Total Articles</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">18</div>
            <div className="text-sm text-muted-foreground">Active Articles</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">7</div>
            <div className="text-sm text-muted-foreground">Draft Articles</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KnowledgeBaseManagement;