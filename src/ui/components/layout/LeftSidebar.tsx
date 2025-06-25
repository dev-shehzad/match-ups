
// LeftSidebar.tsx
import { MultiviewPreset } from "../common/MultiviewPreset"
import "./LeftSidebar.css"
import { useState } from "react"
import { useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import { setMultiScreenMode } from "../../state/slice/screenSlice"

export default function LeftSidebar({ onClose }: { onClose: () => void }) {
  const presets = [
    { name: "Full Court", layout: "grid", path: "/2x2" },
    { name: "Head-to-Head", layout: "horizontal", path: "/2x1" },
    { name: "Cover 6", layout: "cover-6", path: "/power-play" },
    { name: "Power Play", layout: "grid3x2", path: "/cover6" },
    { name: "Mismatch", layout: "Mismatch", path: "/mismatch" },
    { name: "Triple Threat", layout: "Triple-threat", path: "/triple-threat" },
  ]

  const [isOpen, setIsOpen] = useState(true)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleExit = () => {
    // Exit multiview mode by setting the flag to false
    dispatch(setMultiScreenMode(false))

    // Navigate to TestScreen - this is the simple approach the user wants
    navigate("/test")

    // Note: We're not calling onClose() anymore so the sidebar stays open
  }

  if (!isOpen) return null // If sidebar is closed, return nothing

  return (
    <div className="h-screen w-[200px] bg-gradient-to-b from-[#0a2a40] to-[#051a2a] flex flex-col items-center py-6 overflow-y-auto custom-scrollbar">
      <h2 className="text-white text-center font-bold text-[15px] mb-4">Multiview Presets</h2>

      <div className="flex flex-col items-center gap-4 w-full px-2 mt-2">
        {presets.map((preset) => (
          <div key={preset.name} className="w-full flex justify-center">
            <MultiviewPreset
              name={preset.name}
              layout={preset.layout}
              path={preset.path}
              className="scale-90 !px-10" // Added scaling here
            />
          </div>
        ))}
      </div>

      <div className="mt-auto ">
        <button
          onClick={handleExit}
          className="flex items-center text-[15px] gap-2 !text-[#ff3b3b]  hover:text-[#ff6b6b] hover:!underline transition-colors !font-bold text-sm !cursor-pointer"
        >
          <span>Exit Multiview</span>
        </button>
      </div>
    </div>
  )
}
