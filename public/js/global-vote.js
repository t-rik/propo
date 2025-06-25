document.addEventListener('DOMContentLoaded', () => {
    const submitVoteBtn = document.getElementById('submit-vote-btn');
    let currentIndex = 0;
    const propositions = JSON.parse(document.getElementById('propositions-data').value);
    const totalPropositions = propositions.length;

    const votes = Array(totalPropositions).fill(null);

    function renderProposition(index) {
        disableUsed(index);
        checkNoVotes();
        const proposition = propositions[index];
        document.getElementById('pagination').innerText = `${index + 1}/${totalPropositions}`;
        document.getElementById('proposition-objet').innerText = proposition.objet;
        document.getElementById('proposition-description-situation').innerText = proposition.description_situation_actuelle;
        document.getElementById('proposition-description-amelioration').innerText = proposition.description_amelioration_proposee;
        document.getElementById('proposition-status').innerText = proposition.statut === 'soldee' ? 'Soldée' : proposition.statut === 'en cours' ? 'En Cours' : proposition.statut === 'anulee' ? 'Annulée' : 'Non Soldée';
        document.getElementById('proposition-status').classList = `status ${proposition.statut}`;
        const impactsList = document.getElementById('proposition-impacts');
        impactsList.innerHTML = '';
        if (proposition.impact_economique) impactsList.innerHTML += `<li class="impact-item">💡 Impact économique</li>`;
        if (proposition.impact_technique) impactsList.innerHTML += `<li class="impact-item">🔧 Impact technique</li>`;
        if (proposition.impact_formation) impactsList.innerHTML += `<li class="impact-item">📚 Impact de formation</li>`;
        if (proposition.impact_fonctionnement) impactsList.innerHTML += `<li class="impact-item">⚙️ Impact de fonctionnement</li>`;

        renderImages(proposition.id, 'before', proposition.before_images);
        renderImages(proposition.id, 'after', proposition.after_images);

        const voteValue = votes[index];
        if (voteValue !== null) {
            document.querySelector(`input[name="grade"][value="${voteValue}"]`).checked = true;
        } else {
            const selectedRadio = document.querySelector('input[name="grade"]:checked');
            if (selectedRadio) {
                selectedRadio.checked = false;
            }
        }
    }

    function renderImages(id, type, images) {
        const galleryContainer = document.getElementById(`${type}-images`);
        if (images && images.split(',').length > 0) {
            galleryContainer.innerHTML = images.split(',').map(image => `
                <div class="image-wrapper" onclick="openModal('/images/${id}/${type}/${image}')">
                    <img src="/images/${id}/${type}/${image}" alt="Image ${type}" class="image-thumbnail">
                </div>
            `).join('');
        } else {
            galleryContainer.innerHTML = `<p class="no-images-message">Aucune image disponible.</p>`;
        }
    }
    function disableUsed(index) {
        const radios = document.querySelectorAll('.grade');

        radios.forEach(radio => {
            radio.disabled = false;
        });

        const currentVote = votes[index];

        for (let i = 1; i <= 6; i++) {
            const isDisabled = votes.some((v, idx) => (v === i && idx !== index));
            if (isDisabled) {
                radios[i - 1].disabled = true;
            }
        }
    }

    function checkNoVotes() {
        disabled = !votes.some(value => value !== null);
        console.log(disabled);

        submitVoteBtn.disabled = disabled;
    }

    renderProposition(currentIndex);

    document.getElementById('next-btn').addEventListener('click', () => {
        const voteValue = document.querySelector('input[name="grade"]:checked')?.value;
        votes[currentIndex] = voteValue ? parseInt(voteValue) : null;

        if (currentIndex < totalPropositions - 1) {
            currentIndex++;
            renderProposition(currentIndex);
        }
    });

    document.getElementById('prev-btn').addEventListener('click', () => {
        const voteValue = document.querySelector('input[name="grade"]:checked')?.value;
        votes[currentIndex] = voteValue ? parseInt(voteValue) : null;

        if (currentIndex > 0) {
            currentIndex--;
            renderProposition(currentIndex);
        }
    });

    submitVoteBtn.addEventListener('click', async () => {
        const voteValue = document.querySelector('input[name="grade"]:checked')?.value;
        votes[currentIndex] = voteValue ? parseInt(voteValue) : null;
        console.log(votes);

        const filteredVotes = propositions
            .map((proposition, index) => ({
                propositionId: proposition.id,
                value: votes[index]
            }))
            .filter(vote => vote.vote_value !== null);

        if (filteredVotes.length === 0) {
            alert('Veuillez voter sur au moins une proposition avant de soumettre.');
            return;
        }

        try {
            const response = await fetch('/voting-sessions/global-vote/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ votes: filteredVotes })
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message);
            } else {
                alert(result.message || 'Erreur lors de la soumission du vote');
            }
        } catch (error) {
            console.error('Erreur lors de la soumission:', error);
        }
    });

    document.querySelectorAll('.grade').forEach(radio => {
        radio.addEventListener('click', function (e) {
            e.preventDefault();
            setTimeout(() => {
                if (this.checked === true) {
                    this.checked = false;
                } else {
                    this.checked = true;
                }
                const voteValue = document.querySelector('input[name="grade"]:checked')?.value;
                votes[currentIndex] = voteValue ? parseInt(voteValue) : null;
                checkNoVotes()

            }, 0)
        });
    });

});

function openModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const downloadLink = document.getElementById('downloadLink');

    modal.style.display = 'flex';
    modalImg.src = imageSrc;
    downloadLink.href = imageSrc;
}

window.onclick = function (event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        closeModal();
    }
};

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
}
