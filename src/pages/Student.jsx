import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'

function Student() {
  const [teacherCode, setTeacherCode] = useState('')
  const [isCodeSubmitted, setIsCodeSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (!teacherCode.trim()) return
    
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
    setIsCodeSubmitted(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Navigation */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              background: '#3B82F6', 
              borderRadius: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <span style={{ color: 'white', fontWeight: '700', fontSize: '18px' }}>C</span>
            </div>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          
          <div>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px' }}>
        <SignedOut>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: '800', color: '#111827', marginBottom: '16px', lineHeight: '1.1' }}>
              Student Access
            </h1>
            <p style={{ fontSize: '20px', color: '#6B7280', maxWidth: '600px', margin: '0 auto' }}>
              Sign in to access your class AI assistant
            </p>
          </div>

          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            border: '1px solid #E5E7EB', 
            padding: '48px', 
            textAlign: 'center',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              background: '#F3F4F6', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 24px' 
            }}>
              <svg width="32" height="32" fill="none" stroke="#6B7280" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
              Sign in to continue
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '32px', lineHeight: '1.6' }}>
              Please sign in to access your teacher's AI assistant
            </p>
            <SignInButton mode="modal">
              <button className="btn-primary">Sign In as Student</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!isCodeSubmitted ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: '800', color:import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'

function Student() {
  const [teacherCode, setTeacherCode] = useState('')
  const [isCodeSubmitted, setIsCodeSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (!teacherCode.trim()) return
    
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
    setIsCodeSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-openai-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">ClassAI</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    Log in
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SignedOut>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Student Access</h1>
            <p className="text-lg text-gray-600">
              Sign in to access your class AI assistant
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to continue</h2>
            <p className="text-gray-600 mb-6">Please sign in to access your teacher's AI assistant.</p>
            <SignInButton mode="modal">
              <button className="btn-primary">Sign In</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!isCodeSubmitted ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Enter Teacher Code</h1>
                <p className="text-lg text-gray-600">
                  Ask your teacher for the class code to access the AI assistant
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <form onSubmit={handleCodeSubmit}>
                  <div className="mb-6">
                    <label htmlFor="teacherCode" className="block text-sm font-medium text-gray-700 mb-2">
                      Teacher Code
                    </label>
                    <input
                      type="text"
                      id="teacherCode"
                      value={teacherCode}
                      onChange={(e) => setTeacherCode(e.target.value.toUpperCase())}
                      placeholder="Enter your teacher's code (e.g., ABC123)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-openai-500 focus:border-transparent text-lg"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!teacherCode.trim() || isLoading}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Connecting...
                      </div>
                    ) : (
                      'Access AI Assistant'
                    )}
                  </button>
                </form>

                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-800">
                        Need help?
                      </h3>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>
                          Ask your teacher for the class code. Each class has a unique code that gives you access to the AI assistant trained on your course materials.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to ClassAI!</h1>
                <p className="text-lg text-gray-600">
                  You're now connected to your teacher's AI assistant for class: <span className="font-semibold text-gray-900">{teacherCode}</span>
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Chat Coming Soon</h2>
                  <p className="text-gray-600">
                    The chat interface is being developed. Soon you'll be able to ask questions about your course materials and get instant, accurate answers.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-openai-500 bg-openai-50 p-4">
                    <div className="flex">
                      <div className="ml-3">
                        <p className="text-sm text-openai-700">
                          <strong>What you'll be able to do:</strong>
                        </p>
                        <ul className="mt-2 text-sm text-openai-600 space-y-1">
                          <li>• Ask questions about lectures and readings</li>
                          <li>• Get help with assignments and homework</li>
                          <li>• Clarify confusing concepts</li>
                          <li>• Review for exams</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setIsCodeSubmitted(false)
                        setTeacherCode('')
                      }}
                      className="btn-secondary"
                    >
                      Try Different Code
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </div>
    </div>
  )
}

export default Student
