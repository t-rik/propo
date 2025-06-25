const textElements = document.querySelectorAll('input[type="text"], textarea');

textElements.forEach((element) => {
    const counter = element.nextElementSibling;
    const maxLength = element.getAttribute('maxlength');

    const currentLength = element.value.length;
    counter.textContent = `${currentLength} / ${maxLength}`;

    if (currentLength >= maxLength) {
        counter.classList.add('warning');
    } else {
        counter.classList.remove('warning');
    }
    element.addEventListener('input', function () {
        const currentLength = element.value.length;
        counter.textContent = `${currentLength} / ${maxLength}`;

        if (currentLength >= maxLength) {
            counter.classList.add('warning');
        } else {
            counter.classList.remove('warning');
        }
    });
});

const form = document.getElementById('upload-form');
const errorMessageContainer = document.getElementById('error-message');
form.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') event.preventDefault();
});
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
        const response = await fetch('/propositions/add', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log(result);

        if (response.ok) {
            Swal.fire({
                title: 'Proposition ajoutée!',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Ajouter des images',
                cancelButtonText: 'Pas maintenant',
                allowOutsideClick: false,
                preConfirm: () => {
                    window.location.href = '/propositions/proposition/' + result.propositionId + '#before-gallery';
                }
            }).then((result) => {
                if (result.dismiss === Swal.DismissReason.cancel) {
                    window.location.href = '/propositions/mes-propositions';
                }
            });
        } else {
            Swal.fire({
                title: 'Erreur!',
                icon: 'error',
                confirmButtonText: 'Ok',
                allowOutsideClick: false
            });
        }
    } catch (error) {
        Swal.fire({
            title: 'Erreur inconnue!',
            text: 'Une erreur inattendue s\'est produite. Veuillez réessayer plus tard ou contacter le support.',
            icon: 'error',
            timer: 1000,
            showConfirmButton: false,
            allowOutsideClick: false
        }).then(function () {
            window.location.href = '/';
        });
    }
});