import React, { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTheme } from '@/hooks/use-theme';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

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
  onSidebarToggle,
  className = '',
}) => {
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  if (isMobile) {
    return (
      <div className={`h-screen flex flex-col overflow-hidden ${className}`}>
        {/* Mobile Header */}
        {header && (
          <div className={`flex-shrink-0 border-b ${
            theme === 'light'
              ? 'border-gray-200 bg-white'
              : 'border-gray-800 bg-black'
          }`}>
            <div className="flex items-center justify-between px-4 py-3 mt-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {sidebar && (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80 p-0">
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
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className={`h-screen flex flex-col overflow-hidden ${className}`}>
      {/* Desktop Header */}
      {header && (
        <div className={`flex-shrink-0 border-b ${
          theme === 'light'
            ? 'border-gray-200 bg-white'
            : 'border-gray-800 bg-black'
        }`}>
          <div className="max-w-7xl mx-auto px-6 py-4 mt-2">
            {header}
          </div>
        </div>
      )}

      {/* Desktop Content with Optional Sidebar */}
      <div className="flex-1 overflow-hidden flex">
        {sidebar && showSidebar && (
          <aside className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0 overflow-y-auto">
            {sidebar}
          </aside>
        )}
        <main className="flex-1 overflow-hidden">
          <div className="h-full max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

