// Hamburger Menu JavaScript

const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const sideMenu = document.getElementById('side-menu');
const menuClose = document.getElementById('menu-close');

// Open menu
menuBtn.addEventListener('click', () => {
    menuBtn.classList.add('active');
    menuOverlay.classList.add('active');
    sideMenu.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
});

// Close menu
function closeMenu() {
    menuBtn.classList.remove('active');
    menuOverlay.classList.remove('active');
    sideMenu.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
}

menuClose.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', closeMenu);

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu.classList.contains('active')) {
        closeMenu();
    }
});
