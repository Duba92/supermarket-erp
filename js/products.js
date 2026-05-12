// Product Management
let currentPage = 1;
let products = [];
let filteredProducts = [];

// Initialize products page
async function initProducts() {
    await db.init();
    await loadProducts();
    setupProductEventListeners();
}

// Load products from cache or server
async function loadProducts() {
    products = await db.getCachedProducts();
    filteredProducts = [...products];
    displayProducts();
}

// Display products in table
function displayProducts() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    const itemsPerPage = 20;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageProducts = filteredProducts.slice(start, end);
    
    if (pageProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = pageProducts.map(product => `
        <tr>
            <td>${product.barcode || '-'}</td>
            <td>${product.name}</td>
            <td>${product.category || '-'}</td>
            <td>$${parseFloat(product.buy_price || 0).toFixed(2)}</td>
            <td>$${parseFloat(product.sell_price || 0).toFixed(2)}</td>
            <td class="${product.quantity < 10 ? 'warning' : ''}">${product.quantity || 0}</td>
            <td>${product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : '-'}</td>
            <td>
                <button onclick="editProduct('${product.id}')" class="btn-icon">✏️</button>
                <button onclick="deleteProduct('${product.id}')" class="btn-icon">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    updatePagination();
}

// Update pagination
function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    const itemsPerPage = 20;
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-controls">';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    html += '</div>';
    pagination.innerHTML = html;
}

// Go to page
function goToPage(page) {
    currentPage = page;
    displayProducts();
}

// Search products
function searchProducts() {
    const searchTerm = document.getElementById('searchProducts')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    
    filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            (product.barcode && product.barcode.includes(searchTerm));
        const matchesCategory = !category || product.category === category;
        return matchesSearch && matchesCategory;
    });
    
    currentPage = 1;
    displayProducts();
}

// Setup event listeners
function setupProductEventListeners() {
    const searchInput = document.getElementById('searchProducts');
    const categoryFilter = document.getElementById('categoryFilter');
    const addBtn = document.getElementById('addProductBtn');
    const importBtn = document.getElementById('importBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchProducts, 300));
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', searchProducts);
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', () => openProductModal());
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', importCSV);
    }
    
    // Modal close
    const modal = document.getElementById('productModal');
    const closeBtn = modal?.querySelector('.close');
    const cancelBtn = modal?.querySelector('.btn-cancel');
    
    if (closeBtn) {
        closeBtn.onclick = () => closeProductModal();
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = () => closeProductModal();
    }
    
    // Form submit
    const form = document.getElementById('productForm');
    if (form) {
        form.addEventListener('submit', saveProduct);
    }
    
    // Click outside modal to close
    window.onclick = (event) => {
        if (event.target === modal) {
            closeProductModal();
        }
    };
}

// Open product modal
function openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('productForm');
    
    if (!modal) return;
    
    if (productId) {
        title.textContent = 'Edit Product';
        const product = products.find(p => p.id == productId);
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('prodName').value = product.name;
            document.getElementById('prodBarcode').value = product.barcode || '';
            document.getElementById('prodCategory').value = product.category || 'Groceries';
            document.getElementById('prodSupplier').value = product.supplier || '';
            document.getElementById('prodBuyPrice').value = product.buy_price || 0;
            document.getElementById('prodSellPrice').value = product.sell_price || 0;
            document.getElementById('prodQuantity').value = product.quantity || 0;
            document.getElementById('prodExpiry').value = product.expiry_date || '';
        }
    } else {
        title.textContent = 'Add Product';
        form.reset();
        document.getElementById('productId').value = '';
    }
    
    modal.style.display = 'block';
}

// Close product modal
function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save product
async function saveProduct(e) {
    e.preventDefault();
    
    const productId = document.getElementById('productId').value;
    const productData = {
        name: document.getElementById('prodName').value,
        barcode: document.getElementById('prodBarcode').value,
        category: document.getElementById('prodCategory').value,
        supplier: document.getElementById('prodSupplier').value,
        buy_price: parseFloat(document.getElementById('prodBuyPrice').value),
        sell_price: parseFloat(document.getElementById('prodSellPrice').value),
        quantity: parseInt(document.getElementById('prodQuantity').value),
        expiry_date: document.getElementById('prodExpiry').value || null,
        updated_at: new Date().toISOString()
    };
    
    try {
        if (productId) {
            // Update existing product
            if (isOnline() && supabaseClient) {
                const { error } = await supabaseClient
                    .from('products')
                    .update(productData)
                    .eq('id', productId);
                
                if (error) throw error;
            }
            
            // Update local
            const index = products.findIndex(p => p.id == productId);
            if (index !== -1) {
                products[index] = { ...products[index], ...productData, id: productId };
                await dbPut('products', products[index]);
            }
        } else {
            // Create new product
            if (isOnline() && supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('products')
                    .insert(productData)
                    .select()
                    .single();
                
                if (error) throw error;
                productData.id = data.id;
            } else {
                productData.id = Date.now();
            }
            
            products.push(productData);
            await dbPut('products', productData);
            
            // Save offline action for later sync
            if (!isOnline()) {
                await saveOfflineAction('create_product', productData);
            }
        }
        
        filteredProducts = [...products];
        displayProducts();
        closeProductModal();
        alert('Product saved successfully!');
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Error saving product: ' + error.message);
    }
}

// Edit product
function editProduct(id) {
    openProductModal(id);
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        if (isOnline() && supabaseClient) {
            const { error } = await supabaseClient
                .from('products')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
        }
        
        // Remove from local
        products = products.filter(p => p.id != id);
        filteredProducts = filteredProducts.filter(p => p.id != id);
        await dbDelete('products', id);
        
        displayProducts();
        alert('Product deleted successfully!');
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product: ' + error.message);
    }
}

// Import CSV
function importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        const rows = text.split('\n');
        const headers = rows[0].split(',');
        
        let imported = 0;
        let errors = 0;
        
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            const values = rows[i].split(',');
            const product = {};
            
            headers.forEach((header, index) => {
                product[header.trim()] = values[index]?.trim();
            });
            
            product.buy_price = parseFloat(product.buy_price) || 0;
            product.sell_price = parseFloat(product.sell_price) || 0;
            product.quantity = parseInt(product.quantity) || 0;
            product.updated_at = new Date().toISOString();
            
            try {
                if (isOnline() && supabaseClient) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .insert(product)
                        .select()
                        .single();
                    
                    if (error) throw error;
                    product.id = data.id;
                } else {
                    product.id = Date.now() + i;
                }
                
                products.push(product);
                await dbPut('products', product);
                imported++;
            } catch (error) {
                errors++;
                console.error('Import error:', error);
            }
        }
        
        filteredProducts = [...products];
        displayProducts();
        alert(`Import complete: ${imported} imported, ${errors} errors`);
    };
    
    input.click();
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

// Export to window
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.goToPage = goToPage;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initProducts();
});
