// Main application logic
class AISchoolApp {
    constructor() {
        this.isLoading = false;
    }

    async initialize() {
        // Initialize authentication
        await window.authManager.initialize();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize smooth scrolling
        this.initializeSmoothScroll();
        
        console.log('AI School app initialized');
    }

    setupEventListeners() {
        // Auth buttons
        this.setupAuthButtons();
        
        // CTA buttons
        this.setupCTAButtons();
        
        // Modal functionality
        this.setupModal();
        
        // Form handlers
        this.setupForms();
        
        // Utility functions
        this.setupUtilities();
    }

    setupAuthButtons() {
        const signInBtn = document.getElementById('sign-in-btn');
        const signOutBtn = document.getElementById('sign-out-btn');

        if (signInBtn) {
            signInBtn.addEventListener('click', async () => {
                await window.authManager.signIn();
            });
        }

        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                await window.authManager.signOut();
            });
        }
    }

    setupCTAButtons() {
        const teacherCTA = document.getElementById('teacher-cta');
        const studentCTA = document.getElementById('student-cta');

        if (teacherCTA) {
            teacherCTA.addEventListener('click', async () => {
                if (window.authManager.isSignedIn()) {
                    window.location.href = '/teacher.html';
                } else {
                    await window.authManager.requireAuth('teacher');
                }
            });
        }

        if (studentCTA) {
            studentCTA.addEventListener('click', async () => {
                if (window.authManager.isSignedIn()) {
                    this.showStudentModal();
                } else {
                    await window.authManager.requireAuth('student');
                }
            });
        }
    }

    setupModal() {
        const modal = document.getElementById('student-modal');
        const modalClose = document.getElementById('modal-close');
        const cancelBtn = document.getElementById('cancel-student');
        const joinBtn = document.getElementById('join-class');
        const codeInput = document.getElementById('teacher-code');

        // Close modal handlers
        [modalClose, cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.hideStudentModal();
                });
            }
        });

        // Close on overlay click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideStudentModal();
                }
            });
        }

        // Join class handler
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                this.handleJoinClass();
            });
        }

        // Enter key handler for code input
        if (codeInput) {
            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleJoinClass();
                }
            });

            // Format code input (uppercase, limit characters)
            codeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            });
        }

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.hideStudentModal();
            }
        });
    }

    setupForms() {
        // Any additional form setup can go here
    }

    setupUtilities() {
        // Intersection Observer for animations
        this.setupIntersectionObserver();
        
        // Scroll animations
        this.setupScrollAnimations();
    }

    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe feature cards and steps
        const animatedElements = document.querySelectorAll('.feature-card, .step');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    setupScrollAnimations() {
        // Smooth scroll for navigation links
        const navLinks = document.querySelectorAll('a[href^="#"]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const headerOffset = 80;
                    const elementPosition = targetElement.offsetTop;
                    const offsetPosition = elementPosition - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    initializeSmoothScroll() {
        // Add smooth scrolling behavior to the page
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    showStudentModal() {
        const modal = document.getElementById('student-modal');
        const codeInput = document.getElementById('teacher-code');
        
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            
            // Focus on input after animation
            setTimeout(() => {
                if (codeInput) {
                    codeInput.focus();
                }
            }, 300);
        }
    }

    hideStudentModal() {
        const modal = document.getElementById('student-modal');
        const codeInput = document.getElementById('teacher-code');
        
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            
            // Clear input
            if (codeInput) {
                codeInput.value = '';
            }
            
            // Reset button state
            this.resetJoinButton();
        }
    }

    async handleJoinClass() {
        const codeInput = document.getElementById('teacher-code');
        const joinBtn = document.getElementById('join-class');
        const joinText = document.getElementById('join-text');
        const joinLoading = document.getElementById('join-loading');
        
        if (!codeInput || !joinBtn) return;
        
        const teacherCode = codeInput.value.trim();
        
        if (!teacherCode) {
            this.showError('Please enter a class code');
            codeInput.focus();
            return;
        }

        if (teacherCode.length < 3) {
            this.showError('Class code must be at least 3 characters');
            codeInput.focus();
            return;
        }

        // Show loading state
        joinBtn.disabled = true;
        joinText.classList.add('hidden');
        joinLoading.classList.remove('hidden');

        try {
            // Simulate API call to validate code and join class
            await this.simulateJoinClass(teacherCode);
            
            // Redirect to student dashboard with code
            const params = new URLSearchParams({ code: teacherCode });
            window.location.href = `/student.html?${params.toString()}`;
            
        } catch (error) {
            console.error('Error joining class:', error);
            this.showError(error.message || 'Failed to join class. Please try again.');
            this.resetJoinButton();
            codeInput.focus();
        }
    }

    async simulateJoinClass(code) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Validate code format (for demo purposes)
        const validCodes = ['DEMO123', 'TEST456', 'AI2024', 'LEARN1', 'CLASS1'];
        
        if (!validCodes.includes(code.toUpperCase())) {
            throw new Error('Invalid class code. Please check with your teacher.');
        }
        
        // In a real app, this would make an API call to:
        // 1. Validate the class code exists
        // 2. Check if student has permission to join
        // 3. Add student to the class
        // 4. Return class information
        
        return {
            success: true,
            classId: code,
            className: 'Demo Class',
            teacherName: 'Demo Teacher'
        };
    }

    resetJoinButton() {
        const joinBtn = document.getElementById('join-class');
        const joinText = document.getElementById('join-text');
        const joinLoading = document.getElementById('join-loading');
        
        if (joinBtn) {
            joinBtn.disabled = false;
        }
        
        if (joinText) {
            joinText.classList.remove('hidden');
        }
        
        if (joinLoading) {
            joinLoading.classList.add('hidden');
        }
    }

    showError(message) {
        // Create or update error message
        let errorElement = document.getElementById('error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error-message';
            errorElement.className = 'error-message';
            
            const modalBody = document.querySelector('.modal-body');
            if (modalBody) {
                modalBody.insertBefore(errorElement, modalBody.firstChild);
            }
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Add error styles if not already in CSS
        if (!document.querySelector('style[data-error-styles]')) {
            const style = document.createElement('style');
            style.setAttribute('data-error-styles', 'true');
            style.textContent = `
                .error-message {
                    background-color: #fef2f2;
                    border: 1px solid #fca5a5;
                    color: #dc2626;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-size: 14px;
                    display: none;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }, 5000);
    }

    // Utility methods
    generateClassCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    formatClassCode(code) {
        return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoade
