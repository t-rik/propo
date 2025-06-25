document.addEventListener('DOMContentLoaded', () => {

    // Ajouter une fonction
    document.getElementById('addFunctionBtn').addEventListener('click', () => {
        Swal.fire({
            title: 'Ajouter une fonction',
            html: `
        <input type="text" id="newFunctionName" class="swal2-input" placeholder="Nom de la fonction">
      `,
            confirmButtonText: 'Ajouter',
            focusConfirm: false,
            preConfirm: () => {
                const name = document.getElementById('newFunctionName').value;
                if (!name) {
                    Swal.showValidationMessage('Le nom est requis');
                } else {
                    // Appeler le backend pour ajouter la fonction
                    return fetch('/functions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    }).then(response => response.json());
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Succès', 'Fonction ajoutée avec succès', 'success').then(() => location.reload());
            }
        });
    });

    // Modifier une fonction
    document.querySelectorAll('.modifyFunctionBtn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            const name = button.getAttribute('data-name');

            Swal.fire({
                title: 'Modifier la fonction',
                html: `
          <input type="text" id="modifiedFunctionName" class="swal2-input" value="${name}">
        `,
                confirmButtonText: 'Modifier',
                focusConfirm: false,
                preConfirm: () => {
                    const newName = document.getElementById('modifiedFunctionName').value;
                    if (!newName) {
                        Swal.showValidationMessage('Le nom est requis');
                    } else {
                        // Appeler le backend pour modifier la fonction
                        return fetch(`/functions/edit/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newName })
                        }).then(response => response.json());
                    }
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire('Succès', 'Fonction modifiée avec succès', 'success').then(() => location.reload());
                }
            });
        });
    });

    document.querySelectorAll('.deleteFunctionBtn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');

            Swal.fire({
                title: 'Êtes-vous sûr ?',
                text: "Vous ne pourrez pas revenir en arrière !",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Oui, supprimer',
                cancelButtonText: 'Annuler'
            }).then((result) => {
                if (result.isConfirmed) {
                    fetch(`/functions/delete/${id}`, {
                        method: 'DELETE'
                    }).then(response => response.json())
                        .then(() => {
                            Swal.fire('Supprimée !', 'La fonction a été supprimée.', 'success').then(() => location.reload());
                        });
                }
            });
        });
    });
});
