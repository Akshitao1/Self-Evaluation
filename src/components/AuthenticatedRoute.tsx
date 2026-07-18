// src/components/AuthenticatedRoute.tsx
"use client";

import React, { useEffect, useState } from "react";
import AppLoader from "./AppLoader";
import {
  getCookie,
  deleteCookie,
  REFRESH_TOKEN,
  fetchAndSaveAccessToken,
  redirectToAccountApp,
  logAuthState,
  fetchAndSaveUserProfile,
} from "@/utils/authHelper";

interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure this only runs on the client side
    if (typeof window === "undefined") {
      return;
    }

    // Check if we're in production mode on the client side
    const isProd = process.env.NODE_ENV === "production";

    // Skip authentication in development mode
    if (!isProd) {
      console.log("🚀 Development mode detected - skipping authentication");
      setIsLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        console.log("🔐 Initializing authentication...");
        
        // 1. Move short-lived cookies into localStorage (after redirect from Accounts)
        const refreshCookie = getCookie(REFRESH_TOKEN);
        const emailCookie = getCookie("email");
        const idpCookie = getCookie("identityProvider");

        if (refreshCookie) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(REFRESH_TOKEN, refreshCookie);
            if (emailCookie) window.localStorage.setItem("email", emailCookie);
            if (idpCookie)
              window.localStorage.setItem("identityProvider", idpCookie);
          }

          // Delete only the short-lived cookies so they don't linger.
          // deleteCookie(REFRESH_TOKEN);
          if (emailCookie) deleteCookie("email");
          if (idpCookie) deleteCookie("identityProvider");
        }

        // 2. Ensure we have an access token
        await fetchAndSaveAccessToken();

        // 3. Fetch & cache user profile
        try {
          await fetchAndSaveUserProfile();
        } catch (err) {
          console.error("Failed to fetch user profile", err);
        }

        // 4. Restore last accessed URL if user was bounced during auth
        const lastUrl = sessionStorage.getItem("LAST_ACCESSED_URL");
        if (lastUrl) {
          sessionStorage.removeItem("LAST_ACCESSED_URL");
          window.location.href = lastUrl;
        }
      } catch (err) {
        console.error("Authentication failed", err);
        // In development, don't redirect on auth failure
        if (process.env.NODE_ENV === "production") {
          redirectToAccountApp();
        }
      } finally {
        logAuthState("AuthenticatedRoute:init");
        setIsLoading(false);
      }
    };

    if(process.env.NODE_ENV === "development") {
      setIsLoading(false);
      return;
    }
    initializeAuth();
  }, []);

  if (process.env.NODE_ENV === "production" && isLoading) {
    return <AppLoader />;
  }

  return <>{children}</>;
};

export default AuthenticatedRoute; 