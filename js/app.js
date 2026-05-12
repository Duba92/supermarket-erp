// Main Application Controller
let appInitialized = false;

// Initialize the entire application
async function initApp() {
    if (appInitialized) return;
    
    console.log('Initializing Supermarket ERP...');
    
    // Show loading state
    showLoading();
    
    try {
        // Initialize database connections
        await db.init();
        
        // Check authentication
        const user = getCurrentUser();
        if (user) {
            displayUserInfo();
            updateUIByRole(user.role);
        }
        
        // Setup connection monitoring
        setupConnectionMonitoring();
        
        // Setup offline sync listener
        setupSyncListener();
        
        // Load dashboard data if on dashboard page
        if (window.location.pathname.includes('dashboard.html')) {
            await loadDashboardData();
        }
        
        // Setup mobile menu toggle
        setupMobileMenu();
        
        // Setup refresh button
        setupRefreshButton();
        
        // Start periodic data refresh
        startPeriodicRefresh();
        
        appInitialized = true;
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('App initialization error:', error);
        showError('Failed to initialize application. Please refresh the page.');
    } finally {
        hideLoading();
    }
}

// Show loading indicator
function showLoading() {
    let loader = document.getElementById('globalLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.innerHTML = `
            <div class="loader-overlay">
                <div class="loader-spinner"></div>
                <div class="loader-text">Loading...</div>
            </div>
        `;
        document.body.appendChild(loader);
        
        // Add styles if not present
        if (!document.querySelector('#loaderStyles')) {
            const styles = document.createElement('style');
            styles.id = 'loaderStyles';
            styles.textContent = `
                .loader-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    flex-direction: column;
                }
                .loader-spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #2563eb;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .loader-text {
                    color: white;
                    margin-top: 1rem;
                    font-size: 0.875rem;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }
    }
    loader.style.display = 'flex';
}

// Hide loading indicator
function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-message">${message}</span>
            <button class="error-close">&times;</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    // Add styles
    if (!document.querySelector('#errorToastStyles')) {
        const styles = document.createElement('style');
        styles.id = 'errorToastStyles';
        styles.textContent = `
            .error-toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 1rem;
                border-radius: 0.5rem;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            }
            .error-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            .error-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.25rem;
                cursor: pointer;
                margin-left: auto;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
    
    // Close button
    errorDiv.querySelector('.error-close')?.addEventListener('click', () => {
        errorDiv.remove();
    });
}

// Show success message
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-toast';
    successDiv.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span class="success-message">${message}</span>
        </div>
    `;
    document.body.appendChild(successDiv);
    
    // Add styles
    if (!document.querySelector('#successToastStyles')) {
        const styles = document.createElement('style');
        styles.id = 'successToastStyles';
        styles.textContent = `
            .success-toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 1rem;
                border-radius: 0.5rem;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }
            .success-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
        `;
        document.head.appendChild(styles);
    }
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Setup connection monitoring
function setupConnectionMonitoring() {
    const connectionStatus = document.getElementById('connectionStatus');
    
    function updateConnectionUI() {
        const isOnline_ = isOnline();
        if (connectionStatus) {
            const dot = connectionStatus.querySelector('.status-dot');
            const text = connectionStatus.querySelector('span:last-child');
            
            if (isOnline_) {
                dot?.classList.remove('offline');
                dot?.classList.add('online');
                if (text) text.textContent = 'Online';
                connectionStatus.title = 'Connected to internet';
            } else {
                dot?.classList.remove('online');
                dot?.classList.add('offline');
                if (text) text.textContent = 'Offline';
                connectionStatus.title = 'Working offline. Changes will sync when connection returns.';
            }
        }
    }
    
    window.addEventListener('online', () => {
        updateConnectionUI();
        showSuccess('Connection restored! Syncing data...');
        // Trigger sync
        if (window.sync && window.sync.processPendingActions) {
            window.sync.processPendingActions();
        }
        // Refresh data
        refreshCurrentPageData();
    });
    
    window.addEventListener('offline', () => {
        updateConnectionUI();
        showError('You are offline. Working with cached data.');
    });
    
    updateConnectionUI();
}

// Setup sync listener for background sync
function setupSyncListener() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('sync-sales');
        });
    }
    
    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_SALES') {
            showSuccess('Syncing pending sales...');
            if (window.sync && window.sync.processPendingActions) {
                window.sync.processPendingActions();
            }
        }
    });
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let salesData = [];
        
        // Try to get from Supabase if online
        if (isOnline() && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('sales')
                .select('*')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString());
            
            if (!error && data) {
                salesData = data;
            }
        } else {
            // Get from local cache
            const cachedSales = await dbGet('sales');
            salesData = cachedSales.filter(sale => {
                const saleDate = new Date(sale.created_at);
                return saleDate >= today && saleDate < tomorrow;
            });
        }
        
        // Calculate today's sales
        const todaySales = salesData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
        const transactionCount = salesData.length;
        const todayProfit = todaySales * 0.4; // Assuming 40% profit margin
        
        // Update UI
        const todaySalesEl = document.getElementById('todaySales');
        const todayProfitEl = document.getElementById('todayProfit');
        const transactionCountEl = document.getElementById('transactionCount');
        
        if (todaySalesEl) todaySalesEl.textContent = `$${todaySales.toFixed(2)}`;
        if (todayProfitEl) todayProfitEl.textContent = `$${todayProfit.toFixed(2)}`;
        if (transactionCountEl) transactionCountEl.textContent = transactionCount;
        
        // Load low stock items
        const products = await db.getCachedProducts();
        const lowStockItems = products.filter(p => (p.quantity || 0) < 10);
        const lowStockCount = document.getElementById('lowStockCount');
        if (lowStockCount) lowStockCount.textContent = lowStockItems.length;
        
        // Display low stock alerts
        displayLowStockAlerts(lowStockItems);
        
        // Display recent transactions
        displayRecentTransactions(salesData.slice(0, 10));
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Display low stock alerts
function displayLowStockAlerts(lowStockItems) {
    const alertsContainer = document.getElementById('lowStockAlerts');
    if (!alertsContainer) return;
    
    if (lowStockItems.length === 0) {
        alertsContainer.innerHTML = '<div class="alert-item success">✅ All stock levels are good!</div>';
        return;
    }
    
    alertsContainer.innerHTML = lowStockItems.slice(0, 10).map(product => `
        <div class="alert-item warning">
            <strong>⚠️ ${product.name}</strong> - Only ${product.quantity} units remaining
            <button onclick="location.href='inventory.html'" class="alert-action">Restock</button>
        </div>
    `).join('');
    
    // Add alert action styles
    if (!document.querySelector('#alertStyles')) {
        const styles = document.createElement('style');
        styles.id = 'alertStyles';
        styles.textContent = `
            .alert-item {
                padding: 0.75rem;
                margin: 0.5rem 0;
                border-left: 3px solid #f59e0b;
                background: #fef3c7;
                border-radius: 0.25rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .alert-item.success {
                border-left-color: #10b981;
                background: #d1fae5;
            }
            .alert-action {
                background: #2563eb;
                color: white;
                border: none;
                padding: 0.25rem 0.75rem;
                border-radius: 0.25rem;
                cursor: pointer;
                font-size: 0.75rem;
            }
            .alert-action:hover {
                background: #1d4ed8;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Display recent transactions
function displayRecentTransactions(transactions) {
    const tbody = document.getElementById('recentTransactionsBody');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No transactions today</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${new Date(transaction.created_at).toLocaleTimeString()}</td>
            <td>${transaction.cashier_id || 'Unknown'}</td>
            <td>$${(transaction.total_amount || 0).toFixed(2)}</td>
            <td><span class="status-badge success">Completed</span></td>
        </tr>
    `).join('');
}

