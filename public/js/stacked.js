let chartInstance;
const frenchMonths = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const monthColors = [
    '#1f77b4', // Blue - Janvier
    '#ff7f0e', // Orange - Février
    '#2ca02c', // Green - Mars
    '#d62728', // Red - Avril
    '#9467bd', // Purple - Mai
    '#8c564b', // Brown - Juin
    '#e377c2', // Pink - Juillet
    '#7f7f7f', // Gray - Août
    '#bcbd22', // Yellow-Green - Septembre
    '#17becf', // Cyan - Octobre
    '#bc79af', // Plum - Novembre
    '#aec7e8'  // Light Blue - Décembre
];

async function updateChart() {
    const year = document.getElementById('yearSelect').value;

    try {
        const response = await fetch(`/charts/stacked-data?year=${year}`);
        if (!response.ok) throw new Error('Échec du chargement des données');
        const data = await response.json();

        renderTable(data);
        renderChart(data);
    } catch (error) {
        console.error(error);
        alert('Une erreur s\'est produite lors du chargement des données');
    }
}

function getActiveMonths(data) {
    const activeMonths = [];
    for (let month = 1; month <= 12; month++) {
        let hasData = false;
        for (const user in data) {
            if (data[user][month - 1] > 0) {
                hasData = true;
                break;
            }
        }
        if (hasData) activeMonths.push(month);
    }
    return activeMonths;
}

function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    const tableHead = document.querySelector('#propositionsTable thead tr');
    tableBody.innerHTML = '';
    tableHead.innerHTML = '';

    const activeMonths = getActiveMonths(data);
    const activeMonthNames = activeMonths.map(month => frenchMonths[month - 1]);

    const userHeader = document.createElement('th');
    userHeader.textContent = 'Utilisateur';
    tableHead.appendChild(userHeader);

    activeMonthNames.forEach(month => {
        const monthHeader = document.createElement('th');
        monthHeader.textContent = month;
        tableHead.appendChild(monthHeader);
    });

    const totalHeader = document.createElement('th');
    totalHeader.textContent = 'Total';
    tableHead.appendChild(totalHeader);

    Object.keys(data).forEach(username => {
        const row = document.createElement('tr');
        const userData = data[username];

        const userCell = document.createElement('td');
        userCell.textContent = username;
        row.appendChild(userCell);

        let total = 0;
        activeMonths.forEach(month => {
            const cell = document.createElement('td');
            const count = userData[month - 1] || 0;
            cell.textContent = count;
            row.appendChild(cell);
            total += count;
        });

        const totalCell = document.createElement('td');
        totalCell.textContent = total;
        row.appendChild(totalCell);

        tableBody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    const totalLabelCell = document.createElement('td');
    totalLabelCell.textContent = 'Total par mois';
    totalLabelCell.style.fontWeight = 'bold';
    totalRow.appendChild(totalLabelCell);

    activeMonths.forEach(month => {
        let monthTotal = 0;
        Object.keys(data).forEach(username => {
            monthTotal += data[username][month - 1] || 0;
        });
        const monthTotalCell = document.createElement('td');
        monthTotalCell.textContent = monthTotal;
        totalRow.appendChild(monthTotalCell);
    });

    const grandTotal = activeMonths.reduce((total, month) => {
        return total + Object.keys(data).reduce((userTotal, username) => {
            return userTotal + (data[username][month - 1] || 0);
        }, 0);
    }, 0);

    const grandTotalCell = document.createElement('td');
    grandTotalCell.textContent = grandTotal;
    totalRow.appendChild(grandTotalCell);

    tableBody.appendChild(totalRow);
}

function renderChart(data) {
    const ctx = document.getElementById('stackedChart').getContext('2d');
    const activeMonths = getActiveMonths(data);
    const activeMonthNames = activeMonths.map(month => frenchMonths[month - 1]);
    const users = Object.keys(data);
    const datasets = [];

    activeMonths.forEach(month => {
        datasets.push({
            label: frenchMonths[month - 1],
            data: users.map(username => data[username][month - 1] || 0),
            backgroundColor: monthColors[month - 1],
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
        });
    });

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: users,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
            },
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                }
            }
        }
    });
}


window.onload = () => {
    updateChart();
};
