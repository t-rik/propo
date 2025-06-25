let chart = null;

function renderChart() {
    if (chart) {
        chart.destroy();
    }

    const ctx = document.getElementById('cumulChart').getContext('2d');
    const startMonth = document.getElementById('start-month').value;
    const endMonth = document.getElementById('end-month').value;

    if (startMonth > endMonth) {
        alert('Start month cannot be later than end month');
        return;
    }

    fetch(`/charts/cumul-data?startMonth=${startMonth}&endMonth=${endMonth}`)
        .then(response => response.json())
        .then(data => {
            const formattedData = formatChartData(data);

            chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: formattedData.labels,
                    datasets: [
                        {
                            label: 'Cumul des Idées Émises',
                            data: formattedData.data,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderWidth: 1,
                            fill: true,
                            type: 'bar',
                        },
                        {
                            label: 'Prévision Cumulative',
                            data: formattedData.prediction,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            fill: false,
                            type: 'line',
                            tension: 0.1,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'category',
                            labels: formattedData.labels,
                            title: {
                                display: true,
                                text: 'Mois',
                                font: {
                                    size: 14
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Cumul des Propositions',
                                font: {
                                    size: 14
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: {
                                    size: 14
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (tooltipItem) {
                                    return tooltipItem.raw.toFixed(0) + " propositions";
                                }
                            }
                        }
                    }
                }
            });
        })
        .catch(error => console.error('Error fetching data:', error));
}

function exponentialSmoothing(data, alpha = 0.2) {
    let smoothedData = [data[0]];

    for (let i = 1; i < data.length; i++) {
        smoothedData.push(alpha * data[i] + (1 - alpha) * smoothedData[i - 1]);
    }

    return smoothedData;
}

function formatChartData(data) {
    const labels = [];
    const chartData = [];
    const predictionData = [];

    let cumulative = 0;
    data.forEach(item => {
        const monthYear = new Date(item.year, item.month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
        labels.push(monthYear);
        cumulative += item.cumul_idee_emises;
        chartData.push(cumulative);
    });

    const smoothedData = exponentialSmoothing(chartData);

    const futureStartMonth = data[data.length - 1]?.month || new Date().getMonth() + 1;
    const futureStartYear = data[data.length - 1]?.year || new Date().getFullYear();
    let predictedCumulative = smoothedData[smoothedData.length - 1];

    for (let i = 0; i < 10; i++) {
        predictedCumulative += smoothedData[smoothedData.length - 1] * 0.05;
        const nextMonth = new Date(futureStartYear, futureStartMonth + i, 1);
        const monthYear = nextMonth.toLocaleString('default', { month: 'short', year: 'numeric' });
        labels.push(monthYear);
        predictionData.push(predictedCumulative);
    }

    return {
        labels: labels,
        data: smoothedData,
        prediction: predictionData
    };
}

document.getElementById('filter-form').addEventListener('submit', function (event) {
    event.preventDefault();
    renderChart();
});
