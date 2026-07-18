// Import localStorage polyfill FIRST to prevent SSR errors
import '@/lib/localStorage-polyfill';

import React from 'react';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';
import { Inter } from "next/font/google";
import AuthenticatedRoute from '@/components/AuthenticatedRoute';
import SecretsInitializer from '@/components/SecretsInitializer';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DM Tool — Markup Optimization",
  description: "Create automated dynamic margin workflows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <SecretsInitializer />
          <AuthenticatedRoute>
            {children}
          </AuthenticatedRoute>
        </Providers>
      </body>
    </html>
  );
}
