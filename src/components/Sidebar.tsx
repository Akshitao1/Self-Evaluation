"use client";
import { Home, BarChart, Users, Settings } from "lucide-react";
import { designTokens } from "@/lib/design-tokens";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DRAWER_WIDTH_CLOSED,
  DRAWER_WIDTH_OPEN,
} from "./Sidebar.constants";

export const navItems = [
  {
    label: "Create",
    icon: <Settings size={20} />,
    href: "/create",
  },
  {
    label: "Preview",
    icon: <BarChart size={20} />,
    href: "/preview",
  },
  {
    label: "Execute",
    icon: <Home size={20} />,
    href: "/execute",
  },
  {
    label: "Saved",
    icon: <Users size={20} />,
    href: "/saved",
  },
  {
    label: "History",
    icon: <Users size={20} />,
    href: "/history",
  },
];

interface SidebarProps {
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const Sidebar = ({
  isOpen,
  onMouseEnter,
  onMouseLeave,
}: SidebarProps) => {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300 ease-in-out",
        isOpen ? `w-[${DRAWER_WIDTH_OPEN}px]` : `w-[${DRAWER_WIDTH_CLOSED}px]`
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: isOpen ? DRAWER_WIDTH_OPEN : DRAWER_WIDTH_CLOSED,
      }}
    >
      {/* Header spacing */}
      <div className="h-16" />
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  "hover:bg-[#F0F4FF] hover:text-[#303F9F]",
                  isActive
                    ? "bg-[#F0F4FF] text-[#303F9F] border border-[#E1E8FF]"
                    : "text-gray-600"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center",
                  isOpen ? "mr-3" : "mx-auto"
                )}>
                  <div className={cn(
                    "sidebar-icon",
                    isActive ? "active-icon" : "text-gray-600"
                  )}>
                    {item.icon}
                  </div>
                </div>
                <span
                  className={cn(
                    "transition-opacity duration-200",
                    isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          )})}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar; 