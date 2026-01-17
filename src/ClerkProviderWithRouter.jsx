import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function ClerkProviderWithRouter({ children }) {
  const navigate = useNavigate();
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  //if you are using Clerk proxy (clerk.yourdomain.com), set this:
  const proxyUrl = "https://clerk.mystudyguideai.com";

  if (!publishableKey) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        Missing VITE_CLERK_PUBLISHABLE_KEY in production build.
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      proxyUrl={proxyUrl}
      navigate={(to) => navigate(to)}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl="/select-role"
      signUpForceRedirectUrl="/select-role"
      signOutForceRedirectUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
