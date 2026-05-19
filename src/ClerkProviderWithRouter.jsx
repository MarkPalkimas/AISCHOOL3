import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

function trimEnv(value) {
  return String(value || "").trim();
}

function getClerkConfig() {
  return {
    publishableKey: trimEnv(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
    proxyUrl: trimEnv(import.meta.env.VITE_CLERK_PROXY_URL),
    domain: trimEnv(import.meta.env.VITE_CLERK_DOMAIN),
  };
}

export default function ClerkProviderWithRouter({ children }) {
  const navigate = useNavigate();
  const clerkConfig = getClerkConfig();

  if (!clerkConfig.publishableKey) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code>.
      </div>
    );
  }

  const providerProps = {
    publishableKey: clerkConfig.publishableKey,
    navigate: (to) => navigate(to),
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    afterSignInUrl: "/sync-user",
    afterSignUpUrl: "/sync-user",
    ...(clerkConfig.domain ? { domain: clerkConfig.domain } : {}),
    ...(clerkConfig.proxyUrl ? { proxyUrl: clerkConfig.proxyUrl } : {}),
  };

  return (
    <ClerkProvider {...providerProps}>
      {children}
    </ClerkProvider>
  );
}
