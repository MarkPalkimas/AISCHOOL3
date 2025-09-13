import React from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton, useUser } from '@clerk/clerk-react'
import Teacher from './pages/Teacher'
import Student from './pages/Student'

function HomePage() {
  const navigate = useNavigate()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Navigation */}
      <nav className="relative z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">ClassAI</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-100">
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

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-32">
          <div className="text-center relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 mb-8">
              <span className="text-sm font-medium text-indigo-700">✨ Powered by AI</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tight text-gray-900 mb-8 leading-[0.9]">
              <span className="block">The future of</span>
              <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
                AI-powered learning
              </span>
            </h1>
            
            <p className="mt-8 max-w-3xl mx-auto text-xl lg:text-2xl text-gray-600 leading-relaxed font-light">
              Transform your classroom with intelligent AI that understands your course materials. 
              <span className="text-gray-900 font-medium"> Teachers upload, students learn, everyone wins.</span>
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => navigate('/teacher')}
                className="btn-primary text-lg px-10 py-5 min-w-[180px]"
              >
                For Teachers
              </button>
              <button 
                onClick={() => navigate('/student')}
                className="btn-secondary text-lg px-10 py-5 min-w-[180px]"
              >
                For Students
              </button>
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">24/7</div>
                <div className="text-sm text-gray-600 mt-1">AI Assistance</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">∞</div>
                <div className="text-sm text-gray-600 mt-1">Questions Answered</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">100%</div>
                <div className="text-sm text-gray-600 mt-1">Course Focused</div>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-32 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="feature-card group">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Smart Upload</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                Drag and drop your course materials. Our AI instantly processes syllabi, lectures, and assignments to create a personalized learning assistant.
              </p>
            </div>

            <div className="feature-card group">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Instant Answers</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                Students get immediate, accurate responses based on your specific course content. No more waiting for office hours or generic answers.
              </p>
            </div>

            <div className="feature-card group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Deep Analytics</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                Understand student engagement with detailed insights. See what concepts need clarification and improve your teaching approach.
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-32 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
                Ready to transform your classroom?
              </h2>
              <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
                Join the education revolution. Start creating smarter, more engaging learning experiences today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => navigate('/teacher')}
                  className="btn-primary text-xl px-12 py-6"
                >
                  Get Started Free
                </button>
                <button className="btn-secondary text-xl px-12 py-6">
                  Watch Demo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-200 to-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float-delayed"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float-delayed-2"></div>
        </div>

        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.02] bg-gradient-to-br from-gray-900 via-transparent to-gray-900"></div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-gray-200/50 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto py-12 px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <span className="text-lg font-bold text-gray-900">ClassAI</span>
            </div>
            <p className="text-gray-600 text-sm">
              © 2024 ClassAI. Empowering education through artificial intelligence.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/student" element={<Student />} />
    </Routes>
  )
}

export default App
