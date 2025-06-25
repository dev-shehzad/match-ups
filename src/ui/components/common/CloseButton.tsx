
import React from "react"
import { X } from "lucide-react"

interface CloseButtonProps {
  onClick: () => void
  className?: string
}

const CloseButton: React.FC<CloseButtonProps> = ({ onClick, className = "" }) => {
  return (
    <button
      onClick={onClick}
      className={`absolute top-2 right-2 z-50 bg-[#0C5FAE] hover:bg-[#3999CC] text-white rounded-full w-6 h-6 flex items-center justify-center shadow-[0_0_8px_rgba(57,153,204,0.5)] transition-all duration-200 ${className}`}
      aria-label="Close screen"
    >
      <X size={14} strokeWidth={2.5} />
    </button>
  )
}

export default CloseButton
