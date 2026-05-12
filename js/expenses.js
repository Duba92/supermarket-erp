// Expense Tracking Module
let expenses = [];

// Initialize expenses page
async function initExpenses() {
    await db.init();
    await loadExpenses();
    setupExpenseEventListeners();
}

// Load expenses
async function loadExpenses() {
    if (isOnline() && supabaseClient) {
        const { data, error } = await supabaseClient
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            expenses = data;
            await cacheExpensesLocally(expenses);
        } else {
            expenses = await getCachedExpenses();
        }
    } else {
        expenses = await getCachedExpenses();
    }
    
    displayExpenses();
    updateExpenseSummary();
}

// Get cached expenses
async function getCachedExpenses() {
    return await dbGet('expenses') || [];
}

// Cache expenses locally
async function cacheExpensesLocally(expensesData) {
    await dbClear('expenses');
    for (const expense of expensesData) {
        await dbPut('expenses', expense);
    }
}

// Display expenses
function displayExpenses() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    
    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No expenses recorded</td></tr>';
        return;
    }
    
    tbody.innerHTML = expenses.slice(0, 100).map(expense => `
        <tr>
            <td>${new Date(expense.created_at).toLocaleDateString()}</td>
            <td>${expense.title}</td>
            <td class="${expense.amount > 1000 ? 'warning' : ''}">$${parseFloat(expense.amount).toFixed(2)}</td>
            <td>${expense.description || '-'}</td>
            <td>
                <button onclick="deleteExpense('${expense.id}')" class="btn-icon">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Update expense summary
function updateExpenseSummary() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    let todayTotal = 0;
    let monthTotal = 0;
    let totalAll = 0;
    
    for (const expense of expenses) {
        const expenseDate = new Date(expense.created_at);
        const expenseDateStr = expenseDate.toISOString().split('T')[0];
        
        totalAll += expense.amount;
        
        if (expenseDateStr === today) {
            todayTotal += expense.amount;
        }
        
        if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
            monthTotal += expense.amount;
        }
    }
    
    const todayEl = document.getElementById('todayExpenses');
    const monthEl = document.getElementById('monthExpenses');
    const totalEl = document.getElementById('totalExpenses');
    
    if (todayEl) todayEl.textContent = `$${todayTotal.toFixed(2)}`;
    if (monthEl) monthEl.textContent = `$${monthTotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${totalAll.toFixed(2)}`;
}

// Setup event listeners
function setupExpenseEventListeners() {
    const addBtn = document.getElementById('addExpenseBtn');
    const modal = document.getElementById('expenseModal');
    const closeBtn = modal?.querySelector('.close');
    const cancelBtn = modal?.querySelector('.btn-cancel');
    const form = document.getElementById('expenseForm');
    
    if (addBtn) {
        addBtn.addEventListener('click', () => openExpenseModal());
    }
    
    if (closeBtn) {
        closeBtn.onclick = () => closeExpenseModal();
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = () => closeExpenseModal();
    }
    
    if (form) {
        form.addEventListener('submit', saveExpense);
    }
    
    window.onclick = (event) => {
        if (event.target === modal) {
            closeExpenseModal();
        }
    };
}

// Open expense modal
function openExpenseModal() {
    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    if (modal) {
        form.reset();
        modal.style.display = 'block';
    }
}

// Close expense modal
function closeExpenseModal() {
    const modal = document.getElementById('expenseModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save expense
async function saveExpense(e) {
    e.preventDefault();
    
    const expenseData = {
        title: document.getElementById('expenseTitle').value,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        category: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value,
        created_at: new Date().toISOString()
    };
    
    if (!expenseData.title || !expenseData.amount) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        if (isOnline() && supabaseClient) {
            const { data, error } = await supabaseClient
                .from('expenses')
                .insert(expenseData)
                .select()
                .single();
            
            if (error) throw error;
            expenseData.id = data.id;
        } else {
            expenseData.id = Date.now();
            await saveOfflineAction('add_expense', expenseData);
        }
        
        expenses.unshift(expenseData);
        await dbPut('expenses', expenseData);
        
        displayExpenses();
        updateExpenseSummary();
        closeExpenseModal();
        
        alert('Expense saved successfully!');
    } catch (error) {
        console.error('Error saving expense:', error);
        alert('Error saving expense: ' + error.message);
    }
}

// Delete expense
async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
        if (isOnline() && supabaseClient) {
            const { error } = await supabaseClient
                .from('expenses')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
        }
        
        expenses = expenses.filter(e => e.id != id);
        await dbDelete('expenses', id);
        
        displayExpenses();
        updateExpenseSummary();
        
        alert('Expense deleted successfully!');
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense: ' + error.message);
    }
}

// Export to window
window.deleteExpense = deleteExpense;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initExpenses();
});