// Update UI based on user role
function updateUIByRole(role) {
    // Hide/show admin-only features
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const managerOnlyElements = document.querySelectorAll('.manager-only');
    
    if (role === 'Admin') {
        adminOnlyElements.forEach(el => el.style.display = 'block');
        managerOnlyElements.forEach(el => el.style.display = 'block');
    } else if (role === 'Store Manager') {
        adminOnlyElements.forEach(el => el.style.display = 'none');
        managerOnlyElements.forEach(el => el.style.display = 'block');
    } else if (role === 'Cashier') {
        adminOnlyElements.forEach(el => el.style.display = 'none');
        managerOnlyElements.forEach(el => el.style.display = 'none');
        
        // Hide certain menu items for cashier
        const reportsLink = document.querySelector('a[href="reports.html"]');
        const expensesLink = document.querySelector('a[href="expenses.html"]');
        if (reportsLink) reportsLink.style.display = 'none';
        if (expensesLink) expensesLink.style.display = 'none';
    }
}

// Setup mobile menu toggle
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
        
        // Close menu when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }
}

// Setup refresh button
function setupRefreshButton() {
    let refreshBtn = document.getElementById('refreshBtn');
    if (!refreshBtn) {
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            refreshBtn = document.createElement('button');
            refreshBtn.id = 'refreshBtn';
            refreshBtn.className = 'btn-refresh';
            refreshBtn.innerHTML = '🔄';
            refreshBtn.title = 'Refresh Data';
            refreshBtn.style.cssText = `
                background: none;
                border: none;
                font-size: 1.25rem;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 0.5rem;
            `;
            refreshBtn.addEventListener('click', refreshCurrentPageData);
            topBar.appendChild(refreshBtn);
        }
    }
}

// Refresh current page data
async function refreshCurrentPageData() {
    showLoading();
    
    try {
        // Sync products first
        await db.syncProductsToLocal();
        
        // Reload based on current page
        const path = window.location.pathname;
        
        if (path.includes('dashboard.html')) {
            await loadDashboardData();
        } else if (path.includes('products.html') && window.productsModule) {
            await window.productsModule.loadProducts();
        } else if (path.includes('inventory.html') && window.inventoryModule) {
            await window.inventoryModule.loadInventory();
        } else if (path.includes('reports.html') && window.reportsModule) {
            await window.reportsModule.generateReport();
        } else if (path.includes('expenses.html') && window.expensesModule) {
            await window.expensesModule.loadExpenses();
        }
        
        showSuccess('Data refreshed successfully!');
    } catch (error) {
        console.error('Refresh error:', error);
        showError('Failed to refresh data');
    } finally {
        hideLoading();
    }
}

// Start periodic data refresh
function startPeriodicRefresh() {
    // Refresh every 5 minutes
    setInterval(() => {
        if (isOnline() && document.hasFocus()) {
            refreshCurrentPageData();
        }
    }, 300000); // 5 minutes
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+R - Refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshCurrentPageData();
        }
        
        // ESC - Close modals
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        }
        
        // Alt+P - Go to POS
        if (e.altKey && e.key === 'p') {
            window.location.href = 'pos.html';
        }
        
        // Alt+D - Go to Dashboard
        if (e.altKey && e.key === 'd') {
            window.location.href = 'dashboard.html';
        }
    });
}

// Export module functions
window.app = {
    init: initApp,
    showLoading,
    hideLoading,
    showSuccess,
    showError,
    refreshData: refreshCurrentPageData
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupKeyboardShortcuts();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initApp };
}
