import React, { useState } from "react";
import { CloseLeftSidebar, CloseRightSidebar, OpenLeftSidebar, OpenRightSidebar } from "../../assets/svgs";

interface SidebarToggleButtonsProps {
  toggleLeft: () => void;
  toggleRight: () => void;
  showLeft: boolean;
  showRight: boolean;
}

export const SidebarToggleButtons: React.FC<SidebarToggleButtonsProps> = ({
  toggleLeft,
  toggleRight,
  showLeft,
  showRight
}) => {
  return (
    <>
      {/* Right Sidebar Button */}
      <button
        className="!absolute !cursor-pointer !right-0  !top-1/2 transform p-2 hover:bg-blue-900 rounded z-50 transition-all duration-300"
        onClick={toggleRight}
        style={{
          right: showRight ? "300px" : "0",
          transform: showRight ? "translateX(-213%)" : "translateX(0%)",
        }}
      >
        {showRight ? <OpenRightSidebar /> : <CloseRightSidebar />}
      </button>

      {/* Left Sidebar Button */}
      <button
        className="!absolute !cursor-pointer !-left-6 !top-1/2 transform -translate-y-1/2 p-2 hover:bg-blue-900 rounded"
        onClick={toggleLeft}
        style={{
          left: showLeft ? "300px" : "0",
          transform: `translateY(0%) ${showLeft ? "translateX(190px)" : "translateX(0%)"}`,
        }}
      >
        {showLeft ? <OpenLeftSidebar /> : <CloseLeftSidebar />}
      </button>
    </>
  );
};
