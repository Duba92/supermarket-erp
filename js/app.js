// Main Application Initialization
let appInitialized = false;

// Initialize the entire application
async function initApp() {
    try {
        console.log('Initializing application...');
        
        // Check if we're on a page that needs initialization
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Initialize database with error handling
        if (typeof db !== 'undefined' && db.init) {
            try {
                await db.init();
                console.log('Database initialized successfully');
            } catch (dbError) {
                console.warn('Database init warning:', dbError);
                // Continue even if DB has issues - we'll use localStorage fallback
            }
        } else {
            console.warn('DB module not loaded, using fallback');
        }
        
        // Setup connection monitoring
        if (typeof initOfflineMonitoring !== 'undefined') {
            initOfflineMonitoring();
        }
        
        // Display user info if logged in
        if (typeof displayUserInfo !== 'undefined') {
            displayUserInfo();
        } else if (typeof auth !== 'undefined' && auth.getCurrentUser) {
            const user = auth.getCurrentUser();
            const userInfoSpan = document.getElementById('userRole');
            if (userInfoSpan && user) {
                userInfoSpan.textContent = `${user.name} (${user.role})`;
            }
        }
        
        // Hide loading state
        hideLoadingState();
        
        appInitialized = true;
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Application initialization error:', error);
        showErrorMessage(error);
    }
}

// Hide loading states and show content
function hideLoadingState() {
    // Remove loading text from tables
    const loadingElements = document.querySelectorAll('.data-table tbody');
    loadingElements.forEach(tbody => {
        if (tbody.innerHTML.includes('Loading')) {
            // Don't clear if there's already data
            const hasData = Array.from(tbody.querySelectorAll('tr')).some(tr => 
                !tr.textContent.includes('Loading')
            );
            if (!hasData && tbody.children.length === 1) {
                tbody.innerHTML = '<tr><td colspan="10">No data available</td></tr>';
            }
        }
    });
}

// Show error message to user
function showErrorMessage(error) {
    const errorHtml = `
        <div style="position: fixed; bottom: 20px; right: 20px; background: #ef4444; color: white; padding: 15px; border-radius: 8px; z-index: 9999; max-width: 350px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <strong>⚠️ Error</strong>
            <p style="margin: 5px 0 0 0; font-size: 14px;">${error.message || 'Failed to initialize. Using offline mode.'}</p>
            <button onclick="this.parentElement.remove()" style="margin-top: 10px; background: white; color: #ef4444; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Dismiss</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', errorHtml);
}

// Setup sidebar toggle for mobile
function setupSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

// Load dashboard data if on dashboard page
async function loadDashboardData() {
    const dashboardPage = document.querySelector('.stats-grid');
    if (!dashboardPage) return;
    
    try {
        // Get cached products
        let products = [];
        if (typeof db !== 'undefined' && db.getCachedProducts) {
            products = await db.getCachedProducts();
        } else if (localStorage.getItem('products')) {
            products = JSON.parse(localStorage.getItem('products'));
        }
        
        // Update low stock count
        const lowStockCount = products.filter(p => (p.quantity || 0) < 10).length;
        const lowStockElement = document.getElementById('lowStockCount');
        if (lowStockElement) {
            lowStockElement.textContent = lowStockCount;
            if (lowStockCount > 0) {
                lowStockElement.classList.add('warning');
            }
        }
        
        // Get cached sales
        let sales = [];
        if (typeof db !== 'undefined' && db.get) {
            sales = await db.get('sales') || [];
        } else if (localStorage.getItem('sales')) {
            sales = JSON.parse(localStorage.getItem('sales'));
        }
        
        // Calculate today's sales
        const today = new Date().toDateString();
        const todaySales = sales.filter(sale => {
            const saleDate = new Date(sale.created_at || sale.date).toDateString();
            return saleDate === today;
        });
        
        const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.total_amount || sale.total || 0), 0);
        const todaySalesElement = document.getElementById('todaySales');
        if (todaySalesElement) {
            todaySalesElement.textContent = `$${todayTotal.toFixed(2)}`;
        }
        
        // Update transaction count
        const transactionCount = document.getElementById('transactionCount');
        if (transactionCount) {
            transactionCount.textContent = sales.length;
        }
        
        // Update recent transactions table
        updateRecentTransactions(sales.slice(-5).reverse());
        
        // Update low stock alerts
        updateLowStockAlerts(products);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Update recent transactions table
function updateRecentTransactions(sales) {
    const tbody = document.getElementById('recentTransactionsBody');
    if (!tbody) return;
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No transactions yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td>${new Date(sale.created_at || sale.date).toLocaleTimeString()}</td>
            <td>${sale.cashier_name || sale.cashier || 'Cashier'}</td>
            <td>$${(sale.total_amount || sale.total || 0).toFixed(2)}</td>
            <td><span style="color: #10b981;">Completed</span></td>
        </tr>
    `).join('');
}

