"use client";

import '@rainbow-me/rainbowkit/styles.css';

import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiConfig } from "wagmi";
import {
  sepolia,
} from 'wagmi/chains';
import { ReactNode } from "react";

const config = getDefaultConfig({
  appName: 'Althara Pacta',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || '00000000000000000000000000000000',
  chains: [sepolia],
  ssr: true, 
});


const queryClient = new QueryClient();

interface ClientProvidersProps {
  children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}
