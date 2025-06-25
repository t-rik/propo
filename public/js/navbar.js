let dropdowns = document.querySelectorAll('.navbar-dropdown');
let activeDropdown = null;  // Store the currently active dropdown

if (dropdowns.length) {
    dropdowns.forEach((dropdown) => {
        let toggler = dropdown.querySelector('.dropdown-toggler'); // The <a> tag with the dropdown-toggler class

        if (toggler) {
            toggler.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent click event from bubbling up to the window

                // Check if the click was on the <a> or its children (e.g., <i> element)
                let target = document.querySelector(`#${event.target.closest('a').dataset.dropdown}`);

                // If a dropdown is already open and it's not the one clicked, close it
                if (activeDropdown && activeDropdown !== target) {
                    activeDropdown.classList.remove('show');
                }

                // Toggle the clicked dropdown visibility
                if (target) {
                    target.classList.toggle('show');
                    // If the dropdown is now open, set it as the active dropdown
                    activeDropdown = target.classList.contains('show') ? target : null;
                }
            });
        }
    });
}

// Close dropdowns when clicking outside
window.addEventListener('click', (event) => {
    if (activeDropdown && !event.target.closest('.navbar-dropdown')) {
        activeDropdown.classList.remove('show');
        activeDropdown = null;
    }
});

// Handle small screen toggler
function handleSmallScreens() {
    document.querySelector('.navbar-toggler').addEventListener('click', () => {
        let navbarMenu = document.querySelector('.navbar-menu');

        // Toggle the menu visibility for small screens
        navbarMenu.classList.toggle('active');
    });
}

handleSmallScreens();
