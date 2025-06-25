document.addEventListener('DOMContentLoaded', function () {
    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    const pieChartCanvas = document.getElementById('pieChart');
    let pieChart;

    async function fetchYears() {
        try {
            const response = await fetch('/charts/years');
            const years = await response.json();

            yearSelector.innerHTML = '';
            years.forEach(year => createYearCheckbox(year));
            fetchMonths();
            fetchPieChartData();
        } catch (error) {
            console.error('Erreur lors de la récupération des années:', error);
        }
    }

    function createYearCheckbox(year) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = year;
        checkbox.id = `year-${year}`;
        checkbox.addEventListener('change', function () {
            fetchMonths();
            fetchPieChartData();
        });
        checkbox.checked = true;

        const label = document.createElement('label');
        label.htmlFor = `year-${year}`;
        label.textContent = year;

        yearSelector.appendChild(checkbox);
        yearSelector.appendChild(label);
    }

    async function fetchMonths() {
        const selectedYears = Array.from(yearSelector.querySelectorAll('input:checked')).map(input => input.value);

        if (selectedYears.length === 0) {
            monthSelector.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/charts/months?years=${selectedYears.join(',')}`);
            const monthsData = await response.json();
            monthSelector.innerHTML = '';

            const monthsByYear = monthsData.reduce((acc, { month, year }) => {
                if (!acc[year]) acc[year] = [];
                acc[year].push(month);
                return acc;
            }, {});

            Object.keys(monthsByYear).forEach(year => {
                const yearSection = document.createElement('div');
                yearSection.classList.add('year-group');
                yearSection.innerHTML = `<h3>${year}</h3>`;

                monthsByYear[year].forEach(month => {
                    const monthLabel = new Date(0, month - 1).toLocaleString('fr', { month: 'long' });
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = `${month}-${year}`;
                    checkbox.id = `month-${month}-${year}`;
                    checkbox.checked = true;
                    checkbox.addEventListener('change', fetchPieChartData); // Call fetchPieChartData here

                    const label = document.createElement('label');
                    label.htmlFor = `month-${month}-${year}`;
                    label.textContent = `${monthLabel} ${year}`;

                    yearSection.appendChild(checkbox);
                    yearSection.appendChild(label);
                });

                monthSelector.appendChild(yearSection);
            });

            fetchPieChartData();
        } catch (error) {
            console.error('Erreur lors de la récupération des mois:', error);
        }
    }

    async function fetchPieChartData() {
        const years = getSelectedValues(yearSelector);
        const months = getSelectedValues(monthSelector);

        if (years.length === 0 || months.length === 0) return;

        try {
            const response = await fetch(`/charts/pie-chart-data?years=${years.join(',')}&months=${months.join(',')}`);
            const data = await response.json();
            updateTable(data);
            updatePieChart(data);
        } catch (error) {
            console.error('Erreur lors de la récupération des données du graphique:', error);
        }
    }

    function updateTable(data) {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';

        let totalRetenu = 0;
        let totalEnCours = 0;
        let grandTotal = 0;

        data.forEach(row => {
            const [month, year] = row.month.split('-');
            const monthName = new Date(0, month - 1).toLocaleString('fr', { month: 'long' });

            // Calculate totals
            totalRetenu += row.nb_propositions_retenu;
            totalEnCours += row.nb_propositions_en_cours;

            // Total for this row
            const total = row.nb_propositions_retenu + row.nb_propositions_en_cours;
            grandTotal += total;

            const tableRow = `<tr>
            <td>${monthName} ${year}</td>
            <td>${row.nb_propositions_retenu}</td>
            <td>${row.nb_propositions_en_cours}</td>
            <td>${total}</td>
        </tr>`;
            tableBody.innerHTML += tableRow;
        });

        // Add total row at the bottom
        const totalRow = `<tr>
        <td><strong>Total</strong></td>
        <td><strong>${totalRetenu}</strong></td>
        <td><strong>${totalEnCours}</strong></td>
        <td><strong>${grandTotal}</strong></td>
    </tr>`;
        tableBody.innerHTML += totalRow;
    }


    function updatePieChart(data) {
        const retenuCount = data.reduce((sum, row) => sum + row.nb_propositions_retenu, 0);
        const nonRetenuCount = data.reduce((sum, row) => sum + row.nb_propositions_en_cours, 0);

        const chartData = {
            labels: ['Propositions Soldée', 'Propositions en cours'],
            datasets: [{
                data: [retenuCount, nonRetenuCount],
                backgroundColor: ['#4caf50', '#f44336'],
            }]
        };

        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieChartCanvas, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: context => `${context.label}: ${context.raw} (${((context.raw / (retenuCount + nonRetenuCount)) * 100).toFixed(2)}%)`
                        }
                    }
                }
            }
        });
    }

    function getSelectedValues(container) {
        return Array.from(container.querySelectorAll('input:checked')).map(input => input.value);
    }

    fetchYears();
});
