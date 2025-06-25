
import React from "react"
import { useState, useEffect } from "react"
import { Logo } from "../common/Logo"

interface BackgroundWrapperProps {
  children: React.ReactNode
  rotationInterval?: number
  onLoadComplete?: (isLoaded: boolean) => void
}

const BackgroundWrapper: React.FC<BackgroundWrapperProps> = ({
  rotationInterval = 60000,
  children,
  onLoadComplete,
}) => {
  const images = [
    "https://cdn.builder.io/api/v1/image/assets/afc0e1e2dd7e48de8fbea7e3b2140291/161408f4cf8a8894ad00214910bbe3e48dc6baf203a8f7a6331334270ba30dc0?apiKey=afc0e1e2dd7e48de8fbea7e3b2140291&",
  ]

  const [backgroundImage, setBackgroundImage] = useState(images[0])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Create a new image to preload
    const img = new Image() 

    img.onload = () => {
      setIsLoaded(true)
      if (onLoadComplete) {
        onLoadComplete(true)
      }
    }

    img.src = backgroundImage

    // If the image is already cached, the onload event might not fire
    // So we check if the image is complete already
    if (img.complete) {
      setIsLoaded(true)
      if (onLoadComplete) {
        onLoadComplete(true)
      }
    }
  }, [backgroundImage, onLoadComplete])

  return (
    <div className="relative w-full min-h-screen">
      {/* Background layer */}
      <div
        className={`!absolute !top-0 left-0 w-full h-full min-h-screen transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Content layer */}
      <div className="relative z-10 w-full h-full">{children}</div>
      <div className="absolute bottom-2 right-2 w-16 h-16">
        {/* <Logo /> */}
        <img
        loading="lazy"
        src="assets/image.png"
        alt="Personal Sportsbook Logo"
        className="object-contain w-full aspect-square max-md:max-w-full"
        style={{maxWidth:'65vh',}}
      />
      </div>
    </div>
  )
}

export default BackgroundWrapper

