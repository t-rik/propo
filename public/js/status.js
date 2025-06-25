function checkActiveSession() {
    fetch('/voting-sessions/check-active-session')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.sessionType === "jury") {
                    document.querySelector('.container').innerHTML = `
              <p class="info">Une session de vote du jury est active. Prêt à évaluer?</p>
              <button class="btn" onclick="window.location.href='/voting-sessions/jury-vote'">Commencer</button>
              <button class="btn" onclick="history.back()">Retour</button>`;
                } else if (data.sessionType === "global") {
                    document.querySelector('.container').innerHTML = `
              <p class="info">Une session de vote globale a été trouvée.</p>
              <button class="btn" onclick="window.location.href='/voting-sessions/global-vote'">Démarrer</button>
              <button class="btn" onclick="history.back()">Retour</button>`;
                }
            } else {
                document.querySelector('.container').innerHTML = `
            <p class="info">Aucune session de vote active n'a été trouvée pour le moment.</p>
            <button class="btn" onclick="history.back()">Retour</button>`;
            }
        })
        .catch(error => {
            console.error('Error fetching session status:', error);
            document.querySelector('.container').innerHTML = `<p class="info error">Erreur de communication avec le serveur.</p>`;
        });
}

// Check immediately on load, then set an interval
checkActiveSession();
setInterval(checkActiveSession, 5000);