"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bookmark,
  Clock,
  Play,
  Settings,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import {
  logoutAndInvalidate,
  PROFILE_KEY,
  UserProfile,
} from "@/utils/authHelper";

const NAV = [
  { href: "/create", icon: Settings, label: "Configure" },
  { href: "/preview", icon: BarChart3, label: "Preview" },
  { href: "/execute", icon: Play, label: "Execute" },
  { href: "/saved", icon: Bookmark, label: "Saved Configs" },
  { href: "/history", icon: Clock, label: "Execution History" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Load profile from localStorage
    const stored = window.localStorage.getItem(PROFILE_KEY);
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (error) {
        console.error("Error parsing profile data:", error);
      }
    }


    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PROFILE_KEY) {
        if (e.newValue) {
          try {
            setProfile(JSON.parse(e.newValue));
          } catch (error) {
            console.error("Error parsing profile data:", error);
          }
        } else {
          setProfile(null);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleLogout = () => {
    logoutAndInvalidate();
    setProfile(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside className="w-[60px] bg-[#1C2536] flex flex-col items-center py-4 gap-2 shrink-0">
        <div className="w-9 h-9 rounded-md bg-[#303F9F] flex items-center justify-center mb-4">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {NAV.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                isActive
                  ? "bg-[#303F9F] text-white"
                  : "text-[#B0B8C4] hover:bg-[#2A354A] hover:text-white"
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-[#1C2536] px-6 flex items-center justify-between shrink-0">
          <h1 className="text-white font-semibold text-lg tracking-tight">DM Tool</h1>
          <div className="flex items-center gap-2">
            <span className="text-[#B0B8C4] text-xs">Markup Optimization</span>
            {process.env.NODE_ENV === "production" && <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative cursor-pointer h-10 w-10 rounded-full p-0 hover:bg-slate-800 transition-colors"
                  >
                    <UserAvatar
                      src={profile?.profilePictureUrl}
                      name={profile?.displayName || "User"}
                      size="sm"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-48 bg-slate-800 border-slate-700" 
                  align="end" 
                  forceMount
                  sideOffset={8}
                >
                  {/* Logout Option Only */}
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-slate-700 focus:text-red-300 focus:bg-slate-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-white">{children}</main>
      </div>
    </div>
  );
}
