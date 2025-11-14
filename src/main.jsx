import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={clerkPubKey}
      afterSignInUrl="/AISCHOOL3/"
      afterSignUpUrl="/AISCHOOL3/"
      signInUrl="/AISCHOOL3/"
      signUpUrl="/AISCHOOL3/"
    >
      <BrowserRouter basename={import.meta.env.DEV ? '/' : '/AISCHOOL3'}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
