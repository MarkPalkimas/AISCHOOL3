import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function ClerkProviderWithRouter({ children }) {
  const navigate = useNavigate();
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  if (!clerkPubKey) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        Missing VITE_CLERK_PUBLISHABLE_KEY in production build.
      </div>
    );
  }
  
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      navigate={(to) => navigate(to)}  // Remove the hash stripping
      signInUrl="/sign-in"              // Remove the /# prefix
      signUpUrl="/sign-up"              // Remove the /# prefix
      afterSignInUrl="/"                // Remove the /# prefix
      afterSignUpUrl="/"                // Remove the /# prefix
    >
      {children}
    </ClerkProvider>
  );
}
