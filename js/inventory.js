// Inventory Management
let inventoryProducts = [];

// Initialize inventory page
async function initInventory() {
    await db.init();
    await loadInventory();
    setupInventoryEventListeners();
}

// Load inventory
async function loadInventory() {
    inventoryProducts = await db.getCachedProducts();
    displayInventory();
    populateProductSelect();
    checkStockAlerts();
}

// Display inventory
function displayInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    const searchTerm = document.getElementById('searchInventory')?.value.toLowerCase() || '';
    
    if (!tbody) return;
    
    let filtered = inventoryProducts;
    if (searchTerm) {
        filtered = inventoryProducts.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.barcode && p.barcode.includes(searchTerm))
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(product => {
        const status = getStockStatus(product.quantity);
        return `
            <tr>
                <td>${product.name}</td>
                <td class="${product.quantity < 10 ? 'warning' : ''}">${product.quantity || 0}</td>
                <td>10</td>
                <td><span class="status-badge ${status.class}">${status.text}</span></td>
                <td>${product.updated_at ? new Date(product.updated_at).toLocaleDateString() : '-'}</td>
            </tr>
        `;
    }).join('');
}

// Get stock status
function getStockStatus(quantity) {
    if (quantity <= 0) return { text: 'Out of Stock', class: 'danger' };
    if (quantity < 10) return { text: 'Low Stock', class: 'warning' };
    if (quantity < 50) return { text: 'Medium', class: 'info' };
    return { text: 'Good', class: 'success' };
}

// Populate product select dropdown
function populateProductSelect() {
    const select = document.getElementById('stockProduct');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Product</option>' +
        inventoryProducts.map(product => 
            `<option value="${product.id}">${product.name} (Stock: ${product.quantity || 0})</option>`
        ).join('');
}

// Setup event listeners
function setupInventoryEventListeners() {
    const updateBtn = document.getElementById('updateStockBtn');
    const searchInput = document.getElementById('searchInventory');
    
    if (updateBtn) {
        updateBtn.addEventListener('click', updateStock);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(displayInventory, 300));
    }
}

// Update stock
async function updateStock() {
    const productId = document.getElementById('stockProduct')?.value;
    const stockType = document.getElementById('stockType')?.value;
    const quantity = parseInt(document.getElementById('stockQuantity')?.value);
    const reason = document.getElementById('stockReason')?.value;
    
    if (!productId) {
        alert('Please select a product');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }
    
    const product = inventoryProducts.find(p => p.id == productId);
    if (!product) return;
    
    const stockData = {
        product_id: productId,
        type: stockType,
        quantity: quantity,
        reason: reason,
        timestamp: new Date().toISOString()
    };
    
    try {
        if (isOnline() && supabaseClient) {
            // Update online
            const newQuantity = stockType === 'in' 
                ? (product.quantity || 0) + quantity 
                : (product.quantity || 0) - quantity;
            
            const { error } = await supabaseClient
                .from('products')
                .update({ 
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId);
            
            if (error) throw error;
            
            product.quantity = newQuantity;
        } else {
            // Offline - save action for later
            const newQuantity = stockType === 'in' 
                ? (product.quantity || 0) + quantity 
                : (product.quantity || 0) - quantity;
            product.quantity = newQuantity;
            await saveOfflineAction('update_stock', stockData);
        }
        
        // Update local
        await dbPut('products', product);
        
        // Refresh displays
        await loadInventory();
        
        alert(`Stock updated successfully! New quantity: ${product.quantity}`);
        
        // Clear form
        document.getElementById('stockQuantity').value = '';
        document.getElementById('stockReason').value = '';
        
    } catch (error) {
        console.error('Error updating stock:', error);
        alert('Error updating stock: ' + error.message);
    }
}

// Check stock alerts
function checkStockAlerts() {
    const alertBanner = document.getElementById('alertBanner');
    if (!alertBanner) return;
    
    const lowStockItems = inventoryProducts.filter(p => (p.quantity || 0) < 10);
    const expiredItems = inventoryProducts.filter(p => {
        if (!p.expiry_date) return false;
        const expiryDate = new Date(p.expiry_date);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
    });
    
    let alertHtml = '';
    
    if (lowStockItems.length > 0) {
        alertHtml += `<div class="alert-item warning">
            ⚠️ Low stock alert: ${lowStockItems.length} product(s) have less than 10 units remaining.
        </div>`;
    }
    
    if (expiredItems.length > 0) {
        alertHtml += `<div class="alert-item danger">
            ⚠️ Expiry alert: ${expiredItems.length} product(s) will expire within 7 days.
        </div>`;
    }
    
    alertBanner.innerHTML = alertHtml;
}

// Debounce utility
function debounce(func, wait) {
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initInventory();
});
