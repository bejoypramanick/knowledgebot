import React from 'react';
import { useTheme } from '@/hooks/use-theme';
import { GlobistaanLogo } from './GlobistaanLogo';

export const PoweredBy: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className={`flex items-center justify-center py-2 px-4 ${
      theme === 'light' ? 'bg-white' : 'bg-black'
    }`}>
      <div className={`flex items-center gap-2 text-xs ${
        theme === 'light' ? 'text-gray-500' : 'text-gray-400'
      }`}>
        <GlobistaanLogo size={16} />
        <span>Powered by Globistaan</span>
      </div>
    </div>
  );
};

