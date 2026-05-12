// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered successfully');
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// Offline status monitoring
function initOfflineMonitoring() {
    const statusElement = document.getElementById('connectionStatus');
    const offlineBadge = document.getElementById('offlineBadge');
    
    function updateStatus() {
        const isOnline_ = isOnline();
        
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            const text = statusElement.querySelector('span:last-child');
            
            if (isOnline_) {
                dot?.classList.remove('offline');
                dot?.classList.add('online');
                if (text) text.textContent = 'Online';
            } else {
                dot?.classList.remove('online');
                dot?.classList.add('offline');
                if (text) text.textContent = 'Offline';
            }
        }
        
        if (offlineBadge) {
            offlineBadge.style.display = isOnline_ ? 'none' : 'block';
        }
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('connectionChange', { detail: { online: isOnline_ } }));
    }
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// Save offline action
async function saveOfflineAction(action, data) {
    const offlineAction = {
        id: Date.now(),
        action: action,
        data: data,
        timestamp: new Date().toISOString(),
        retryCount: 0
    };
    
    await dbPut('offline_actions', offlineAction);
    return offlineAction;
}

// Get pending offline actions
async function getPendingActions() {
    return await dbGet('offline_actions');
}

// Remove processed action
async function removeOfflineAction(id) {
    await dbDelete('offline_actions', id);
}

// Cache product data
async function cacheProducts(products) {
    for (const product of products) {
        await dbPut('products', product);
    }
}

// Get cached product by barcode
async function getCachedProductByBarcode(barcode) {
    const products = await dbGet('products');
    return products.find(p => p.barcode === barcode);
}

// Cache sale locally
async function cacheSale(saleData) {
    const sale = {
        ...saleData,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        id: Date.now()
    };
    
    await dbPut('sales', sale);
    await saveOfflineAction('create_sale', sale);
    
    return sale;
}

// Get pending sales
async function getPendingSales() {
    const sales = await dbGet('sales');
    return sales.filter(s => s.sync_status === 'pending');
}

// Update sync status
async function updateSaleSyncStatus(saleId, status) {
    const sales = await dbGet('sales');
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
        sale.sync_status = status;
        await dbPut('sales', sale);
    }
}

// Preload critical data
async function preloadCriticalData() {
    if (isOnline()) {
        await db.syncProductsToLocal();
    } else {
        // Load from cache
        const cachedProducts = await db.getCachedProducts();
        if (cachedProducts.length === 0) {
            console.warn('No cached products available offline');
        }
    }
}

// Check for updates
async function checkForUpdates() {
    if (isOnline()) {
        await db.syncProductsToLocal();
        // Trigger sync for pending actions
        if (window.sync && window.sync.processPendingActions) {
            await window.sync.processPendingActions();
        }
    }
}

// Initialize offline features
document.addEventListener('DOMContentLoaded', () => {
    initOfflineMonitoring();
    preloadCriticalData();
    
    // Check for updates periodically
    setInterval(checkForUpdates, 30000); // every 30 seconds
});

// Export functions
window.offline = {
    saveOfflineAction,
    getPendingActions,
    removeOfflineAction,
    cacheSale,
    getPendingSales,
    updateSaleSyncStatus,
    getCachedProductByBarcode,
    isOnline: () => navigator.onLine
};
