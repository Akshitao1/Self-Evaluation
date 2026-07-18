"use client";

import React, { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, ChevronDown, Search, Check } from "lucide-react";

import JoveoLogoIcon from "@/components/JoveoLogoIcon";
import UserAvatar from "@/components/UserAvatar";
import {
  logoutAndInvalidate,
  PROFILE_KEY,
  UserProfile,
} from "@/utils/authHelper";

interface HeaderProps {
  className?: string;
}

interface Client {
  id: string;
  name: string;
}

const Header = ({ className }: HeaderProps) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clients, setClients] = useState<Client[]>([
    { id: "client1", name: "Example Client" },
    { id: "client2", name: "Demo Client" },
    { id: "client3", name: "Test Client" }
  ]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

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

    // Set default selected client
    const storedClient = window.localStorage.getItem("selectedClient");
    if (storedClient) {
      try {
        setSelectedClient(JSON.parse(storedClient));
      } catch (error) {
        console.error("Error parsing client data:", error);
        // Set first client as default if parsing fails
        if (clients.length > 0) {
          setSelectedClient(clients[0]);
          window.localStorage.setItem("selectedClient", JSON.stringify(clients[0]));
        }
      }
    } else if (clients.length > 0) {
      // Set first client as default if none selected
      setSelectedClient(clients[0]);
      window.localStorage.setItem("selectedClient", JSON.stringify(clients[0]));
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
  }, [clients]);

  const handleLogout = () => {
    logoutAndInvalidate();
    setProfile(null);
  };
  
  const handleClientChange = (client: Client) => {
    setSelectedClient(client);
    window.localStorage.setItem("selectedClient", JSON.stringify(client));
    setSearchTerm(""); // Clear search when client is selected
    setIsDropdownOpen(false); // Close dropdown
    
    // Side effects - you can add custom logic here
    console.log(`Client changed to: ${client.name} (ID: ${client.id})`);
    
    // Example: Trigger data refresh, analytics tracking, etc.
    // fetchClientData(client.id);
    // analytics.track('client_selected', { clientId: client.id, clientName: client.name });
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle dropdown open/close
  const handleDropdownOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    if (!open) {
      setSearchTerm(""); // Clear search when closing
    }
  };

  // Handle keyboard navigation in search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredClients.length > 0) {
      // Select first filtered client on Enter
      handleClientChange(filteredClients[0]);
    } else if (e.key === 'Escape') {
      // Close dropdown on Escape
      setIsDropdownOpen(false);
    }
  };

  // Enhanced click handler with additional side effects
  const handleClientClick = (client: Client, event: React.MouseEvent) => {
    // Prevent event bubbling
    event.stopPropagation();
    
    // Call the main handler
    handleClientChange(client);
    
    // Additional side effects can be added here
    // For example: analytics, logging, notifications, etc.
    
    // Example: Show a brief notification (you could use a toast library)
    console.log(`Switched to client: ${client.name}`);
    
    // Example: Trigger custom events
    window.dispatchEvent(new CustomEvent('clientChanged', { 
      detail: { client, timestamp: new Date().toISOString() } 
    }));
  };

  const clientSelector = () => {
    //show this selector if using the cursor rules for joveo-ai-dashboard
    return (
      <div className="flex items-center h-full" style={{backgroundColor: "#202e49"}}>
        <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center px-3 py-2 bg-transparent hover:bg-slate-800 text-white rounded-md focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
            >
              <span className="text-sm font-medium mr-1">
                {selectedClient?.name || "Select Client"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-64 bg-white border-gray-200 p-0 shadow-lg" 
            align="start"
            sideOffset={8}
          >
            {/* Search Input */}
            <div className="p-3 bg-gray-50 border-b-2 border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 "  />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-10 pr-4 py-2 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-100 focus:ring-1"
                  autoFocus
                />
              </div>
            </div>
            
            {/* Separator */}
            <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200"></div>
            
            {/* Client List */}
            <div className="max-h-48 overflow-y-auto py-2 bg-white">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <DropdownMenuItem
                    key={client.id}
                    onClick={(e) => handleClientClick(client, e)}
                    className={`cursor-pointer hover:bg-gray-100 focus:bg-gray-100 px-4 py-3 mx-1 rounded-md flex items-center justify-between transition-colors ${
                      selectedClient?.id === client.id ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                    }`}
                  >
                    <span className="font-medium">{client.name}</span>
                    {selectedClient?.id === client.id && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-4 py-3 text-gray-500 text-sm text-center">
                  No clients found
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <header className={`sticky top-0 z-50 w-full bg-[#1C2536] border-b border-[#1C2536] h-[60px] max-h-[60px] ${className || ''}`}>
      <div className="px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left side - Joveo Logo and Client Selector */}
          <div className="flex items-center space-x-4 h-full">
            <div className="flex-shrink-0 flex items-center">
              <JoveoLogoIcon className="cursor-pointer hover:opacity-80 transition-opacity" />
              {/* show this span if using the cursor rules for joveo-ai-dashboard */}
              {/* <span className="text-white text-[14px] font-medium">Joveo AI Dashboard</span> */}
            </div>
            {/* show this selector if using the cursor rules for joveo-ai-dashboard*/}
            {/* {clientSelector()} */}
          </div>

          {/* Right side - User Avatar with Dropdown */}
          {process.env.NODE_ENV === "production" && <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-10 w-10 rounded-full p-0 hover:bg-slate-800 transition-colors"
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
      </div>
    </header>
  );
};

export default Header; 