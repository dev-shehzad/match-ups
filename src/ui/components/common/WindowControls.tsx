
import React from "react"
import { CrossIcon, MinIcon, PlusIcon } from "../../assets/svgs"

interface WindowControlsProps {
  className?: string
}

const WindowControls: React.FC<WindowControlsProps> = ({ className = "" }) => {
  // Direct IPC calls without any abstraction
  const handleMinimize = () => {
    console.log("Minimize clicked - direct IPC call")
    try {
      if (window.electronAPI) {
        window.electronAPI.sendFrameAction("MINIMIZE")
      } else if (window.electron) {
        window.electron.sendFrameAction("MINIMIZE")
      } else {
        console.error("No Electron API available")
      }
    } catch (error) {
      console.error("Error minimizing window:", error)
    }
  }

  const handleMaximize = () => {
    console.log("Maximize clicked - direct IPC call")
    try {
      if (window.electronAPI) {
        window.electronAPI.sendFrameAction("MAXIMIZE")
      } else if (window.electron) {
        window.electron.sendFrameAction("MAXIMIZE")
      } else {
        console.error("No Electron API available")
      }
    } catch (error) {
      console.error("Error maximizing window:", error)
    }
  }

  const handleClose = () => {
    console.log("Close clicked - direct IPC call")
    try {
      if (window.electronAPI) {
        window.electronAPI.sendFrameAction("CLOSE")
      } else if (window.electron) {
        window.electron.sendFrameAction("CLOSE")
      } else {
        console.error("No Electron API available")
      }
    } catch (error) {
      console.error("Error closing window:", error)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleClose}
        className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
      >
        <CrossIcon />
      </button>
      <button
        onClick={handleMinimize}
        className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
      >
        <MinIcon />
      </button>
      <button
        onClick={handleMaximize}
        className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#2e5790] hover:bg-[#3a6aa8] transition-colors"
      >
        <PlusIcon />
      </button>
    </div>
  )
}

export default WindowControls

