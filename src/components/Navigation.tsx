import { NavLink, useLocation } from "react-router-dom";
import { MessageCircle, Settings, BarChart3, Database, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import UploadDocumentButton from "./UploadDocumentButton";

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  
  // Show upload button only on knowledge-base page
  const showUploadButton = location.pathname === '/knowledge-base';
  
  const navItems = [
    {
      to: "/",
      label: "Chat with Mr. Helpful",
      icon: MessageCircle,
      shortLabel: "Chat",
    },
    {
      to: "/configuration",
      label: "Chatbot Configuration",
      icon: Settings,
      shortLabel: "Config",
    },
    {
      to: "/performance",
      label: "Chatbot Performance", 
      icon: BarChart3,
      shortLabel: "Performance",
    },
    {
      to: "/knowledge-base",
      label: "Knowledge-base Management",
      icon: Database,
      shortLabel: "Knowledge",
    },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-gradient-primary border-b border-border/20 backdrop-blur-sm px-4 sm:px-6 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            <Settings className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-primary-foreground">Dashboard</h1>
        </div>
        
        {/* Desktop Navigation */}
        {!isMobile && (
          <div className="flex items-center space-x-2">
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
            {showUploadButton && <UploadDocumentButton />}
          </div>
        )}

        {/* Mobile Menu Button and Upload */}
        {isMobile && (
          <div className="flex items-center space-x-2">
            {showUploadButton && <UploadDocumentButton />}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="text-primary-foreground hover:bg-white/10 p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Navigation Menu */}
      {isMobile && isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-gradient-primary border-b border-border/20 backdrop-blur-sm shadow-lg">
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300",
                    "backdrop-blur-sm border border-white/10",
                    isActive
                      ? "bg-white/20 text-primary-foreground shadow-glow"
                      : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;