import React from 'react';
import { useTheme } from '@/hooks/use-theme';

interface GlobistaanLogoProps {
  size?: number;
}

export const GlobistaanLogo: React.FC<GlobistaanLogoProps> = ({ 
  size = 16
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Colors based on Chatbase reference: circle is the opposite of background
  // Dark mode: white circle on dark background
  // Light mode: dark circle on light background
  const circleColor = isDark ? '#FFFFFF' : '#18181B';
  const strokeColor = isDark ? '#18181B' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Circle background */}
      <circle cx="50" cy="50" r="48" fill={circleColor} />
      
      {/* Globe horizontal line (equator) */}
      <ellipse 
        cx="50" 
        cy="50" 
        rx="35" 
        ry="12" 
        stroke={strokeColor} 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Globe vertical arc */}
      <ellipse 
        cx="50" 
        cy="50" 
        rx="12" 
        ry="35" 
        stroke={strokeColor} 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Outer circle */}
      <circle 
        cx="50" 
        cy="50" 
        r="35" 
        stroke={strokeColor} 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Stylized 'G' - the flowing cursive G that wraps around */}
      <path
        d="M65 45 C65 32 55 22 42 22 C28 22 18 35 18 50 C18 65 28 78 42 78 C55 78 63 70 65 58 L50 58 L50 52 L72 52 C72 52 72 55 72 58 C70 75 58 85 42 85 C22 85 10 68 10 50 C10 32 22 15 42 15 C60 15 72 28 72 45 L65 45"
        fill={strokeColor}
      />
    </svg>
  );
};
