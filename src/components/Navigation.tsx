import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MessageCircle, Settings, BarChart3, Database, Trash2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";
import { useChatContext } from "@/contexts/ChatContext";
import { ThemeToggle } from "./ThemeToggle";
import UploadDocumentButton from "./UploadDocumentButton";

const Navigation = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { theme } = useTheme();
  const { onClearChats } = useChatContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Show upload button only on knowledge-base page
  const showUploadButton = location.pathname === '/knowledge-base';
  const isChatPage = location.pathname === '/';
  
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

  // Mobile Navigation with Collapsible Side Menu
  if (isMobile) {
    return (
      <nav className={`flex-shrink-0 border-b ${
        theme === 'light'
          ? 'border-gray-200 bg-gray-50'
          : 'border-zinc-800 bg-black'
      }`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Menu Button and Title */}
            <div className="flex items-center gap-3">
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 ${
                      theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-zinc-800'
                    }`}
                  >
                    <Menu className={`h-5 w-5 ${theme === 'light' ? 'text-black' : 'text-white'}`} />
                  </Button>
                </SheetTrigger>
                <SheetContent 
                  side="left" 
                  className={`w-72 p-0 ${
                    theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <SheetHeader className={`p-4 border-b ${
                    theme === 'light' ? 'border-gray-200' : 'border-zinc-800'
                  }`}>
                    <SheetTitle className={`flex items-center gap-2 ${
                      theme === 'light' ? 'text-black' : 'text-white'
                    }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        theme === 'light' ? 'bg-gray-100' : 'bg-zinc-800'
                      }`}>
                        <Settings className={`h-4 w-4 ${theme === 'light' ? 'text-black' : 'text-white'}`} />
                      </div>
                      Dashboard
                    </SheetTitle>
                  </SheetHeader>
                  
                  {/* Navigation Items */}
                  <div className="p-2">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMenuOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1",
                            isActive
                              ? theme === 'light'
                                ? "bg-gray-100 text-black font-medium"
                                : "bg-zinc-800 text-white font-medium"
                              : theme === 'light'
                                ? "text-gray-700 hover:bg-gray-50"
                                : "text-gray-300 hover:bg-zinc-800"
                          )
                        }
                      >
                        <item.icon className={`h-5 w-5 ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>

                  {/* Actions in Menu */}
                  <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${
                    theme === 'light' ? 'border-gray-200 bg-white' : 'border-zinc-800 bg-zinc-900'
                  }`}>
                    <div className="flex flex-col gap-2">
                      {isChatPage && onClearChats && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onClearChats();
                            setIsMenuOpen(false);
                          }}
                          className={`w-full justify-start ${
                            theme === 'light'
                              ? 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                              : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-200'
                          }`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All Chats
                        </Button>
                      )}
                      {showUploadButton && (
                        <div onClick={() => setIsMenuOpen(false)}>
                          <UploadDocumentButton />
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              
              <h1 className={`text-lg font-bold ${
                theme === 'light' ? 'text-gray-900' : 'text-white'
              }`}>Dashboard</h1>
            </div>

            {/* Right: Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </nav>
    );
  }

  // Desktop Navigation
  return (
    <nav className={`flex-shrink-0 border-b ${
      theme === 'light'
        ? 'border-gray-200 bg-gray-50'
        : 'border-zinc-800 bg-black'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 gap-4">
          {/* Left: Logo and Navigation Items */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              theme === 'light' ? 'bg-gray-100' : 'bg-zinc-800'
            }`}>
              <Settings className={`h-4 w-4 ${
                theme === 'light' ? 'text-black' : 'text-white'
              }`} />
            </div>
            <h1 className={`text-xl font-bold flex-shrink-0 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>Dashboard</h1>
            
            {/* Navigation Items */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm whitespace-nowrap flex-shrink-0",
                      isActive
                        ? theme === 'light'
                          ? "bg-gray-200 text-black font-medium"
                          : "bg-zinc-800 text-white font-medium"
                        : theme === 'light'
                          ? "text-gray-700 hover:bg-gray-100"
                          : "text-gray-300 hover:bg-zinc-800"
                    )
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isChatPage && onClearChats && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearChats}
                className={`${
                  theme === 'light'
                    ? 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                    : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-200'
                }`}
                title="Clear all chats"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <ThemeToggle />
            {showUploadButton && <UploadDocumentButton />}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
