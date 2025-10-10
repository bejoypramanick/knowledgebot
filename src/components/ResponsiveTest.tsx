/**
 * ResponsiveTest - Component to demonstrate responsive behavior
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 * 
 * PROPRIETARY SOFTWARE - See LICENSE file for terms and conditions.
 * Commercial use prohibited without explicit written permission.
 */

import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Monitor } from 'lucide-react';

const ResponsiveTest: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isMobile ? (
            <Smartphone className="h-5 w-5 text-blue-500" />
          ) : (
            <Monitor className="h-5 w-5 text-green-500" />
          )}
          Responsive Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current View:</span>
          <Badge variant={isMobile ? "secondary" : "default"}>
            {isMobile ? "Mobile" : "Desktop"}
          </Badge>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>Screen width: <span className="font-mono">{window.innerWidth}px</span></p>
          <p>Breakpoint: <span className="font-mono">{isMobile ? "< 768px" : "≥ 768px"}</span></p>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Responsive Features:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• {isMobile ? "Collapsible navigation menu" : "Full navigation bar"}</li>
            <li>• {isMobile ? "Icon-only buttons" : "Buttons with text labels"}</li>
            <li>• {isMobile ? "Compact message layout" : "Expanded message layout"}</li>
            <li>• {isMobile ? "Touch-optimized controls" : "Mouse-optimized controls"}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResponsiveTest;
