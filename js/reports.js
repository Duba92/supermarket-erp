// Reports Module
let salesChart = null;
let currentReportData = null;

// Initialize reports
async function initReports() {
    await db.init();
    setupReportEventListeners();
    setDefaultDates();
    generateReport();
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    
    if (startInput) {
        startInput.value = startDate.toISOString().split('T')[0];
    }
    if (endInput) {
        endInput.value = today.toISOString().split('T')[0];
    }
}

// Setup event listeners
function setupReportEventListeners() {
    const generateBtn = document.getElementById('generateReportBtn');
    const exportBtn = document.getElementById('exportCSVBtn');
    const printBtn = document.getElementById('printReportBtn');
    const periodSelect = document.getElementById('reportPeriod');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', generateReport);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    if (printBtn) {
        printBtn.addEventListener('click', printReport);
    }
    
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            const period = e.target.value;
            const today = new Date();
            let startDate = new Date();
            
            switch(period) {
                case 'daily':
                    startDate = today;
                    break;
                case 'weekly':
                    startDate.setDate(today.getDate() - 7);
                    break;
                case 'monthly':
                    startDate.setMonth(today.getMonth() - 1);
                    break;
            }
            
            document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
            document.getElementById('endDate').value = today.toISOString().split('T')[0];
            generateReport();
        });
    }
}

// Generate report
async function generateReport() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    
    if (!startDate || !endDate) {
        alert('Please select date range');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    
    try {
        let salesData = [];
        
        if (isOnline() && supabaseClient) {
            // Get sales from Supabase
            const { data, error } = await supabaseClient
                .from('sales')
                .select(`
                    *,
                    sale_items (*),
                    users (name)
                `)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());
            
            if (error) throw error;
            salesData = data || [];
        } else {
            // Get from local cache
            const cachedSales = await dbGet('sales');
            salesData = cachedSales.filter(sale => {
                const saleDate = new Date(sale.created_at);
                return saleDate >= start && saleDate <= end;
            });
        }
        
        // Process report data
        const report = processReportData(salesData);
        currentReportData = report;
        
        // Update UI
        updateReportUI(report);
        updateSalesTable(salesData);
        updateBestSellers(salesData);
        updateSalesChart(salesData);
        
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report: ' + error.message);
    }
}

// Process report data
function processReportData(salesData) {
    let totalSales = 0;
    let totalTransactions = salesData.length;
    let totalCost = 0;
    
    for (const sale of salesData) {
        totalSales += sale.total_amount || 0;
        
        // Calculate cost (assuming 60% of sale price is cost)
        totalCost += (sale.total_amount || 0) * 0.6;
    }
    
    const totalProfit = totalSales - totalCost;
    const avgSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    return {
        totalSales,
        totalProfit,
        totalTransactions,
        avgSale
    };
}

// Update report UI
function updateReportUI(report) {
    const totalSalesEl = document.getElementById('totalSales');
    const totalProfitEl = document.getElementById('totalProfit');
    const totalTransactionsEl = document.getElementById('totalTransactions');
    const avgSaleEl = document.getElementById('avgSale');
    
    if (totalSalesEl) totalSalesEl.textContent = `$${report.totalSales.toFixed(2)}`;
    if (totalProfitEl) totalProfitEl.textContent = `$${report.totalProfit.toFixed(2)}`;
    if (totalTransactionsEl) totalTransactionsEl.textContent = report.totalTransactions;
    if (avgSaleEl) avgSaleEl.textContent = `$${report.avgSale.toFixed(2)}`;
}

// Update sales table
function updateSalesTable(salesData) {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;
    
    if (salesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No sales found</td></tr>';
        return;
    }
    
    tbody.innerHTML = salesData.slice(0, 50).map(sale => `
        <tr>
            <td>${new Date(sale.created_at).toLocaleString()}</td>
            <td>${sale.users?.name || 'Unknown'}</td>
            <td>$${(sale.total_amount || 0).toFixed(2)}</td>
            <td>${sale.payment_method || 'cash'}</td>
        </tr>
    `).join('');
}

// Update best sellers
async function updateBestSellers(salesData) {
    const tbody = document.getElementById('bestSellersBody');
    if (!tbody) return;
    
    // Aggregate sales by product
    const productSales = {};
    
    for (const sale of salesData) {
        if (sale.sale_items) {
            for (const item of sale.sale_items) {
                if (!productSales[item.product_id]) {
                    productSales[item.product_id] = {
                        quantity: 0,
                        revenue: 0,
                        name: 'Loading...'
                    };
                }
                productSales[item.product_id].quantity += item.quantity;
                productSales[item.product_id].revenue += item.subtotal;
            }
        }
    }
    
    // Get product names
    const products = await db.getCachedProducts();
    for (const [productId, data] of Object.entries(productSales)) {
        const product = products.find(p => p.id == productId);
        if (product) {
            data.name = product.name;
        }
    }
    
    // Sort by quantity
    const sorted = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>$${item.revenue.toFixed(2)}</td>
        </tr>
    `).join('');
}

// Update sales chart
function updateSalesChart(salesData) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    
    // Group sales by date
    const salesByDate = {};
    
    for (const sale of salesData) {
        const date = new Date(sale.created_at).toLocaleDateString();
        if (!salesByDate[date]) {
            salesByDate[date] = 0;
        }
        salesByDate[date] += sale.total_amount || 0;
    }
    
    const dates = Object.keys(salesByDate).sort();
    const amounts = dates.map(date => salesByDate[date]);
    
    // Destroy existing chart
    if (salesChart) {
        salesChart.destroy();
    }
    
    // Create new chart
    const ctx = canvas.getContext('2d');
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Sales Amount',
                data: amounts,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `$${context.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `$${value}`
                    }
                }
            }
        }
    });
}

// Export to CSV
function exportToCSV() {
    if (!currentReportData) {
        alert('Generate a report first');
        return;
    }
    
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    
    const csvContent = [
        ['Supermarket Sales Report'],
        [`Period: ${startDate} to ${endDate}`],
        [''],
        ['Summary'],
        [`Total Sales,$${currentReportData.totalSales.toFixed(2)}`],
        [`Total Profit,$${currentReportData.totalProfit.toFixed(2)}`],
        [`Total Transactions,${currentReportData.totalTransactions}`],
        [`Average Sale,$${currentReportData.avgSale.toFixed(2)}`],
        [''],
        ['Generated on', new Date().toLocaleString()]
    ];
    
    const blob = new Blob([csvContent.map(row => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Print report
function printReport() {
    const printContent = document.querySelector('.content').cloneNode(true);
    const originalContent = document.body.innerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sales Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
                .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                @media print {
                    .report-filters, button { display: none; }
                }
            </style>
        </head>
        <body>
            ${printContent.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initReports();
});
