import React from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'

function Teacher() {
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
            <SignedOut>
              <SignInButton mode="modal">
                <button style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.color = '#111827'}
                onMouseOut={(e) => e.target.style.color = '#6B7280'}>
                  Log in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="welcome-text" style={{ fontSize: '14px', color: '#6B7280' }}>Welcome back!</span>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '80px', 
            height: '80px', 
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', 
            borderRadius: '16px',
            marginBottom: '24px',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)'
          }}>
            <svg style={{ width: '40px', height: '40px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: '800', color: '#111827', lineHeight: '1.2', marginBottom: '16px' }}>
            Teacher <span style={{ color: '#3B82F6' }}>Dashboard</span>
          </h1>
          <p style={{ fontSize: '20px', color: '#6B7280', lineHeight: '1.6', maxWidth: '800px', margin: '0 auto' }}>
            Welcome to your ClassAI dashboard. Upload your class materials and create AI-powered learning experiences for your students.
          </p>
        </div>

        <SignedOut>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ 
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                background: '#F3F4F6', 
                borderRadius: '16px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <svg style={{ width: '32px', height: '32px', color: '#6B7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                Sign in to access your dashboard
              </h2>
              <p style={{ color: '#6B7280', marginBottom: '32px', lineHeight: '1.6' }}>
                Please sign in to upload materials and manage your AI assistant.
              </p>
              <SignInButton mode="modal">
                <button className="btn-primary" style={{ width: '100%' }}>
                  Sign In to Continue
                </button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Feature Cards Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '24px',
            marginBottom: '48px'
          }}>
            {/* Upload Materials */}
            <div className="feature-card hover-card">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: '#2563EB' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>Upload Materials</h3>
              </div>
              <p style={{ color: '#6B7280', marginBottom: '24px', lineHeight: '1.6' }}>
                Upload your syllabus, lecture notes, assignments, and readings to train your AI assistant with your course content.
              </p>
              <button className="btn-disabled" disabled>
                <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon
              </button>
            </div>

            {/* AI Settings */}
            <div className="feature-card hover-card">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, #E9D5FF 0%, #D8B4FE 100%)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: '#7C3AED' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>AI Configuration</h3>
              </div>
              <p style={{ color: '#6B7280', marginBottom: '24px', lineHeight: '1.6' }}>
                Configure your AI assistant's behavior, personality, and generate student access codes for your classes.
              </p>
              <button className="btn-disabled" disabled>
                <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon
              </button>
            </div>

            {/* Student Access */}
            <div className="feature-card hover-card">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>Student Access</h3>
              </div>
              <p style={{ color: '#6B7280', marginBottom: '24px', lineHeight: '1.6' }}>
                View your class codes and manage student access to your AI assistant. Monitor who has joined your class.
              </p>
              <button className="btn-disabled" disabled>
                <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon
              </button>
            </div>

            {/* Analytics */}
            <div className="feature-card hover-card">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, #FED7AA 0%, #FDBA74 100%)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: '#EA580C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>Analytics & Insights</h3>
              </div>
              <p style={{ color: '#6B7280', marginBottom: '24px', lineHeight: '1.6' }}>
                Track student engagement, see frequently asked questions, and identify knowledge gaps to improve your teaching.
              </p>
              <button className="btn-disabled" disabled>
                <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon
              </button>
            </div>
          </div>

          {/* Status Banner */}
          <div style={{ 
            padding: '32px', 
            background: '#EFF6FF', 
            border: '1px solid #BFDBFE',
            borderLeft: '4px solid #3B82F6',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  background: '#DBEAFE', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: '#2563EB' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E40AF', marginBottom: '12px' }}>
                  🚀 Dashboard Under Development
                </h3>
                <p style={{ color: '#1E40AF', marginBottom: '16px', lineHeight: '1.6' }}>
                  The full teacher dashboard is currently being built with exciting features coming soon:
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  <li style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                    <svg style={{ width: '16px', height: '16px', marginRight: '12px', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Drag & drop material uploads with AI processing
                  </li>
                  <li style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                    <svg style={{ width: '16px', height: '16px', marginRight: '12px', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Advanced AI assistant configuration and personality settings
                  </li>
                  <li style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                    <svg style={{ width: '16px', height: '16px', marginRight: '12px', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Real-time student engagement analytics and insights
                  </li>
                  <li style={{ fontSize: '14px', color: '#1E40AF', display: 'flex', alignItems: 'flex-start' }}>
                    <svg style={{ width: '16px', height: '16px', marginRight: '12px', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Class management tools and student access controls
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </SignedIn>
      </div>
    </div>
  )
}

export default Teacher
