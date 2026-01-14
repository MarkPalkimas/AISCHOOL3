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
      //For hash routing: strip leading # so react-router gets "/sign-in"
      navigate={(to) => navigate(to.replace(/^#/, ""))}
      signInUrl="/#/sign-in"
      signUpUrl="/#/sign-up"
      afterSignInUrl="/#/"
      afterSignUpUrl="/#/"
    >
      {children}
    </ClerkProvider>
  );
}
