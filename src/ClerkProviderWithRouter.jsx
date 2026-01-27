import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function ClerkProviderWithRouter({ children }) {
  const navigate = useNavigate();
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  const useProxy =
    hostname === "mystudyguideai.com" ||
    hostname === "www.mystudyguideai.com";

  const proxyUrl = useProxy ? "https://clerk.mystudyguideai.com" : undefined;

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
      afterSignInUrl="/sync-user"
      afterSignUpUrl="/sync-user"
    >
      {children}
    </ClerkProvider>
  );
}
