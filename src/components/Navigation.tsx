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
    <nav className="bg-card border-b border-border px-6 py-4">
      <div className="flex space-x-8">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;