import React from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'

function Teacher() {
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Teacher Dashboard</h1>
          <p className="text-lg text-gray-600">
            Welcome to your ClassAI dashboard. Upload your class materials and create AI-powered learning experiences.
          </p>
        </div>

        <SignedOut>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to access your dashboard</h2>
            <p className="text-gray-600 mb-6">Please sign in to upload materials and manage your AI assistant.</p>
            <SignInButton mode="modal">
              <button className="btn-primary">Sign In</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upload Materials Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-openai-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-openai-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Materials</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Upload your syllabus, lecture notes, assignments, and readings to train your AI assistant.
              </p>
              <button className="btn-secondary w-full" disabled>
                Coming Soon
              </button>
            </div>

            {/* AI Assistant Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">AI Settings</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Configure your AI assistant's behavior and generate student access codes.
              </p>
              <button className="btn-secondary w-full" disabled>
                Coming Soon
              </button>
            </div>

            {/* Student Access */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Student Access</h3>
              </div>
              <p className="text-gray-600 mb-4">
                View your class code and manage student access to your AI assistant.
              </p>
              <button className="btn-secondary w-full" disabled>
                Coming Soon
              </button>
            </div>

            {/* Analytics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5
