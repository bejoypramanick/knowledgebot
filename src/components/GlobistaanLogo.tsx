import React from 'react';
import { useTheme } from '@/hooks/use-theme';

interface GlobistaanLogoProps {
  size?: number;
  showText?: boolean;
}

export const GlobistaanLogo: React.FC<GlobistaanLogoProps> = ({ 
  size = 16,
  showText = false 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Colors: In dark mode, white circle with black G. In light mode, black circle with white G.
  const circleColor = isDark ? '#FFFFFF' : '#000000';
  const gColor = isDark ? '#000000' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* White/Black Circle */}
        <circle cx="12" cy="12" r="12" fill={circleColor} />
        
        {/* Stylized G - flowing calligraphic shape */}
        <path
          d="M12 5C8.13 5 5 8.13 5 12C5 15.87 8.13 19 12 19C14.5 19 16.6 17.7 17.8 15.8L16.2 14.2C15.3 15.6 13.8 16.5 12 16.5C9.52 16.5 7.5 14.48 7.5 12C7.5 9.52 9.52 7.5 12 7.5C13.8 7.5 15.3 8.4 16.2 9.8L17.8 8.2C16.6 6.3 14.5 5 12 5Z"
          fill={gColor}
        />
        
        {/* Horizontal stroke across middle */}
        <path
          d="M9 12H15V13H9V12Z"
          fill={gColor}
        />
        
        {/* Curved meridian lines wrapping around */}
        <path
          d="M4 8Q6 4 12 4Q18 4 20 8"
          stroke={gColor}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M20 16Q18 20 12 20Q6 20 4 16"
          stroke={gColor}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {showText && (
        <span 
          className="text-xs font-medium lowercase"
          style={{ color: textColor }}
        >
          globistaan
        </span>
      )}
    </div>
  );
};