// Update low stock alerts
function updateLowStockAlerts(products) {
    const alertsContainer = document.getElementById('lowStockAlerts');
    if (!alertsContainer) return;
    
    const lowStock = products.filter(p => (p.quantity || 0) < 10 && (p.quantity || 0) > 0);
    const outOfStock = products.filter(p => (p.quantity || 0) === 0);
    
    if (lowStock.length === 0 && outOfStock.length === 0) {
        alertsContainer.innerHTML = '<div class="alert-item">✅ All products have sufficient stock</div>';
        return;
    }
    
    let alertsHtml = '';
    
    if (outOfStock.length > 0) {
        alertsHtml += `<div class="alert-item" style="border-left-color: #ef4444; background: #fee2e2;">
            <strong>🔴 Out of Stock:</strong> ${outOfStock.map(p => p.name).join(', ')}
        </div>`;
    }
    
    if (lowStock.length > 0) {
        alertsHtml += `<div class="alert-item" style="border-left-color: #f59e0b; background: #fef3c7;">
            <strong>⚠️ Low Stock (less than 10):</strong> ${lowStock.map(p => `${p.name} (${p.quantity} left)`).join(', ')}
        </div>`;
    }
    
    alertsContainer.innerHTML = alertsHtml;
}

// Create fallback data if needed
function createFallbackData() {
    if (!localStorage.getItem('products')) {
        const sampleProducts = [
            { id: 1, name: 'White Bread', barcode: '8901234567890', category: 'Groceries', buy_price: 1.50, sell_price: 2.50, quantity: 50 },
            { id: 2, name: 'Milk 1L', barcode: '8901234567891', category: 'Dairy', buy_price: 0.80, sell_price: 1.50, quantity: 30 },
            { id: 3, name: 'Eggs 12pcs', barcode: '8901234567892', category: 'Dairy', buy_price: 2.00, sell_price: 3.50, quantity: 40 },
            { id: 4, name: 'Coca Cola', barcode: '8901234567893', category: 'Beverages', buy_price: 0.60, sell_price: 1.20, quantity: 100 },
            { id: 5, name: 'Potato Chips', barcode: '8901234567894', category: 'Snacks', buy_price: 0.90, sell_price: 1.80, quantity: 60 }
        ];
        localStorage.setItem('products', JSON.stringify(sampleProducts));
    }
    
    if (!localStorage.getItem('sales')) {
        localStorage.setItem('sales', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('currentUser')) {
        // Don't auto-set user
    }
}

// Setup connection status
function setupConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    function updateStatus() {
        const isOnline = navigator.onLine;
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span:last-child');
        
        if (isOnline) {
            if (dot) {
                dot.classList.remove('offline');
                dot.classList.add('online');
            }
            if (text) text.textContent = 'Online';
            statusElement.style.color = '#10b981';
        } else {
            if (dot) {
                dot.classList.remove('online');
                dot.classList.add('offline');
            }
            if (text) text.textContent = 'Offline Mode';
            statusElement.style.color = '#f59e0b';
        }
    }
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// Handle logout button
function setupLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }
}

// Check if user is logged in
function checkAuth() {
    const user = localStorage.getItem('currentUser');
    const isLoginPage = window.location.pathname.includes('login.html');
    
    if (!user && !isLoginPage && !window.location.pathname.includes('index.html')) {
        window.location.href = 'login.html';
        return false;
    }
    
    if (user && isLoginPage) {
        window.location.href = 'dashboard.html';
        return false;
    }
    
    return true;
}

// Run when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create fallback data first
        createFallbackData();
        
        // Setup basic handlers
        setupSidebarToggle();
        setupLogoutHandler();
        setupConnectionStatus();
        
        // Check authentication
        checkAuth();
        
        // Initialize the app
        await initApp();
        
        // Load dashboard data if on dashboard
        await loadDashboardData();
        
        // Display user info in sidebar
        const user = localStorage.getItem('currentUser');
        const userRoleSpan = document.getElementById('userRole');
        if (userRoleSpan && user) {
            const userData = JSON.parse(user);
            userRoleSpan.textContent = `${userData.name} (${userData.role})`;
        }
        
    } catch (error) {
        console.error('Fatal error:', error);
        document.body.innerHTML += `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); text-align: center; z-index: 10000;">
                <h2 style="color: #ef4444;">⚠️ Application Error</h2>
                <p>${error.message || 'Failed to load application'}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Refresh Page</button>
                <button onclick="localStorage.clear(); location.reload()" style="margin-top: 20px; margin-left: 10px; padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer;">Clear Data & Refresh</button>
            </div>
        `;
    }
});
