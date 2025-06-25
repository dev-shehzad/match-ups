
import { useState, useRef } from "react"
import { Logo } from "../common/Logo"
import ProfileSection from "./ProfileSection"
import FavoritesSection from "./FavoritesSection"
import HistorySection from "./HistorySection"
import TutorialSection from "./TutorialSection"
import SettingsSection from "./SettingsSection"
import LegalSection from "./LegalSection"

function Sidebar() {
  const [selectedSection, setSelectedSection] = useState("") // Track active section
  const [sectionPosition, setSectionPosition] = useState(0) // Track section position

  const menuRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})

  const menuItems = [
    {
      label: "Profile",
      key: "profile",
      left: -200,
      component: <ProfileSection onClose={() => setSelectedSection("")} />,
    },
    {
      label: "Favorites",
      key: "favorites",
      left: -250,
      component: <FavoritesSection onClose={() => setSelectedSection("")} />,
    },
    {
      label: "History",
      key: "history",
      left: -270,
      component: <HistorySection onClose={() => setSelectedSection("")} />,
    },
    {
      label: "Tutorial",
      key: "tutorial",
      left: -300,
      component: <TutorialSection onClose={() => setSelectedSection("")} />,
    },
    {
      label: "Settings",
      key: "settings",
      left: -300,
      component: <SettingsSection onClose={() => setSelectedSection("")} />,
    },
    { label: "Legal", key: "legal", left: -300, component: <LegalSection onClose={() => setSelectedSection("")} /> },
  ]

  const handleMenuClick = (key: string) => {
    setSelectedSection(key) // Set active section
    const buttonRef = menuRefs.current[key]
    if (buttonRef) {
      setSectionPosition(buttonRef.offsetTop) // Get button position
    }
  }

  return (
    <div className="relative flex">
      {/* Left Sidebar */}
      <div
        className="h-screen w-[200px] bg-[#0d2436] flex flex-col items-center"
        style={{ borderLeft: "1px solid #1a3a4c" }}
      >
        {/* Logo at the top */}
        <div className="mt-6 mb-10 w-full flex justify-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center w-[110px]">
             <img
                  loading="lazy"
                  src="assets/image.png" // Renderer public asset
                  alt="Personal Sportsbook Logo"
                  className="object-contain w-full aspect-square max-md:max-w-full"
                  style={{ maxWidth: "65vh", objectFit: "contain" }}
                />
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="w-full flex flex-col !space-y-8 px-4 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.key}
              ref={(el) => (menuRefs.current[item.key] = el)}
              className={`w-full !text-center text-[25px] py-1 rounded ${
                selectedSection === item.key ? "!text-[#3999cc]" : "text-white"
              }`}
              onClick={() => handleMenuClick(item.key)}
              style={{ textDecoration: "underline" }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Version at the bottom */}
        <div className="mt-auto mb-4 text-sm text-gray-500">v.1</div>
      </div>

      {/* Show Selected Section on the Left */}
      {selectedSection && (
        <div
          className="absolute transition-all duration-300 !z-[9999]"
          style={{
            top: sectionPosition,
            left: menuItems.find((item) => item.key === selectedSection)?.left,
          }}
        >
          {menuItems.find((item) => item.key === selectedSection)?.component}
        </div>
      )}
    </div>
  )
}

export default Sidebar
