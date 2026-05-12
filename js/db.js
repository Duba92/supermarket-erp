// Supabase Configuration
const SUPABASE_URL = 'https://yqttjaobknytsssfujht.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Global variables
let supabaseClient = null;
let currentUser = null;
let dbInitialized = false;

// IndexedDB setup
const DB_NAME = 'SupermarketERP';
const DB_VERSION = 1;
let indexedDB = null;

// Initialize Supabase
async function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase library not loaded yet');
        return false;
    }
    
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Test connection
    const { data, error } = await supabaseClient.from('users').select('count', { count: 'exact', head: true });
    
    if (error) {
        console.warn('Supabase connection issue:', error);
        return false;
    }
    
    return true;
}

// Initialize IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            indexedDB = request.result;
            dbInitialized = true;
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create stores for offline data
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'id' });
                productStore.createIndex('barcode', 'barcode', { unique: false });
                productStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('sales')) {
                const saleStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                saleStore.createIndex('sync_status', 'sync_status');
                saleStore.createIndex('created_at', 'created_at');
            }
            
            if (!db.objectStoreNames.contains('sale_items')) {
                db.createObjectStore('sale_items', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('offline_actions')) {
                db.createObjectStore('offline_actions', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('cache_metadata')) {
                db.createObjectStore('cache_metadata', { keyPath: 'key' });
            }
        };
    });
}

// Generic database operations
async function dbGet(store, query = null) {
    if (!dbInitialized) await initIndexedDB();
    
    return new Promise((resolve, reject) => {
        const transaction = indexedDB.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbPut(store, data) {
    if (!dbInitialized) await initIndexedDB();
    
    return new Promise((resolve, reject) => {
        const transaction = indexedDB.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.put(data);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbDelete(store, id) {
    if (!dbInitialized) await initIndexedDB();
    
    return new Promise((resolve, reject) => {
        const transaction = indexedDB.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function dbClear(store) {
    if (!dbInitialized) await initIndexedDB();
    
    return new Promise((resolve, reject) => {
        const transaction = indexedDB.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Sync data from Supabase to IndexedDB
async function syncProductsToLocal() {
    if (!isOnline()) return false;
    
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        // Clear and repopulate local products
        await dbClear('products');
        
        for (const product of data) {
            await dbPut('products', product);
        }
        
        // Update cache metadata
        await dbPut('cache_metadata', {
            key: 'last_sync_products',
            value: new Date().toISOString()
        });
        
        return true;
    } catch (error) {
        console.error('Error syncing products:', error);
        return false;
    }
}

// Get cached products
async function getCachedProducts() {
    try {
        return await dbGet('products');
    } catch (error) {
        console.error('Error getting cached products:', error);
        return [];
    }
}

// Check online status
function isOnline() {
    return navigator.onLine;
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

// Set current user
function setCurrentUser(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
}

// Clear current user
function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem('currentUser');
}

// Initialize everything
async function initializeDatabase() {
    await initIndexedDB();
    
    if (isOnline() && supabaseClient) {
        await syncProductsToLocal();
    }
}

// Export functions
window.db = {
    get: dbGet,
    put: dbPut,
    delete: dbDelete,
    clear: dbClear,
    init: initializeDatabase,
    getCachedProducts,
    syncProductsToLocal
};
