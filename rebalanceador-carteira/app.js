// Categoria de tipos de ativos
const assetTypes = {
    'acoes-brasil': { name: 'Ações do Brasil', color: '#4caf50', targetAllocation: 0.25 },
    'renda-fixa': { name: 'Renda Fixa', color: '#2196f3', targetAllocation: 0.25 },
    'etf-exterior': { name: 'Ativos Exterior', color: '#ff9800', targetAllocation: 0.25 },
    'imovel': { name: 'Imóveis', color: '#9c27b0', targetAllocation: 0.25 }
};

// Dados da carteira
let portfolio = [];
let charts = {};

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    loadPortfolioFromStorage();
    updateDisplay();
});

// Adicionar ativo
function addAsset() {
    const name = document.getElementById('assetName').value.trim();
    const type = document.getElementById('assetType').value;
    const qty = parseFloat(document.getElementById('assetQty').value);
    const price = parseFloat(document.getElementById('assetPrice').value);

    if (!name || !type || !qty || !price || qty <= 0 || price <= 0) {
        alert('Preencha todos os campos com valores válidos');
        return;
    }

    const asset = {
        id: Date.now(),
        name: name.toUpperCase(),
        type: type,
        quantity: qty,
        price: price,
        value: qty * price
    };

    portfolio.push(asset);
    savePortfolioToStorage();
    clearInputs();
    updateDisplay();
}

// Remover ativo
function removeAsset(id) {
    portfolio = portfolio.filter(asset => asset.id !== id);
    savePortfolioToStorage();
    updateDisplay();
}

// Limpar inputs
function clearInputs() {
    document.getElementById('assetName').value = '';
    document.getElementById('assetType').value = '';
    document.getElementById('assetQty').value = '';
    document.getElementById('assetPrice').value = '';
}

// Atualizar visualização
function updateDisplay() {
    renderAssets();
    updateAnalysis();
    updateRebalanceActions();
}

// Renderizar lista de ativos
function renderAssets() {
    const container = document.getElementById('assetsList');

    if (portfolio.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum ativo adicionado ainda</p>';
        return;
    }

    container.innerHTML = portfolio.map(asset => `
        <div class="asset-item">
            <div class="asset-info">
                <div class="asset-name">${asset.name}</div>
                <div class="asset-details">
                    <span class="asset-type-badge">${assetTypes[asset.type].name}</span>
                    ${asset.quantity.toLocaleString('pt-BR')} unidades × R$ ${asset.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </div>
            </div>
            <div class="asset-value">R$ ${asset.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <button class="btn-delete" onclick="removeAsset(${asset.id})">Remover</button>
        </div>
    `).join('');
}

// Calcular alocação atual
function calculateAllocation() {
    const totalValue = portfolio.reduce((sum, asset) => sum + asset.value, 0);

    if (totalValue === 0) {
        return {
            total: 0,
            byType: {}
        };
    }

    const byType = {};
    const categories = Object.keys(assetTypes);

    categories.forEach(category => {
        const categoryValue = portfolio
            .filter(asset => asset.type === category)
            .reduce((sum, asset) => sum + asset.value, 0);

        byType[category] = {
            value: categoryValue,
            percentage: (categoryValue / totalValue) * 100
        };
    });

    return { total: totalValue, byType };
}

