import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundWrapper from "../components/layout/Background";
import React from "react";

// Set splash screen styles
if (typeof window !== "undefined") {
  //@ts-ignore
  window.__IN_SPLASH_SCREEN__ = true;
  const style = document.createElement("style");
  style.id = "splash-screen-style";
  style.innerHTML = `
    body[data-in-splash-screen="true"] button {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
  document.body.setAttribute("data-in-splash-screen", "true");
}

function SplashScreen() {
  const [logoSrc, setLogoSrc] = useState<string>("assets/image.png"); // Fallback path
  const [logoLoaded, setLogoLoaded] = useState<boolean>(false);
  const [tagline] = useState<string>("Your personal Sportsbook.");
  const navigate = useNavigate();

  useEffect(() => {
    const loadLogo = async () => {
      try {
        if (window.electron?.loadImage) {
          const result = await window.electron.loadImage("image.png");
  //@ts-ignore

          if (result.success) {
            console.log("Successfully loaded logo image");
  //@ts-ignore

            setLogoSrc(result.data); // Base64 string
            setLogoLoaded(true);
          } else {
  //@ts-ignore

            console.error("Failed to load logo image:", result.error);
            setLogoSrc("assets/image.png"); // Fallback to renderer public asset
            setLogoLoaded(true);
          }
        } else {
          console.log("Using default logo path (non-Electron)");
          setLogoSrc("assets/image.png"); // Fallback for browser
          setLogoLoaded(true);
        }
      } catch (error) {
        console.error("Error loading logo:", error);
        setLogoSrc("assets/image.png"); // Fallback
        setLogoLoaded(true);
      }
    };

    loadLogo();
  }, []);

  useEffect(() => {
  //@ts-ignore

    window.__IN_SPLASH_SCREEN__ = true;
    document.body.setAttribute("data-in-splash-screen", "true");

    const timer = setTimeout(() => {
  //@ts-ignore

      window.__IN_SPLASH_SCREEN__ = false;
      document.body.removeAttribute("data-in-splash-screen");
      navigate("/dashboard");
    }, 3000);

    return () => {
      clearTimeout(timer);
  //@ts-ignore

      window.__IN_SPLASH_SCREEN__ = false;
      document.body.removeAttribute("data-in-splash-screen");
    };
  }, [navigate]);

  return (
    <BackgroundWrapper>
      <div
        className="flex relative flex-col ml-4 max-w-full w-screen justify-content"
        style={{ margin: "auto", alignItems: "center" }}
      >
        <div
          style={{
            border: "1px solid #0b0b0c",
            width: "50vh",
            height: "50vh",
            borderRadius: "100%",
            boxShadow: "rgba(124, 217, 255, 0.23) 10px -319px 128px 15px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "20vh",
          }}
        >
          <div
            style={{
              border: "1px",
              width: "42vh",
              height: "42vh",
              borderRadius: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "6px 4px 71px 22px #1abcfe7a",
            }}
          >
            <div style={{ border: "1px", width: "40vh", height: "40vh", borderRadius: "100%", background: "#131d2b" }}>
              {logoLoaded ? (
                <img
                  src={logoSrc}
                  alt="Logo"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "20px",
                  }}
                />
              ) : (
                <img
                  loading="lazy"
                  src="assets/image.png" // Renderer public asset
                  alt="Personal Sportsbook Logo"
                  style={{ maxWidth: "65vh", objectFit: "contain" }}
                />
              )}
            </div>
          </div>
        </div>
        <div className="text-center text-[#778096] font-[900] text-[30px] mt-10 max-md:mt-10 max-md:max-w-full">
          {tagline}
        </div>
        <div className="mt-5 w-[45px] h-[45px]">
          {/* <Spinner /> */}
          <img
        loading="lazy"
        src="assets/spinner.png"
        alt="Personal Sportsbook Logo"
        className="object-contain w-full aspect-square max-md:max-w-full"
        style={{maxWidth:'65vh',}}
      />
        </div>
      </div>
    </BackgroundWrapper>
  );
}

export default SplashScreen;