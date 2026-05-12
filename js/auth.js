// Authentication functions

// Default users for demo (in production, these would be in Supabase)
const DEMO_USERS = {
    'admin@supermarket.com': {
        id: '1',
        email: 'admin@supermarket.com',
        name: 'Admin User',
        role: 'Admin',
        password: 'admin123'
    },
    'cashier@supermarket.com': {
        id: '2',
        email: 'cashier@supermarket.com',
        name: 'Cashier User',
        role: 'Cashier',
        password: 'cashier123'
    },
    'manager@supermarket.com': {
        id: '3',
        email: 'manager@supermarket.com',
        name: 'Store Manager',
        role: 'Store Manager',
        password: 'manager123'
    }
};

// Login function
async function login(email, password, rememberMe = false) {
    try {
        // First try Supabase if available
        if (supabaseClient && isOnline()) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (!error && data.user) {
                // Get user profile from users table
          const { data: userData, error: userError } = await supabaseClient
                .from('store_users')  // Updated table name
                .select('*')
                .eq('id', data.user.id)
                .single();
                
                if (!userError) {
                    const user = {
                        id: userData.id,
                        email: userData.email,
                        name: userData.name,
                        role: userData.role
                    };
                    setCurrentUser(user);
                    
                    if (rememberMe) {
                        localStorage.setItem('authToken', data.session.access_token);
                    }
                    
                    return { success: true, user };
                }
            }
        }
        
        // Fallback to demo users
        const user = DEMO_USERS[email];
        if (user && user.password === password) {
            const userInfo = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            };
            setCurrentUser(userInfo);
            
            if (rememberMe) {
                localStorage.setItem('authToken', 'demo-token-' + user.id);
            }
            
            return { success: true, user: userInfo };
        }
        
        return { success: false, error: 'Invalid email or password' };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

// Logout function
async function logout() {
    try {
        if (supabaseClient && isOnline()) {
            await supabaseClient.auth.signOut();
        }
        
        clearCurrentUser();
        localStorage.removeItem('authToken');
        
        // Redirect to login
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'login.html';
    }
}

// Check if user is authenticated
function isAuthenticated() {
    const user = getCurrentUser();
    if (user) return true;
    
    const token = localStorage.getItem('authToken');
    return !!token;
}

// Require authentication for pages
function requireAuth() {
    if (!isAuthenticated() && window.location.pathname !== '/login.html') {
        window.location.href = 'login.html';
    }
}

// Check user role
function hasRole(roles) {
    const user = getCurrentUser();
    if (!user) return false;
    
    if (typeof roles === 'string') {
        return user.role === roles;
    }
    
    return roles.includes(user.role);
}

// Setup login form handler
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;
        
        const loginBtn = form.querySelector('button[type="submit"]');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
        
        const result = await login(email, password, rememberMe);
        
        if (result.success) {
            // Redirect based on role
            const role = result.user.role;
            if (role === 'Cashier') {
                window.location.href = 'pos.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            alert('Login failed: ' + (result.error || 'Invalid credentials'));
            loginBtn.textContent = originalText;
            loginBtn.disabled = false;
        }
    });
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Display user info in sidebar
function displayUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userRoleSpan = document.getElementById('userRole');
    
    if (userInfo || userRoleSpan) {
        const user = getCurrentUser();
        if (user) {
            if (userRoleSpan) {
                userRoleSpan.textContent = `${user.name} (${user.role})`;
            }
            if (userInfo) {
                userInfo.innerHTML = `
                    <span class="user-name">${user.name}</span>
                    <span class="user-role">${user.role}</span>
                `;
            }
        }
    }
}

// Auto-login from stored token
async function checkAutoLogin() {
    const token = localStorage.getItem('authToken');
    if (token && !getCurrentUser()) {
        // Try to restore session
        if (supabaseClient && isOnline()) {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session) {
                const { data: userData } = await supabaseClient
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (userData) {
                    setCurrentUser({
                        id: userData.id,
                        email: userData.email,
                        name: userData.name,
                        role: userData.role
                    });
                }
            }
        }
    }
}

// Initialize auth
document.addEventListener('DOMContentLoaded', () => {
    setupLoginForm();
    setupLogoutButton();
    displayUserInfo();
    checkAutoLogin();
    requireAuth();
});

// Export functions
window.auth = {
    login,
    logout,
    isAuthenticated,
    hasRole,
    getCurrentUser
};
