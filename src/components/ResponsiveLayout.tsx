import React, { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTheme } from '@/hooks/use-theme';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface ResponsiveLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  sidebar?: ReactNode;
  showSidebar?: boolean;
  onSidebarToggle?: () => void;
  className?: string;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  header,
  sidebar,
  showSidebar = false,
  className = '',
}) => {
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  const bgColor = theme === 'light' ? 'bg-white' : 'bg-black';

  if (isMobile) {
    return (
      <div className={`h-screen flex flex-col overflow-hidden ${bgColor} ${className}`}>
        {/* Mobile Header */}
        {header && (
          <div className={`flex-shrink-0 border-b ${
            theme === 'light'
              ? 'border-gray-200 bg-white'
              : 'border-zinc-800 bg-black'
          }`}>
            <div className="flex items-center justify-between px-4 py-3 mt-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {sidebar && (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className={`h-9 w-9 ${
                        theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-800'
                      }`}>
                        <Menu className={`h-5 w-5 ${theme === 'light' ? 'text-black' : 'text-white'}`} />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className={`w-80 p-0 ${
                      theme === 'light' ? 'bg-white' : 'bg-zinc-900'
                    }`}>
                      {sidebar}
                    </SheetContent>
                  </Sheet>
                )}
                <div className="flex-1 min-w-0">{header}</div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Content */}
        <div className={`flex-1 overflow-hidden relative ${bgColor}`}>
          {children}
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className={`h-screen flex flex-col overflow-hidden ${bgColor} ${className}`}>
      {/* Desktop Header */}
      {header && (
        <div className={`flex-shrink-0 border-b ${
          theme === 'light'
            ? 'border-gray-200 bg-white'
            : 'border-zinc-800 bg-black'
        }`}>
          <div className="max-w-7xl mx-auto px-6 py-4 mt-2">
            {header}
          </div>
        </div>
      )}

      {/* Desktop Content with Optional Sidebar */}
      <div className={`flex-1 overflow-hidden flex ${bgColor}`}>
        {sidebar && showSidebar && (
          <aside className={`w-64 border-r flex-shrink-0 overflow-y-auto ${
            theme === 'light'
              ? 'border-gray-200 bg-gray-50'
              : 'border-zinc-800 bg-zinc-900'
          }`}>
            {sidebar}
          </aside>
        )}
        <main className={`flex-1 overflow-hidden ${bgColor}`}>
          <div className={`h-full max-w-4xl mx-auto ${bgColor}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
