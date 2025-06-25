import React, { useState } from "react";
import BackgroundWrapper from "./Background";
import LeftSidebar from "./LeftSidebar";
import Header from "./Header";
import Sidebar from "./Sidebar";

const DashboardLayout = ({ children }) => {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  return (
    <BackgroundWrapper>
      <div className="flex h-screen text-white overflow-hidden">
        {/* Left Sidebar */}
        <div className={`transition-all duration-300 ${showLeftSidebar ? "w-64" : "w-0"}`}>
          {showLeftSidebar && <LeftSidebar onClose={() => setShowLeftSidebar(false)} />}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="flex-1 p-4 overflow-auto">{children}</div>
        </div>

        {/* Right Sidebar */}
        <div className={`transition-all duration-300 ${showRightSidebar ? "w-64" : "w-0"}`}>
          {showRightSidebar && <Sidebar />}
        </div>
      </div>
    </BackgroundWrapper>
  );
};

export default DashboardLayout;
