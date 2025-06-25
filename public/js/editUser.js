Dropzone.options.profileImageDropzone = {
    paramName: "profileImage",
    acceptedFiles: "image/*",
    thumbnailWidth: 100,
    thumbnailHeight: 100,
    autoProcessQueue: false,
    addRemoveLinks: true,
    dictCancelUpload: 'Annuler',
    clickable: "#add",
    maxFiles: 1,
    dictDefaultMessage: '',
    dictRemoveFile: '<i class="fas fa-trash-alt"></i>',
    init: function () {
        let myDropzone = this;
        const formAction = document.querySelector('#profileImageDropzone').action;
        const userId = formAction.split('/').pop();
        const existingImageUrl = `/images/profile-image/${userId}?p=1`;

        fetch(existingImageUrl)
            .then(response => {
                if (response.ok) {
                    return response.blob();
                }
                if (response.status === 404) {
                    return null;
                }
                throw new Error('Erreur lors de la récupération de l\'image.');
            })
            .then(blob => {
                if (blob) {
                    const mockFile = { name: `profileimg-${userId}`, size: blob.size, compressed: true };
                    const imgUrl = URL.createObjectURL(blob);
                    myDropzone.emit("addedfile", mockFile);
                    myDropzone.emit("thumbnail", mockFile, imgUrl);
                    myDropzone.emit("complete", mockFile);
                    myDropzone.files.push(mockFile);
                }
            })
            .catch(error => {
                console.error(`Erreur lors de la récupération de l'image de profil : ${error.message}`);
            });

        this.on("removedfile", function (file) {
            if (file.name && file.compressed) {
                Swal.fire({
                    title: 'Êtes-vous sûr?',
                    text: "Vous ne pourrez pas revenir en arrière!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Oui, supprimer!',
                    cancelButtonText: 'Non, annuler!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        fetch(`/images/profile-image/delete/${userId}`, {
                            method: 'DELETE'
                        })
                            .then(response => response.json())
                            .then(result => {
                                if (result.success) {
                                    Swal.fire(
                                        'Supprimé!',
                                        'Votre image a été supprimée.',
                                        'success'
                                    );
                                } else {
                                    console.error(`Erreur lors de la suppression de l'image de profil: ${result.message}`);
                                    Swal.fire(
                                        'Erreur!',
                                        'Une erreur est survenue lors de la suppression de l\'image.',
                                        'error'
                                    );
                                }
                            })
                            .catch(error => {
                                console.error(`Erreur lors de la suppression de l'image de profil: ${error}`);
                                Swal.fire(
                                    'Erreur!',
                                    'Une erreur est survenue lors de la suppression de l\'image.',
                                    'error'
                                );
                            });
                    } else {
                        fetch(existingImageUrl)
                            .then(response => {
                                if (response.ok) {
                                    return response.blob();
                                }
                                if (response.status === 404) {
                                    return null;
                                }
                                throw new Error('Erreur lors de la récupération de l\'image.');
                            })
                            .then(blob => {
                                if (blob) {
                                    const mockFile = { name: `profileimg-${userId}`, size: blob.size, compressed: true };
                                    const imgUrl = URL.createObjectURL(blob);
                                    myDropzone.emit("addedfile", mockFile);
                                    myDropzone.emit("thumbnail", mockFile, imgUrl);
                                    myDropzone.emit("complete", mockFile);
                                    myDropzone.files.push(mockFile);
                                }
                            })
                            .catch(error => {
                                console.error(`Erreur lors de la récupération de l'image de profil : ${error.message}`);
                            });
                        Swal.fire(
                            'Annulé',
                            'Votre image est en sécurité :)',
                            'info'
                        );
                    }
                });
            }
        });

        this.on("addedfile", function (file) {
            if (file.compressed) {
                return;
            }
            if (file.size < 200) {
                file.compressed = true;
                return;
            }
            myDropzone.removeFile(file);
            const compressionRatio = 0.9;
            new Compressor(file, {
                quality: compressionRatio,
                maxWidth: 800,
                maxHeight: 600,
                mimeType: 'image/jpeg',
                success: function (result) {
                    result.compressed = true;
                    myDropzone.addFile(result);
                    myDropzone.uploadFile(result);
                },
                error: function (err) {
                    console.error('Error compressing image:', err);
                }
            });
        });

        function processFile(file) {
            if (!file.processed) {
                file.processed = true;
                myDropzone.processFile(file);
            }
        }
    }
};

const forms = document.querySelectorAll('.dropzone');
let observing = true;

function updateImages() {
    if (!observing) return;
    observing = false;
    forms.forEach(form => {
        const childCount = form.children.length - 1;
        const image = form.querySelector('.add-wrapper');
        if (childCount == 1) {
            form.appendChild(image);
            image.style.display = 'flex';
            form.style.border = '2px dashed rgb(204, 204, 204)';
        } else {
            image.style.display = 'none';
            form.style.border = 'none';
        }
    });
    setTimeout(() => {
        observing = true;
    }, 0)
}

forms.forEach(form => {
    const observer = new MutationObserver(updateImages);
    observer.observe(form, {
        childList: true
    });
});