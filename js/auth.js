// Authentication module using Clerk
class AuthManager {
    constructor() {
        this.clerk = null;
        this.currentUser = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Initialize Clerk with your publishable key
            this.clerk = new Clerk('pk_test_aGVscGluZy1xdWFpbC02MS5jbGVyay5hY2NvdW50cy5kZXYk');
            await this.clerk.load();
            
            this.currentUser = this.clerk.user;
            this.isInitialized = true;
            
            // Set up event listeners
            this.setupClerkListeners();
            
            // Update UI based on auth state
            this.updateAuthUI();
            
            console.log('Auth initialized successfully');
        } catch (error) {
            console.error('Error initializing authentication:', error);
        }
    }

    setupClerkListeners() {
        // Listen for user changes
        this.clerk.addListener('userChanged', (user) => {
            this.currentUser = user;
            this.updateAuthUI();
            
            // Redirect after sign in if needed
            this.handlePostSignInRedirect();
        });
    }

    updateAuthUI() {
        const signInBtn = document.getElementById('sign-in-btn');
        const signOutBtn = document.getElementById('sign-out-btn');
        const userInfo = document.getElementById('user-info');
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');

        if (this.currentUser) {
            // User is signed in
            signInBtn.classList.add('hidden');
            signOutBtn.classList.remove('hidden');
            userInfo.classList.remove('hidden');
            
            // Update user info
            const name = this.currentUser.fullName || 
                        this.currentUser.firstName || 
                        this.currentUser.emailAddresses?.[0]?.emailAddress || 
                        'User';
                        
            const imageUrl = this.currentUser.imageUrl || 
                           `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10a37f&color=fff&size=32`;
            
            userName.textContent = name;
            userAvatar.src = imageUrl;
            userAvatar.alt = name;
        } else {
            // User is signed out
            signInBtn.classList.remove('hidden');
            signOutBtn.classList.add('hidden');
            userInfo.classList.add('hidden');
            
            // Reset to homepage if on protected page
            const currentPath = window.location.pathname;
            if (currentPath.includes('teacher') || currentPath.includes('student')) {
                window.location.href = '/';
            }
        }
    }

    async signIn() {
        try {
            await this.clerk.openSignIn({
                routing: 'hash',
                redirectUrl: window.location.href
            });
        } catch (error) {
            console.error('Error opening sign in:', error);
        }
    }

    async signOut() {
        try {
            await this.clerk.signOut();
            this.currentUser = null;
            
            // Redirect to homepage
            window.location.href = '/';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }

    async requireAuth(redirectTo = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.currentUser) {
            // Store intended destination
            if (redirectTo) {
                sessionStorage.setItem('authRedirect', redirectTo);
            }
            
            await this.signIn();
            return false;
        }

        return true;
    }

    handlePostSignInRedirect() {
        // Check if there's a stored redirect
        const redirectTo = sessionStorage.getItem('authRedirect');
        if (redirectTo && this.currentUser) {
            sessionStorage.removeItem('authRedirect');
            
            // Handle different redirect types
            if (redirectTo === 'teacher') {
                window.location.href = '/teacher.html';
            } else if (redirectTo === 'student') {
                // Show student modal for code entry
                document.getElementById('student-modal').classList.remove('hidden');
            }
        }
    }

    isSignedIn() {
        return !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }

    getUserId() {
        return this.currentUser?.id;
    }

    getUserEmail() {
        return this.currentUser?.emailAddresses?.[0]?.emailAddress;
    }

    getUserName() {
        return this.currentUser?.fullName || 
               this.currentUser?.firstName || 
               this.getUserEmail() || 
               'User';
    }
}

// Create global auth manager instance
window.authManager = new AuthManager();
