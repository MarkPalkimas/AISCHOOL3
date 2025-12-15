import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!clerkPubKey) {
  throw new Error('Missing Publishable Key')
}

// Normalize the basename so it matches the deployed base exactly (e.g. "/AISCHOOL3/")
const normBase = (() => {
  const b = import.meta.env.BASE_URL || '/'
  // ensure one leading slash, exactly one trailing slash
  return `/${b.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/+/, '/')
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <BrowserRouter basename={normBase}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)

