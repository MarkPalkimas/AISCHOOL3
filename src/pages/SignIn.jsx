//src/pages/SignIn.jsx  (or whatever your filename is)
import React from 'react'
import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f9fafb',
      }}
    >
      <SignIn
        //IMPORTANT: HashRouter already handles the hash, so Clerk should be "path"
        routing="path"
        path="/sign-in"
        afterSignInUrl="/"
      />
    </div>
  )
}
