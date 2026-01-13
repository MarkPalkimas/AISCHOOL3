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
      <SignIn routing="hash" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  )
}
