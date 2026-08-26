import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

const CLERK_PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY ||
  (typeof window !== 'undefined' ? (window as any).__CLERK_PUBLISHABLE_KEY__ : '') ||
  '';

interface ClerkProviderWrapperProps {
  children: React.ReactNode;
}

export const isClerkConfigured = (): boolean => {
  return typeof CLERK_PUBLISHABLE_KEY === 'string' && CLERK_PUBLISHABLE_KEY.trim().startsWith('pk_');
};

export const getClerkPublishableKey = (): string => {
  return CLERK_PUBLISHABLE_KEY;
};

export const ClerkProviderWrapper: React.FC<ClerkProviderWrapperProps> = ({ children }) => {
  if (isClerkConfigured()) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        {children}
      </ClerkProvider>
    );
  }

  return <>{children}</>;
};
