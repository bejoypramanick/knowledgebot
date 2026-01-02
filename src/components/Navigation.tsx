import { NavLink, useLocation } from "react-router-dom";
import { MessageCircle, Settings, BarChart3, Database, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

  return (
    <nav className={`flex-shrink-0 border-b mb-4 ${
      theme === 'light'
        ? 'border-gray-200 bg-gray-100'
        : 'border-gray-800 bg-black'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 gap-4">
          {/* Left: Logo and Navigation Items */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
            }`}>
              <Settings className={`h-4 w-4 ${
                theme === 'light' ? 'text-black' : 'text-white'
              }`} />
            </div>
            <h1 className={`text-lg sm:text-xl font-bold flex-shrink-0 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>Dashboard</h1>
            
            {/* Navigation Items */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide flex-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 text-sm whitespace-nowrap flex-shrink-0",
                      isActive
                        ? theme === 'light'
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "bg-gray-800 text-white font-medium"
                        : theme === 'light'
                          ? "text-gray-700 hover:bg-gray-100"
                          : "text-gray-300 hover:bg-gray-800"
                    )
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.shortLabel}</span>
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
                    : 'bg-gray-900 border-gray-700 hover:bg-gray-800 text-gray-200'
                }`}
                title="Clear all chats"
              >
                <Trash2 className="h-4 w-4 sm:mr-1" />
                {!isMobile && "Clear All"}
              </Button>
            )}
            <ThemeToggle />
            {showUploadButton && (
              <div className="hidden sm:block">
                <UploadDocumentButton />
              </div>
            )}
          </div>
        </div>
        {showUploadButton && isMobile && (
          <div className="pb-2">
            <UploadDocumentButton />
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;