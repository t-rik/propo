document.addEventListener('DOMContentLoaded', () => {
    // --- SETUP & DATA INITIALIZATION ---
    const sessionId = document.getElementById('session-id-data').value;
    const propositions = JSON.parse(document.getElementById('propositions-data').value);
    const initialUserVotes = JSON.parse(document.getElementById('user-votes-data').value);

    // If there are no propositions, show a message and stop.
    if (!propositions || propositions.length === 0) {
        document.querySelector('.proposition-container').innerHTML = '<h1>Aucune proposition à évaluer dans cette session.</h1><p>La page se rafraîchira si la session se termine.</p>';
        setupSessionEndPolling(sessionId);
        return;
    }

    let currentIndex = 0;
    const totalPropositions = propositions.length;
    const userVotes = new Map(initialUserVotes.map(vote => [vote.proposition_id, vote.vote_value]));

    // --- DOM ELEMENT REFERENCES ---
    const objetEl = document.getElementById('proposition-objet');
    const paginationEl = document.getElementById('pagination');
    const situationEl = document.getElementById('proposition-description-situation');
    const ameliorationEl = document.getElementById('proposition-description-amelioration');
    const statusEl = document.getElementById('proposition-status');
    const impactsListEl = document.getElementById('proposition-impacts-list');
    const beforeImagesEl = document.getElementById('before-images');
    const afterImagesEl = document.getElementById('after-images');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const ouiBtn = document.querySelector('.vote-oui');
    const nonBtn = document.querySelector('.vote-non');

    // --- CORE FUNCTIONS ---
    function renderProposition(index) {
        if (index < 0 || index >= totalPropositions) return;

        const proposition = propositions[index];
        objetEl.textContent = proposition.objet || 'Sans objet';
        paginationEl.textContent = `${index + 1} / ${totalPropositions}`;
        situationEl.textContent = proposition.description_situation_actuelle;
        ameliorationEl.textContent = proposition.description_amelioration_proposee;
        statusEl.className = `status ${proposition.statut}`;
        statusEl.textContent = proposition.statut.charAt(0).toUpperCase() + proposition.statut.slice(1);

        impactsListEl.innerHTML = '';
        if (proposition.impact_economique) impactsListEl.innerHTML += `<li class="impact-item">💡 Impact économique</li>`;
        if (proposition.impact_technique) impactsListEl.innerHTML += `<li class="impact-item">🔧 Impact technique</li>`;
        if (proposition.impact_formation) impactsListEl.innerHTML += `<li class="impact-item">📚 Impact de formation</li>`;
        if (proposition.impact_fonctionnement) impactsListEl.innerHTML += `<li class="impact-item">⚙️ Impact de fonctionnement</li>`;
        if (!impactsListEl.innerHTML) impactsListEl.innerHTML = `<li class="impact-item">Aucun impact spécifié</li>`;

        renderImages(proposition.id, 'before', proposition.before_images, beforeImagesEl);
        renderImages(proposition.id, 'after', proposition.after_images, afterImagesEl);
        
        updateButtonStates();
        updateVoteSelection();
    }

    function renderImages(id, type, images, container) {
        container.innerHTML = '';
        if (images && images.trim()) {
            const imageList = images.split(',');
            container.innerHTML = imageList.map(image => `
                <div class="image-wrapper" onclick="openModal('/images/${id}/${type}/${image}')">
                    <img src="/images/${id}/${type}/${image}" alt="Image ${type}" class="image-thumbnail">
                </div>
            `).join('');
        } else {
            container.innerHTML = `<p class="no-images-message">Aucune image disponible.</p>`;
        }
    }

    function updateButtonStates() {
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === totalPropositions - 1;
        // The vote buttons (ouiBtn, nonBtn) are enabled/disabled within updateVoteSelection
    }

    function updateVoteSelection() {
        const currentPropositionId = propositions[currentIndex].id;
        const vote = userVotes.get(currentPropositionId);

        ouiBtn.classList.remove('selected');
        nonBtn.classList.remove('selected');

        // Buttons are always enabled unless you want to disable them after *any* vote.
        // For "can change vote but not unvote", they should generally remain enabled.
        // ouiBtn.disabled = false;
        // nonBtn.disabled = false;


        if (vote === 6) { // Oui
            ouiBtn.classList.add('selected');
        } else if (vote === 0) { // Non (assuming 1 for Non, adjust if 0)
            nonBtn.classList.add('selected');
        }
    }

    async function submitVote(newVoteValue) {
        const propositionId = propositions[currentIndex].id;
        const currentVote = userVotes.get(propositionId);

        // **MODIFICATION START: Allow changing vote, but not unvoting**
        // If the user is trying to click the same button they already selected, do nothing.
        // This effectively prevents "unvoting" by clicking the selected button again.
        if (currentVote === newVoteValue) {
            console.log("Already selected this option. No change.");
            return;
        }
        // **MODIFICATION END**

        // Optimistically update the local state
        const previousVoteForRevert = currentVote; // Store the actual previous vote for revert
        userVotes.set(propositionId, newVoteValue);
        updateVoteSelection();

        try {
            const response = await fetch(`/voting-sessions/proposition/${propositionId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade: newVoteValue })
            });
            if (!response.ok) {
                let errorMessage = 'Failed to save vote';
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) { /* Ignore */ }
                throw new Error(errorMessage);
            }
            // Optional: Success feedback
            // Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Vote mis à jour!', showConfirmButton: false, timer: 1500 });

        } catch (error) {
            console.error("Error submitting vote:", error);
            // Revert optimistic update on failure
            if (previousVoteForRevert === undefined) { // If there was truly no vote before (first vote failed)
                userVotes.delete(propositionId);
            } else { // Revert to the actual previous vote
                userVotes.set(propositionId, previousVoteForRevert);
            }
            updateVoteSelection();
            Swal.fire('Erreur', `Impossible de sauvegarder le vote: ${error.message}. Veuillez réessayer.`, 'error');
        }
    }

    function setupSessionEndPolling(sid) {
        const sessionInterval = setInterval(async () => {
            try {
                const response = await fetch(`/voting-sessions/status/${sid}`);
                const data = await response.json();

                if (data.success && data.isOver) {
                    clearInterval(sessionInterval);
                    await Swal.fire({
                        title: 'Session Terminée!',
                        text: 'La session de vote est terminée. Vous allez être redirigé.',
                        icon: 'info',
                        timer: 3000,
                        timerProgressBar: true,
                        allowOutsideClick: false,
                        showConfirmButton: false,
                    });
                    window.location.href = `/voting-sessions/${sid}`;
                }
            } catch (error) {
                console.error('Failed to check session status, stopping poll.', error);
                clearInterval(sessionInterval);
            }
        }, 5000);
    }

    // --- EVENT LISTENERS ---
    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderProposition(currentIndex);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < totalPropositions - 1) {
            currentIndex++;
            renderProposition(currentIndex);
        }
    });

    // Vote values: Oui = 6, Non = 1 (or 0 if that's your convention for Non)
    ouiBtn.addEventListener('click', () => submitVote(6));
    nonBtn.addEventListener('click', () => submitVote(0)); // Ensure this value matches your 'Non'

    // --- INITIALIZATION ---
    renderProposition(currentIndex);
    setupSessionEndPolling(sessionId);
});

// Modal functions (remain unchanged)
function openModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const downloadLink = document.getElementById('downloadLink');
    if (modal) {
        modal.style.display = 'flex';
        modalImg.src = imageSrc;
        downloadLink.href = imageSrc;
    }
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
