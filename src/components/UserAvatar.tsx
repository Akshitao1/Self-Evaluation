// src/components/UserAvatar.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const UserAvatar: React.FC<UserAvatarProps> = ({ src, name, className, size = "md" }) => {
  const [hasError, setHasError] = useState(false);
  const handleError = () => setHasError(true);

  const initials = name ? name.charAt(0).toUpperCase() : "?";
  
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-base",
    lg: "h-12 w-12 text-lg"
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {src && !hasError && (
        <AvatarImage 
          src={src} 
          alt={name || "User avatar"}
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      )}
      <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar; 