// Atualizar análise
function updateAnalysis() {
    const allocation = calculateAllocation();
    const totalValue = allocation.total;

    // Atualizar valor total
    document.getElementById('totalValue').textContent =
        `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Calcular taxa de desempenho (simplificada)
    const investedValue = portfolio.reduce((sum, asset) => sum + (asset.quantity * asset.price), 0);
    const performance = investedValue > 0 ? ((totalValue - investedValue) / investedValue) * 100 : 0;
    document.getElementById('performanceRate').textContent = `${performance.toFixed(2)}%`;

    // Renderizar gráfico atual
    renderCurrentChart(allocation);

    // Renderizar estatísticas
    renderCurrentStats(allocation);
}

// Renderizar gráfico de alocação atual
function renderCurrentChart(allocation) {
    const ctx = document.getElementById('currentChart').getContext('2d');

    // Destruir gráfico anterior se existir
    if (charts.current) {
        charts.current.destroy();
    }

    const categories = Object.keys(assetTypes);
    const labels = categories.map(cat => assetTypes[cat].name);
    const data = categories.map(cat => allocation.byType[cat]?.percentage || 0);
    const colors = categories.map(cat => assetTypes[cat].color);

    charts.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Renderizar estatísticas
function renderCurrentStats(allocation) {
    const container = document.getElementById('currentStats');
    const categories = Object.keys(assetTypes);

    container.innerHTML = categories.map(category => {
        const data = allocation.byType[category];
        return `
            <div class="stat-item">
                <span class="stat-label">${assetTypes[category].name}</span>
                <span class="stat-value">${data.percentage.toFixed(1)}%</span>
            </div>
        `;
    }).join('');
}

// Renderizar gráfico alvo
function renderTargetChart() {
    const ctx = document.getElementById('targetChart').getContext('2d');

    if (charts.target) {
        charts.target.destroy();
    }

    const categories = Object.keys(assetTypes);
    const labels = categories.map(cat => assetTypes[cat].name);
    const colors = categories.map(cat => assetTypes[cat].color);

    charts.target = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: [25, 25, 25, 25],
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Renderizar gráfico alvo (chamar no carregamento)
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        renderTargetChart();
    }, 100);
});

// Atualizar ações de rebalanceamento
function updateRebalanceActions() {
    const allocation = calculateAllocation();
    const container = document.getElementById('rebalanceActions');
    const totalValue = allocation.total;

    if (totalValue === 0) {
        container.innerHTML = '<p class="empty-state">Adicione ativos para ver as ações necessárias</p>';
        return;
    }

    const actions = [];
    const categories = Object.keys(assetTypes);

    categories.forEach(category => {
        const currentPercentage = allocation.byType[category].percentage;
        const targetPercentage = 25;
        const difference = currentPercentage - targetPercentage;

        if (Math.abs(difference) > 1) { // Apenas mostrar se diferença > 1%
            const differenceValue = (difference / 100) * totalValue;

            let action = {
                category: assetTypes[category].name,
                type: difference > 0 ? 'sell' : 'buy',
                difference: Math.abs(difference),
                amount: Math.abs(differenceValue),
                current: currentPercentage,
                target: targetPercentage
            };

            actions.push(action);
        }
    });

    if (actions.length === 0) {
        container.innerHTML = '<div class="action-item action-hold"><div class="action-header">✅ Carteira Balanceada</div><div class="action-description">Sua carteira está próxima da alocação alvo de 25/25/25/25. Nenhuma ação urgente necessária.</div></div>';
        return;
    }

    // Ordenar por diferença (maior primeiro)
    actions.sort((a, b) => b.difference - a.difference);

    container.innerHTML = actions.map((action, index) => {
        const emoji = action.type === 'sell' ? '📉' : '📈';
        const actionText = action.type === 'sell' ? 'VENDER' : 'COMPRAR';
        const className = `action-item action-${action.type}`;

        return `
            <div class="${className}">
                <div class="action-header">
                    ${emoji} ${actionText}
                    <span class="action-badge">${action.category}</span>
                </div>
                <div class="action-description">
                    Alocação atual: ${action.current.toFixed(1)}% | Alvo: ${action.target.toFixed(1)}% | Diferença: ${action.difference.toFixed(1)}%
                </div>
                <div class="action-amount">
                    R$ ${action.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </div>
        `;
    }).join('');
}

// Exportar dados
function exportData() {
    const allocation = calculateAllocation();

    const report = {
        date: new Date().toLocaleDateString('pt-BR'),
        totalValue: allocation.total,
        assets: portfolio,
        allocation: Object.keys(assetTypes).map(category => ({
            category: assetTypes[category].name,
            currentPercentage: allocation.byType[category].percentage,
            targetPercentage: 25,
            value: allocation.byType[category].value
        }))
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `carteira-rebalanceamento-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Limpar tudo
function clearAll() {
    if (confirm('Tem certeza que deseja limpar toda a carteira?')) {
        portfolio = [];
        savePortfolioToStorage();
        updateDisplay();
    }
}

// Carregar exemplo
function loadExample() {
    portfolio = [
        { id: 1, name: 'GGRC11', type: 'acoes-brasil', quantity: 131, price: 40.50, value: 131 * 40.50 },
        { id: 2, name: 'MXRF11', type: 'acoes-brasil', quantity: 102, price: 12.00, value: 102 * 12.00 },
        { id: 3, name: 'CPTS11', type: 'acoes-brasil', quantity: 110, price: 140.00, value: 110 * 140.00 },
        { id: 4, name: 'SPX11', type: 'etf-exterior', quantity: 11, price: 85.00, value: 11 * 85.00 },
        { id: 5, name: 'JEPQ', type: 'renda-fixa', quantity: 0.00000001, price: 50.00, value: 0.00000001 * 50.00 }
    ];

    savePortfolioToStorage();
    updateDisplay();
}

// Persistência em localStorage
function savePortfolioToStorage() {
    localStorage.setItem('portfolio', JSON.stringify(portfolio));
}

function loadPortfolioFromStorage() {
    const stored = localStorage.getItem('portfolio');
    if (stored) {
        portfolio = JSON.parse(stored);
    }
}
