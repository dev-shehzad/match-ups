import React from 'react';

interface SpinnerProps {

}

export const Spinner: React.FC<SpinnerProps> = () => {
  return (
    
      <img
        loading="lazy"
        src="src/assets/spinner.png"
        alt="Personal Sportsbook Logo"
        className="object-contain w-full aspect-square max-md:max-w-full"
        style={{maxWidth:'65vh',}}
      />

     
  );
};