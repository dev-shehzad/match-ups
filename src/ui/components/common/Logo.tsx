import React from 'react';

interface LogoProps {

}

export const Logo: React.FC<LogoProps> = () => {
  return (
    
      <img
        loading="lazy"
        src="src/assets/image.png"
        alt="Personal Sportsbook Logo"
        className="object-contain w-full aspect-square max-md:max-w-full"
        style={{maxWidth:'65vh',}}
      />

     
  );
};