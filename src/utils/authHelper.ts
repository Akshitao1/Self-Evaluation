// src/utils/authHelper.ts
"use client";

import { formatISO } from "date-fns";
import axios from "axios";

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
  // add any other fields that your auth service returns
}

export const REFRESH_TOKEN = "refreshToken";
export const TOKENS = "tokens";
export const IDENTITY_PROVIDER = "identityProvider";

export const getAccountAppUrl = () => {
  return "https://accounts.joveo.com";
};

// ────────────────────────────────────────────────────────────
// Heimdal (Auth service) client
// ────────────────────────────────────────────────────────────
// Using a relative path lets Next.js rewrite proxy the request, avoiding CORS issues in the browser.
const baseURLUser = "/user/v1";

export const heimdalClient = axios.create({
  baseURL: baseURLUser,
});

// Add request interceptor to automatically include access token
heimdalClient.interceptors.request.use(
  (config) => {
    // Skip adding accessToken for /token endpoint (used for refreshing tokens)
    if (config.url?.includes('/token')) {
      return config;
    }
    
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers.accessToken = accessToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle 401 errors automatically
heimdalClient.interceptors.response.use(
  (response) => response, // Pass through successful responses
  (error) => {
    // Check if the error is a 401 Unauthorized
    if (error.response?.status === 401) {
      console.warn("401 Unauthorized detected - redirecting to accounts app");
      logoutAndValidate();
      return Promise.reject(error);
    }
    
    // Check for specific error codes that indicate auth issues
    const errorCode = error.response?.data?.errorCode || error.response?.data?.error;
    if (errorCode && ERROR_CODES.includes(errorCode)) {
      console.warn(`Auth error detected (${errorCode}) - redirecting to accounts app`);
      logoutAndValidate();
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  }
);

// Create a generic API client for other endpoints (not heimdal)
export const apiClient = axios.create();

// Add the same interceptors to the generic API client
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
      // Use Authorization header for non-heimdal APIs (more standard)
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("401 Unauthorized detected on external API - redirecting to accounts app");
      logoutAndValidate();
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export const ERROR_CODES = [
  "invalid_auth_token",
  "invalid_refresh_token",
  "unauthorized",
  "unauthorised_request",
] as const;

// ────────────────────────────────────────────────────────────
// Cookie helpers
// ────────────────────────────────────────────────────────────
export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/;`;
}

// ────────────────────────────────────────────────────────────
// Local-storage token helpers
// ────────────────────────────────────────────────────────────
export const setTokens = (tokens: TokenResponse) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKENS, JSON.stringify(tokens));
};

export const getAccessToken = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const tokens: TokenResponse = JSON.parse(
      window.localStorage.getItem(TOKENS) || "{}"
    );
    return tokens?.accessToken;
  } catch {
    return undefined;
  }
};

export const refreshAccessToken = async (): Promise<void> => {
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN);
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const payload: Record<string, string | null> = {
    email: window.localStorage.getItem("email"),
    productId: "CODER",
  };

  const idp = window.localStorage.getItem(IDENTITY_PROVIDER);
  if (idp && idp !== "undefined" && idp !== "null") {
    payload["identityProvider"] = idp;
  }

  const res = await heimdalClient.post("/account/token", payload, {
    headers: {
      refreshToken,
    },
  });

  const data: TokenResponse = res.data;
  setTokens(data);
};

export const fetchAndSaveAccessToken = async (): Promise<void> => {
  const access = getAccessToken();
  if (access) return;
  await refreshAccessToken();
};

// ────────────────────────────────────────────────────────────
// User profile helpers
// ────────────────────────────────────────────────────────────
export interface UserProfile {
  email: string;
  displayName: string;
  profilePictureUrl?: string;
  language?: string;
  isSignedUp?: boolean;
}

export const PROFILE_KEY = "profile";

export const fetchAndSaveUserProfile = async (): Promise<UserProfile> => {
  if (typeof window === "undefined") return { email: "", displayName: "" };
  const profile = window.localStorage.getItem(PROFILE_KEY);
  if (profile) {
    return JSON.parse(profile);
  }

  // No need to manually set headers - interceptor handles it
  const res = await heimdalClient.get<UserProfile>("/profile");

  const data = res.data;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  }
  return data;
};

// ────────────────────────────────────────────────────────────
// API Client Usage Guide
// ────────────────────────────────────────────────────────────
/**
 * Use these API clients for automatic 401 handling:
 * 
 * 1. heimdalClient - for calls to /user/v1/* (Heimdal service)
 *    - Automatically includes accessToken header
 *    - Handles 401 responses and redirects to accounts app
 * 
 * 2. apiClient - for other external API calls  
 *    - Automatically includes Authorization: Bearer token
 *    - Handles 401 responses and redirects to accounts app
 * 
 * 3. authFetch - wrapper for fetch() with 401 handling
 *    - Use for internal API routes (/api/*)
 *    - Manually include auth headers if needed
 * 
 * Examples:
 *   await heimdalClient.get('/profile')
 *   await apiClient.get('https://api.example.com/data')
 *   await authFetch('/api/users')
 */

// ────────────────────────────────────────────────────────────
// Fetch wrapper with 401 handling
// ────────────────────────────────────────────────────────────
export const authFetch = async (
  input: any, 
  init?: any
): Promise<Response> => {
  try {
    // Add access token to headers if available
    const accessToken = getAccessToken();
    const headers = new Headers(init?.headers);
    
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(input, {
      ...init,
      headers,
    });

    // Check for 401 unauthorized
    if (response.status === 401) {
      console.warn("401 Unauthorized detected in fetch - redirecting to accounts app");
      logoutAndValidate();
      throw new Error('Unauthorized - redirecting to login');
    }

    return response;
  } catch (error) {
    // If it's a network error or other issue, still check if it might be auth-related
    if (error instanceof TypeError && error.message.includes('401')) {
      console.warn("Auth error detected in fetch - redirecting to accounts app");
      logoutAndValidate();
    }
    throw error;
  }
};

// ────────────────────────────────────────────────────────────
// Redirect helpers
// ────────────────────────────────────────────────────────────
export const redirectToAccountApp = () => {
  const redirectURL = `${window.location.href}`;

  const url = `${getAccountAppUrl()}/validate?redirect=${redirectURL}&productId=CODER`;
  window.location.href = url;
};

export const cleanUp = () => {
  try {
    // Clear localStorage keys
    window.localStorage.removeItem(TOKENS);
    window.localStorage.removeItem("email");
    window.localStorage.removeItem(REFRESH_TOKEN);
    window.localStorage.removeItem(IDENTITY_PROVIDER);

    // Clear all localStorage to be safe
    window.localStorage.clear();

    // Remove cookies for joveo.com domain if present
    const cookieDomain = ".joveo.com";
    [
      REFRESH_TOKEN,
      "email",
      IDENTITY_PROVIDER,
    ].forEach((c) => {
      document.cookie = `${c}=; expires=${new Date(0).toUTCString()}; domain=${cookieDomain}; path=/`;
    });

    // Remove Axios default access token header if set
    delete axios.defaults.headers.common["Accesstoken"];
  } catch {
    // no-op – cleanup best effort
  }
};

// ────────────────────────────────────────────────────────────
// Convenience redirect helpers (wrappers around cleanup)
// ────────────────────────────────────────────────────────────

const buildValidateUrl = (params: Record<string, string | boolean>) => {
  const url = new URL("/validate", getAccountAppUrl());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
};

export const logout = () => {
  cleanUp();
  window.location.href = buildValidateUrl({
    redirect: window.location.href,
    productId: "CODER",
  });
};

export const logoutAndValidate = () => {
  //use this function if any api is giving 401 error to validate the user with accounts app
  cleanUp();
  window.location.href = buildValidateUrl({
    redirect: window.location.href,
    productId: "CODER",
    logoutAndValidate: true,
  });
};

export const logoutAndInvalidate = () => {
  cleanUp();
  window.location.href = buildValidateUrl({
    redirect: window.location.href,
    productId: "CODER",
    invalidate: true,
  });
};

// ────────────────────────────────────────────────────────────
// Debug helper (optional)
// ────────────────────────────────────────────────────────────
export function logAuthState(origin: string) {
  console.log(`[AuthHelper] ${origin}  ►  time: ${formatISO(new Date())}`);
  console.table({
    refreshCookie: getCookie(REFRESH_TOKEN),
    refreshLS: window.localStorage.getItem(REFRESH_TOKEN),
    access: getAccessToken(),
  });
}

// ────────────────────────────────────────────────────────────
// Misc helpers inspired by reference
// ────────────────────────────────────────────────────────────

export const getLastCurrency = (): string => {
  try {
    const currencyString = window.localStorage.getItem("lastCurrency");
    return currencyString ? JSON.parse(currencyString) : "USD";
  } catch {
    return "USD";
  }
}; 