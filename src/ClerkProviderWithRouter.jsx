//src/ClerkProviderWithRouter.jsx
import React from 'react'
import { ClerkProvider } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function ClerkProviderWithRouter({ children }) {
  const navigate = useNavigate()

  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  if (!clerkPubKey) {
    throw new Error('Missing Publishable Key')
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      navigate={(to) => navigate(to)}
      //IMPORTANT: With HashRouter, DO NOT include "/#/" here
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  )
}
