// src/components/AppLoader.tsx
"use client";

import Typography from "@/components/ui/typography";
import JoveoLogoIcon from "./JoveoLogoIcon";

const AppLoader = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-white">
      <div className="p-6 flex items-center gap-6 animate-bounce">
        <div>
          <JoveoLogoIcon />
        </div>
        <Typography
          variant="h4"
          className="text-blue-700 animate-bounce"
        >
          Loading Coder...
        </Typography>
      </div>
    </div>
  );
};

export default AppLoader; 