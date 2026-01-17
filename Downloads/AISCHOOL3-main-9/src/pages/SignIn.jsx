import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { useLocation } from "react-router-dom";

export default function SignInPage() {
    const location = useLocation();
    const intendedRole = location.state?.intendedRole;

    // Redirect to appropriate dashboard based on intended role
    const afterSignInUrl = intendedRole === 'teacher' ? '/teacher' : intendedRole === 'student' ? '/student' : '/';

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9fafb' }}>
            <SignIn routing="path" path="/sign-in" afterSignInUrl={afterSignInUrl} />
        </div>
    );
}
