import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Grid3x2Icon,
  GridIcon,
  HorizontalIcon,
  MismatchIcon,
  SingleIcon,
  SixICon,
  TripleThreatIcon,
} from "../../assets/svgs";

interface MultiviewPresetProps {
  name: string;
  layout: string;
  path: string;
  className?: string; // Add className prop
}

export const MultiviewPreset: React.FC<MultiviewPresetProps> = ({
  name,
  layout,
  path,
  className,
}) => {
  const [active, setActive] = React.useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    setActive((prev) => !prev);
    navigate(path);
  };

  const renderLayout = () => {
    switch (layout) {
      case "grid":
        return (
          <div className="max-w-[125px] max-xl:max-w-[100px] w-full">
            <GridIcon />
          </div>
        );
      case "horizontal":
        return (
          <div className="max-w-[150px] max-xl:max-w-[115px] w-full">
            <HorizontalIcon />
          </div>
        );
      case "grid3x2":
        return (
          <div className="max-w-[133px] max-xl:max-w-[100px] w-full">
            <Grid3x2Icon />
          </div>
        );
      case "single-screen":
        return (
          <div className="max-w-[133px] max-xl:max-w-[100px] w-full">
            <SingleIcon />
          </div>
        );
        case "cover-6":
          return (
            <div className="max-w-[123px] max-xl:max-w-[100px] w-full">
              <SixICon />
            </div>
          );
        
      case "Mismatch":
        return (
          <div className="max-w-[150px] max-xl:max-w-[115px] w-full">
            <MismatchIcon />
          </div>
        );
      case "Triple-threat":
        return (
          <div className="max-w-[125px] max-xl:max-w-[100px]   w-full">
            <TripleThreatIcon />
          </div>
        );
        
      default:
        return (
          <div className="max-w-[125px] w-full h-[88px] p-1 bg-black rounded border-2 border-black overflow-hidden">
            <div className="grow shrink basis-0 self-stretch flex-col justify-center items-start gap-1 inline-flex">
              <div className="self-stretch grow shrink basis-0 bg-[#3999cc] rounded"></div>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={`flex flex-col  max-lg:px-5 max-md:ml-0 max-md:w-full ${className}`}
    >
      <div
        onClick={handleClick}
        className="flex flex-col w-full max-md:mt-10 align-center items-center cursor-pointer"
      >
        {renderLayout()}
        <div className="mt-3.5 font-montserrat  !font-[300] text-lg max-lg:text-[14px] tracking-normal text-center text-white ">
          {name}
        </div>
      </div>
    </div>
  );
};
