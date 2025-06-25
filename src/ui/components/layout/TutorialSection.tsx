
import type React from "react"

interface TutorialSectionProps {
  onClose: () => void
}

const TutorialSection: React.FC<TutorialSectionProps> = ({ onClose }) => {
  return (
    <div className="w-[300px] max-h-[80vh] overflow-y-auto bg-[#0d2436] p-4 pt-0 text-white rounded-xl shadow-lg !z-[9999]">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#0d2436] py-2">
        <h2 className="text-xl font-bold">Tutorial</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Getting Started</h3>
          <p className="text-sm text-gray-300">Learn the basics of using our platform</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Multi-Screen Setup</h3>
          <p className="text-sm text-gray-300">How to use multiple screens effectively</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Keyboard Shortcuts</h3>
          <p className="text-sm text-gray-300">Boost your productivity with shortcuts</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Advanced Features</h3>
          <p className="text-sm text-gray-300">Discover powerful tools and features</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Screen Management</h3>
          <p className="text-sm text-gray-300">Learn how to manage multiple screens and layouts</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Customization</h3>
          <p className="text-sm text-gray-300">Personalize your experience with custom settings</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Troubleshooting</h3>
          <p className="text-sm text-gray-300">Common issues and how to resolve them</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Updates & Releases</h3>
          <p className="text-sm text-gray-300">Stay informed about the latest features and improvements</p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Community Resources</h3>
          <p className="text-sm text-gray-300">Connect with other users and access community resources</p>
        </div>
      </div>
    </div>
  )
}

export default TutorialSection
