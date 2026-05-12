// POS System
let currentCart = [];
let productsCache = [];

// Initialize POS
async function initPOS() {
    await db.init();
    
    // Load products
    productsCache = await db.getCachedProducts();
    
    // Setup event listeners
    setupPOSEventListeners();
    
    // Focus on barcode input
    document.getElementById('barcodeInput')?.focus();
    
    // Load cart from session storage if exists
    loadCartFromStorage();
}

// Setup POS event listeners
function setupPOSEventListeners() {
    const barcodeInput = document.getElementById('barcodeInput');
    const searchBtn = document.querySelector('.search-btn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (barcodeInput) {
        barcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addProductByBarcode(barcodeInput.value);
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'c' || e.key === 'C') {
                clearCart();
            } else if (e.key === 'f' || e.key === 'F') {
                applyCoupon();
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            addProductByBarcode(barcodeInput.value);
        });
    }
    
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }
}

// Add product by barcode
async function addProductByBarcode(barcode) {
    if (!barcode) return;
    
    // Search in local cache first
    let product = productsCache.find(p => p.barcode === barcode);
    
    // If not found, try online
    if (!product && isOnline() && supabaseClient) {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('barcode', barcode)
            .single();
        
        if (!error && data) {
            product = data;
        }
    }
    
    if (product) {
        addToCart(product);
        document.getElementById('barcodeInput').value = '';
        document.getElementById('barcodeInput').focus();
    } else {
        alert('Product not found!');
    }
}

// Add product to cart
function addToCart(product) {
    const existingItem = currentCart.find(item => item.product.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
        existingItem.subtotal = existingItem.quantity * existingItem.price;
    } else {
        currentCart.push({
            product: product,
            quantity: 1,
            price: product.sell_price,
            subtotal: product.sell_price
        });
    }
    
    updateCartDisplay();
    saveCartToStorage();
}

// Update cart display
function updateCartDisplay() {
    const cartContainer = document.getElementById('cartItems');
    const subtotalSpan = document.getElementById('subtotal');
    const taxSpan = document.getElementById('tax');
    const totalSpan = document.getElementById('total');
    
    if (!cartContainer) return;
    
    if (currentCart.length === 0) {
        cartContainer.innerHTML = '<div class="empty-cart">Cart is empty. Scan or search products...</div>';
    } else {
        cartContainer.innerHTML = currentCart.map(item => `
            <div class="cart-item">
                <span>${item.product.name}</span>
                <div class="cart-item-quantity">
                    <button onclick="updateQuantity(${item.product.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity(${item.product.id}, 1)">+</button>
                </div>
                <span>$${item.price.toFixed(2)}</span>
                <span>$${item.subtotal.toFixed(2)}</span>
                <button onclick="removeFromCart(${item.product.id})" style="background:none;border:none;cursor:pointer;">🗑️</button>
            </div>
        `).join('');
    }
    
    // Calculate totals
    const subtotal = currentCart.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.10; // 10% tax
    const total = subtotal + tax;
    
    if (subtotalSpan) subtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
    if (taxSpan) taxSpan.textContent = `$${tax.toFixed(2)}`;
    if (totalSpan) totalSpan.textContent = `$${total.toFixed(2)}`;
}

// Update quantity
function updateQuantity(productId, change) {
    const item = currentCart.find(item => item.product.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            item.subtotal = item.quantity * item.price;
            updateCartDisplay();
            saveCartToStorage();
        }
    }
}

// Remove from cart
function removeFromCart(productId) {
    currentCart = currentCart.filter(item => item.product.id !== productId);
    updateCartDisplay();
    saveCartToStorage();
}

// Clear entire cart
function clearCart() {
    if (confirm('Clear entire cart?')) {
        currentCart = [];
        updateCartDisplay();
        saveCartToStorage();
        document.getElementById('barcodeInput')?.focus();
    }
}

// Apply coupon
function applyCoupon() {
    const discount = prompt('Enter discount percentage (0-100):');
    if (discount && !isNaN(discount)) {
        const totalSpan = document.getElementById('total');
        const currentTotal = parseFloat(totalSpan.textContent.replace('$', ''));
        const newTotal = currentTotal * (1 - discount / 100);
        totalSpan.textContent = `$${newTotal.toFixed(2)}`;
        alert(`Discount applied! New total: $${newTotal.toFixed(2)}`);
    }
}

// Checkout
async function checkout() {
    if (currentCart.length === 0) {
        alert('Cart is empty!');
        return;
    }
    
    const paymentMethod = document.getElementById('paymentMethod')?.value || 'cash';
    const totalSpan = document.getElementById('total');
    const totalAmount = parseFloat(totalSpan.textContent.replace('$', ''));
    
    const saleData = {
        items: currentCart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal
        })),
        total_amount: totalAmount,
        payment_method: paymentMethod,
        cashier_id: getCurrentUser()?.id || '1',
        status: 'completed'
    };
    
    if (isOnline()) {
        // Process online
        await processSaleOnline(saleData);
    } else {
        // Save offline
        await processSaleOffline(saleData);
    }
    
    // Print receipt
    printReceipt(saleData);
    
    // Clear cart
    clearCart();
    
    alert('Sale completed successfully!');
}

// Process sale online
async function processSaleOnline(saleData) {
    try {
        // Create sale record
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
            
            // Update product stock
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
        
        return sale;
    } catch (error) {
        console.error('Online sale error:', error);
        // Fallback to offline
        return await processSaleOffline(saleData);
    }
}

// Process sale offline
async function processSaleOffline(saleData) {
    const offlineSale = {
        ...saleData,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        local_id: Date.now()
    };
    
    await offline.cacheSale(offlineSale);
    
    // Update local product stock
    for (const item of saleData.items) {
        const product = productsCache.find(p => p.id === item.product_id);
        if (product) {
            product.quantity -= item.quantity;
            await dbPut('products', product);
        }
    }
    
    return offlineSale;
}

// Print receipt
function printReceipt(saleData) {
    const receiptWindow = window.open('', '_blank');
    const user = getCurrentUser();
    
    receiptWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt</title>
            <style>
                body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 1px dashed #000; margin-bottom: 10px; }
                .items { margin: 10px 0; }
                .item { display: flex; justify-content: space-between; margin: 5px 0; }
                .total { border-top: 1px solid #000; margin-top: 10px; padding-top: 10px; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Supermarket</h2>
                <p>${new Date().toLocaleString()}</p>
                <p>Cashier: ${user?.name || 'Unknown'}</p>
            </div>
            <div class="items">
                ${saleData.items.map(item => `
                    <div class="item">
                        <span>${item.product?.name || 'Product'} x${item.quantity}</span>
                        <span>$${item.subtotal.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="total">
                <div class="item"><strong>Total:</strong><strong>$${saleData.total_amount.toFixed(2)}</strong></div>
                <div class="item">Payment: ${saleData.payment_method}</div>
            </div>
            <div class="footer">
                <p>Thank you for shopping!</p>
                <p>** Receipt **</p>
            </div>
            <script>window.print(); setTimeout(() => window.close(), 1000);<\/script>
        </body>
        </html>
    `);
    receiptWindow.document.close();
}

// Save cart to session storage
function saveCartToStorage() {
    sessionStorage.setItem('pos_cart', JSON.stringify(currentCart));
}

// Load cart from session storage
function loadCartFromStorage() {
    const savedCart = sessionStorage.getItem('pos_cart');
    if (savedCart) {
        currentCart = JSON.parse(savedCart);
        updateCartDisplay();
    }
}

// Export functions
window.pos = {
    initPOS,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    checkout
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initPOS();
});
