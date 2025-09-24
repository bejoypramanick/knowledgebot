import { NavLink } from "react-router-dom";
import { Settings, BarChart3, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const navItems = [
    {
      to: "/",
      label: "Chatbot Configuration",
      icon: Settings,
    },
    {
      to: "/performance",
      label: "Chatbot Performance", 
      icon: BarChart3,
    },
    {
      to: "/knowledge-base",
      label: "Knowledge-base Management",
      icon: Database,
    },
  ];

  return (
    <nav className="bg-gradient-primary border-b border-border/20 backdrop-blur-sm px-6 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            <Settings className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">Dashboard</h1>
        </div>
        
        <div className="flex space-x-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300",
                  "backdrop-blur-sm border border-white/10",
                  isActive
                    ? "bg-white/20 text-primary-foreground shadow-glow"
                    : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;