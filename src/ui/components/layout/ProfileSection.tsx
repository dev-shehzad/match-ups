import React from "react";
import { ProfileLogo } from "../common/ProfileLogo";

function ProfileSection({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="h-fit w-[200px] bg-[#0d2436] flex flex-col p-6  !pb-20 rounded-xl relative"
      style={{ borderRight: "1px solid #1a3a4c" }}
    >
      {/* ❌ Close (X) Button */}
      <button
        className="!absolute !top-0 !-left-4 text-white text-lg"
        onClick={onClose}
      >
        <svg
          width="50"
          height="27"
          viewBox="0 0 50 27"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="25"
            cy="12"
            r="11.5"
            fill="url(#paint0_radial_3486_1244)"
            stroke="white"
          />
          <path
            d="M21.1863 15L24.3193 10.892L24.2803 12.01L21.2773 8.006H23.5523L25.4503 10.619L24.5923 10.645L26.5553 8.006H28.7133L25.6973 11.971V10.879L28.8173 15H26.5163L24.5273 12.218L25.3723 12.335L23.3963 15H21.1863Z"
            fill="white"
          />
          <defs>
            <radialGradient
              id="paint0_radial_3486_1244"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(25 12) rotate(90) scale(12)"
            >
              <stop   stopColor="#0C5FAE"/>
              <stop offset="1" stopColor="#052748" />
            </radialGradient>
          </defs>
        </svg>
      </button>

      {/* Profile content */}
      <div className="mt-8 flex flex-col items-center">
        {/* Profile avatar */}
        <div className=" rounded-full flex items-center justify-center mb-6">
          <ProfileLogo />
        </div>

        {/* User info */}
        <div className="text-center">
          <h2 className="text-white text-xl font-bold mb-2">Name</h2>
          <p className="text-gray-400 text-sm mb-4">Email</p>
          <p className="text-gray-500 text-xs">Joined [Month Year]</p>
        </div>
      </div>
    </div>
  );
}

export default ProfileSection;
