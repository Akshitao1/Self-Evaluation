'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useRef } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const ref = useRef<QueryClient>(undefined);
  if (!ref.current) ref.current = new QueryClient();
  return (
    <QueryClientProvider client={ref.current}>{children}</QueryClientProvider>
  );
}
