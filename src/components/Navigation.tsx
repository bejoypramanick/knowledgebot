import { NavLink, useLocation } from "react-router-dom";
import { MessageCircle, Settings, BarChart3, Database, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/use-theme";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import UploadDocumentButton from "./UploadDocumentButton";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const { theme } = useTheme();
  
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

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Dashboard Header */}
      <nav className={`flex-shrink-0 border-b ${
        theme === 'light'
          ? 'border-gray-200 bg-gray-50'
          : 'border-gray-800 bg-black'
      }`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
            }`}>
              <Settings className={`h-4 w-4 ${
                theme === 'light' ? 'text-black' : 'text-white'
              }`} />
            </div>
            <h1 className={`text-lg sm:text-xl font-bold ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>Dashboard</h1>
          </div>
          
          {/* Menu Button */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={`h-9 w-9 ${
                  theme === 'light'
                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-white'
                }`}
                onClick={toggleMenu}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
        <SheetContent 
          side="left" 
          className={`w-80 p-0 ${
            theme === 'light' ? 'bg-white' : 'bg-gray-900'
          }`}
        >
          <div className={`h-full flex flex-col ${
            theme === 'light' ? 'bg-white' : 'bg-gray-900'
          }`}>
            {/* Header */}
            <div className={`flex items-center px-6 py-4 border-b ${
              theme === 'light' ? 'border-gray-200' : 'border-gray-700'
            }`}>
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
                }`}>
                  <Settings className={`h-4 w-4 ${
                    theme === 'light' ? 'text-black' : 'text-white'
                  }`} />
                </div>
                <h1 className={`text-lg font-bold ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>Dashboard</h1>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300",
                      isActive
                        ? theme === 'light'
                          ? "bg-gray-100 text-gray-900"
                          : "bg-gray-800 text-white"
                        : theme === 'light'
                          ? "text-gray-700 hover:bg-gray-50"
                          : "text-gray-300 hover:bg-gray-800"
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              ))}
              {showUploadButton && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <UploadDocumentButton />
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Navigation;