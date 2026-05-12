// Sync Engine

// Process pending offline actions
async function processPendingActions() {
    if (!isOnline()) {
        console.log('Offline: Cannot sync, waiting for connection');
        return false;
    }
    
    const pendingActions = await getPendingActions();
    
    if (pendingActions.length === 0) {
        return true;
    }
    
    console.log(`Syncing ${pendingActions.length} pending actions...`);
    
    for (const action of pendingActions) {
        try {
            await processAction(action);
            await removeOfflineAction(action.id);
            console.log(`Synced action: ${action.action}`);
        } catch (error) {
            console.error(`Failed to sync action ${action.id}:`, error);
            action.retryCount++;
            if (action.retryCount >= 5) {
                console.error(`Action ${action.id} failed after 5 retries`);
                await removeOfflineAction(action.id);
            } else {
                await dbPut('offline_actions', action);
            }
        }
    }
    
    return true;
}

// Process individual action
async function processAction(action) {
    switch (action.action) {
        case 'create_sale':
            await syncSaleToSupabase(action.data);
            break;
        case 'update_stock':
            await syncStockUpdateToSupabase(action.data);
            break;
        case 'add_expense':
            await syncExpenseToSupabase(action.data);
            break;
        default:
            console.warn(`Unknown action type: ${action.action}`);
    }
}

// Sync sale to Supabase
async function syncSaleToSupabase(saleData) {
    if (!supabaseClient) throw new Error('Supabase not initialized');
    
    // Create sale
    const { data: sale, error: saleError } = await supabaseClient
        .from('sales')
        .insert({
            cashier_id: saleData.cashier_id,
            total_amount: saleData.total_amount,
            payment_method: saleData.payment_method,
            status: saleData.status
        })
        .select()
        .single();
    
    if (saleError) throw saleError;
    
    // Create sale items
    for (const item of saleData.items) {
        const { error: itemError } = await supabaseClient
            .from('sale_items')
            .insert({
                sale_id: sale.id,
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            });
        
        if (itemError) throw itemError;
        
        // Update stock
        const { data: product } = await supabaseClient
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single();
        
        await supabaseClient
            .from('products')
            .update({ quantity: product.quantity - item.quantity })
            .eq('id', item.product_id);
    }
    
    // Update local sale sync status
    await updateSaleSyncStatus(saleData.local_id, 'synced');
    
    return sale;
}

// Sync stock update
async function syncStockUpdateToSupabase(stockData) {
    if (!supabaseClient) throw new Error('Supabase not initialized');
    
    const { data: product } = await supabaseClient
        .from('products')
        .select('quantity')
        .eq('id', stockData.product_id)
        .single();
    
    const newQuantity = stockData.type === 'in' 
        ? product.quantity + stockData.quantity 
        : product.quantity - stockData.quantity;
    
    const { error } = await supabaseClient
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', stockData.product_id);
    
    if (error) throw error;
}

// Sync expense
async function syncExpenseToSupabase(expenseData) {
    if (!supabaseClient) throw new Error('Supabase not initialized');
    
    const { error } = await supabaseClient
        .from('expenses')
        .insert({
            title: expenseData.title,
            amount: expenseData.amount,
            description: expenseData.description,
            created_at: expenseData.created_at
        });
    
    if (error) throw error;
}

// Auto-sync when online
function setupAutoSync() {
    let syncInterval = null;
    
    function startSync() {
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(() => {
            if (isOnline()) {
                processPendingActions();
            }
        }, 60000); // Sync every minute
    }
    
    window.addEventListener('online', () => {
        console.log('Connection restored, syncing...');
        processPendingActions();
        db.syncProductsToLocal();
    });
    
    startSync();
}

// Manual sync trigger
async function manualSync() {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
    }
    
    await processPendingActions();
    await db.syncProductsToLocal();
    
    if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Now';
    }
    
    alert('Sync completed!');
}

// Sync status indicator
function updateSyncStatus() {
    const pendingActions = getPendingActions();
    const syncStatus = document.getElementById('syncStatus');
    
    if (syncStatus) {
        const pendingCount = pendingActions.length;
        if (pendingCount > 0) {
            syncStatus.innerHTML = `📤 ${pendingCount} pending sync`;
            syncStatus.style.display = 'block';
        } else {
            syncStatus.style.display = 'none';
        }
    }
}

// Initialize sync
document.addEventListener('DOMContentLoaded', () => {
    setupAutoSync();
    
    // Add sync button if on dashboard
    const topBar = document.querySelector('.top-bar');
    if (topBar && !document.getElementById('syncBtn')) {
        const syncBtn = document.createElement('button');
        syncBtn.id = 'syncBtn';
        syncBtn.className = 'btn-secondary';
        syncBtn.textContent = 'Sync Now';
        syncBtn.onclick = manualSync;
        syncBtn.style.marginLeft = 'auto';
        topBar.appendChild(syncBtn);
    }
});

// Export functions
window.sync = {
    processPendingActions,
    manualSync,
    getPendingActions: () => getPendingActions()
};
