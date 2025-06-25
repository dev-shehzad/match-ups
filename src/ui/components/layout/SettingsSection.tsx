

import type React from "react"
import { useState } from "react"

interface SettingsSectionProps {
  onClose: () => void
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ onClose }) => {
  // State for toggle switches
  const [toggles, setToggles] = useState({
    darkMode: true,
    notifications: true,
    autoUpdate: false,
    saveHistory: true,
    analytics: true,
    developerMode: false,
    experimentalFeatures: false,
  })

  // Function to handle toggle changes
  const handleToggle = (key: keyof typeof toggles) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Toggle Switch Component
  const ToggleSwitch = ({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) => (
    <div
      className={`w-10 h-5 ${isOn ? "bg-blue-600" : "bg-gray-600"} rounded-full relative cursor-pointer`}
      onClick={onToggle}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
          isOn ? "right-1" : "left-1"
        }`}
      ></div>
    </div>
  )

  return (
    <div className="w-[300px] max-h-[80vh] overflow-y-auto bg-[#0d2436] p-4 pt-0 text-white rounded-xl shadow-lg !z-[9999]">
      <div
        className="flex justify-between items-center mb-4 sticky top-0 bg-[#0d2436] py-2"
        style={{ zIndex: 50 }} // Higher z-index for the header
      >
        <h2 className="text-xl font-bold">Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Dark Mode</h3>
            <ToggleSwitch isOn={toggles.darkMode} onToggle={() => handleToggle("darkMode")} />
          </div>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Notifications</h3>
            <ToggleSwitch isOn={toggles.notifications} onToggle={() => handleToggle("notifications")} />
          </div>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Auto-Update</h3>
            <ToggleSwitch isOn={toggles.autoUpdate} onToggle={() => handleToggle("autoUpdate")} />
          </div>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Language</h3>
          <select className="w-full bg-[#0d2436] p-2 rounded border border-gray-700">
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>German</option>
          </select>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Display</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Font Size</span>
              <select className="bg-[#0d2436] p-1 rounded border border-gray-700 text-sm">
                <option>Small</option>
                <option>Medium</option>
                <option>Large</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Contrast</span>
              <select className="bg-[#0d2436] p-1 rounded border border-gray-700 text-sm">
                <option>Normal</option>
                <option>High</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Privacy</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Save History</span>
              <ToggleSwitch isOn={toggles.saveHistory} onToggle={() => handleToggle("saveHistory")} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Analytics</span>
              <ToggleSwitch isOn={toggles.analytics} onToggle={() => handleToggle("analytics")} />
            </div>
            <button className="mt-2 text-xs bg-[#0d2436] px-2 py-1 rounded border border-[#1a3a4c] hover:bg-[#163a52] transition-colors">
              Clear All Data
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Advanced</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Developer Mode</span>
              <ToggleSwitch isOn={toggles.developerMode} onToggle={() => handleToggle("developerMode")} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Experimental Features</span>
              <ToggleSwitch isOn={toggles.experimentalFeatures} onToggle={() => handleToggle("experimentalFeatures")} />
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">About</h3>
          <p className="text-sm text-gray-300">Version 1.0.0</p>
          <p className="text-sm text-gray-300">© 2024 All Rights Reserved</p>
          <button className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            Check for Updates
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsSection
