
import type React from "react"

interface LegalSectionProps {
  onClose: () => void
}

const LegalSection: React.FC<LegalSectionProps> = ({ onClose }) => {
  return (
    <div className="w-[300px] max-h-[80vh] overflow-y-auto bg-[#0d2436] p-4 pt-0 text-white rounded-xl shadow-lg !z-[9999]">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#0d2436] py-2">
        <h2 className="text-xl font-bold">Legal</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Terms of Service</h3>
          <p className="text-sm text-gray-300">Last updated: May 2024</p>
          <p className="text-sm text-gray-300 mt-2">
            By using our application, you agree to these terms which govern your use of the service. These terms
            constitute a legally binding agreement between you and our company.
          </p>
          <button className="mt-2 text-blue-400 text-sm">View Full Terms</button>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Privacy Policy</h3>
          <p className="text-sm text-gray-300">Last updated: May 2024</p>
          <p className="text-sm text-gray-300 mt-2">
            Our Privacy Policy describes how we collect, use, and handle your personal information when you use our
            services, websites, and applications.
          </p>
          <button className="mt-2 text-blue-400 text-sm">View Full Policy</button>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Licenses</h3>
          <p className="text-sm text-gray-300">Open source licenses</p>
          <p className="text-sm text-gray-300 mt-2">
            This application uses various open source libraries and components. We are grateful to the developers who
            have contributed to these projects.
          </p>
          <button className="mt-2 text-blue-400 text-sm">View All Licenses</button>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Copyright</h3>
          <p className="text-sm text-gray-300">© 2024 All Rights Reserved</p>
          <p className="text-sm text-gray-300 mt-2">
            All content, graphics, user interfaces, and logos are protected by copyright laws and may not be copied,
            modified, or distributed without prior written permission.
          </p>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Data Processing</h3>
          <p className="text-sm text-gray-300">
            Information about how we process your data, including any third-party processors we may use and the legal
            basis for processing.
          </p>
          <button className="mt-2 text-blue-400 text-sm">Learn More</button>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Cookie Policy</h3>
          <p className="text-sm text-gray-300">
            Details about the cookies we use, why we use them, and how you can control them.
          </p>
          <button className="mt-2 text-blue-400 text-sm">View Cookie Policy</button>
        </div>

        <div className="p-3 bg-[#1a3a4c] rounded-lg">
          <h3 className="font-medium mb-2">Contact Legal Team</h3>
          <p className="text-sm text-gray-300">
            If you have any questions about our legal policies or need assistance, please contact our legal team.
          </p>
          <button className="mt-2 text-blue-400 text-sm">Contact Us</button>
        </div>
      </div>
    </div>
  )
}

export default LegalSection
