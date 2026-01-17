import React from "react";
import { SignUp } from "@clerk/clerk-react";
import { useLocation } from "react-router-dom";

export default function SignUpPage() {
    const location = useLocation();
    const intendedRole = location.state?.intendedRole;

    // Redirect to appropriate dashboard based on intended role
    const afterSignUpUrl = intendedRole === 'teacher' ? '/teacher' : intendedRole === 'student' ? '/student' : '/';

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9fafb' }}>
            <SignUp routing="path" path="/sign-up" afterSignUpUrl={afterSignUpUrl} />
        </div>
    );
}
