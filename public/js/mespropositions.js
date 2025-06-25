document.addEventListener('DOMContentLoaded', () => {
    const columnDefs = [{
        headerName: "ID",
        field: "display_id",
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        sort: 'desc',
        minWidth: 100,
        maxWidth: 100
    },
    {
        headerName: "Objet",
        field: "objet",
        sortable: true,
        filter: true,
        resizable: true,
        flex: 2,
        minWidth: 200
    },
    {
        headerName: "Situation Actuelle",
        field: "description_situation_actuelle",
        sortable: true,
        filter: true,
        resizable: true,
        flex: 3,
        minWidth: 300
    },
    {
        headerName: "Amélioration Proposée",
        field: "description_amelioration_proposee",
        sortable: true,
        filter: true,
        resizable: true,
        flex: 3,
        minWidth: 300
    },
    {
        headerName: "Date",
        field: "date_emission",
        sortable: true,
        flex: 1.5,
        valueFormatter: params => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '',
        minWidth: 150
    },
    {
        sortable: false,
        filter: false,
        headerName: "Actions",
        cellRenderer: 'buttonRenderer',
        maxWidth: 120,
        minWidth: 100
    }
    ];

    const dataContainer = document.getElementById('dataContainer');
    const rowData = JSON.parse(dataContainer.getAttribute('data-row-data'));

    const buttonRenderer = (params) => {
        const button = document.createElement('button');
        button.innerText = 'Détails';
        button.className = 'button secondary';
        button.onclick = (event) => {
            event.stopPropagation();
            window.location.href = `/propositions/proposition/${params.data.id}`;
        };
        return button;
    };

    const gridOptions = {
        columnDefs: columnDefs,
        rowData: rowData,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 100
        },
        localeText: AG_GRID_LOCALE_FR,
        pagination: true,
        paginationPageSize: 50,
        domLayout: 'autoHeight',
        suppressRowClickSelection: true,
        components: {
            buttonRenderer: buttonRenderer
        },
        onRowClicked: params => {
            showRowDetails(params.data);
        },
        onGridReady: params => {
            params.api.refreshCells({
                force: true
            });
        }
    };

    const eGridDiv = document.querySelector('#myGrid');
    agGrid.createGrid(eGridDiv, gridOptions);

    const modal = document.getElementById('myModal');
    const closeButton = document.querySelector('.close');
    const rowDetails = document.getElementById('rowDetails');
    const viewDetailsButton = document.getElementById('viewDetailsButton');

    function showRowDetails(data) {
        rowDetails.innerHTML = `
          <p><strong>ID:</strong> ${data.display_id}</p>
          <p><strong>Objet:</strong> ${escapeHtml(data.objet)}</p>
          <p><strong>Situation Actuelle:</strong> ${escapeHtml(data.description_situation_actuelle)}</p>
          <p><strong>Amélioration Proposée:</strong> ${escapeHtml(data.description_amelioration_proposee)}</p>
          <p><strong>Date:</strong> ${new Date(data.date_emission).toLocaleDateString('fr-FR')}</p>
        `;
        modal.style.display = 'flex';

        viewDetailsButton.onclick = () => {
            window.location.href = `/propositions/proposition/${data.id}`;
        };
    }

    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = event => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});