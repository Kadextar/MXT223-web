// PWA Install Prompt
let deferredPrompt;
const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';
const INSTALL_DISMISSED_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

// Check if user dismissed install prompt recently
function shouldShowInstallPrompt() {
    const dismissedTime = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!dismissedTime) return true;

    const timeSinceDismiss = Date.now() - parseInt(dismissedTime);
    return timeSinceDismiss > INSTALL_DISMISSED_TIME;
}

// Show install banner
function showInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner && shouldShowInstallPrompt()) {
        banner.classList.remove('hidden');
    }
}

// Hide install banner
function hideInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

// Check if running as installed PWA
function isRunningAsPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

// Detect iOS
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Show iOS install instructions
function showIOSInstructions() {
    const iosInstructions = document.getElementById('ios-install-instructions');
    if (iosInstructions && shouldShowInstallPrompt() && !isRunningAsPWA()) {
        iosInstructions.classList.remove('hidden');
    }
}

// Listen for beforeinstallprompt event (Android, Desktop)
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser prompt
    e.preventDefault();

    // Store the event for later use
    deferredPrompt = e;

    // Show our custom banner
    showInstallBanner();

    console.log('✅ PWA install prompt ready');
});

// Handle install button click
document.addEventListener('DOMContentLoaded', () => {
    // Don't show install prompt if already installed
    if (isRunningAsPWA()) {
        console.log('✅ Running as installed PWA');
        hideInstallBanner();
        return;
    }

    // Show iOS instructions if on iOS
    if (isIOS()) {
        console.log('📱 iOS detected - showing instructions');
        showIOSInstructions();
    }

    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('install-dismiss');
    const iosCloseBtn = document.getElementById('ios-close-btn');

    // Android/Desktop install button
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) {
                console.log('❌ No install prompt available');
                return;
            }

            // Show native install prompt
            deferredPrompt.prompt();

            // Wait for user choice
            const { outcome } = await deferredPrompt.userChoice;

            console.log(`User response: ${outcome}`);

            if (outcome === 'accepted') {
                console.log('✅ User accepted install');
            } else {
                console.log('❌ User dismissed install');
            }

            // Clear the deferred prompt
            deferredPrompt = null;

            // Hide our banner
            hideInstallBanner();
        });
    }

    // Dismiss button
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            // Save dismiss time
            localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());

            console.log('User dismissed install prompt');

            // Hide banner
            hideInstallBanner();
        });
    }

    // iOS close button
    if (iosCloseBtn) {
        iosCloseBtn.addEventListener('click', () => {
            localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
            const iosInstructions = document.getElementById('ios-install-instructions');
            if (iosInstructions) {
                iosInstructions.classList.add('hidden');
            }
        });
    }
});

// Detect when app is installed
window.addEventListener('appinstalled', () => {
    console.log('🎉 PWA installed successfully!');
    hideInstallBanner();

    // Clear deferred prompt
    deferredPrompt = null;
});

// Log PWA status on load
console.log('PWA Status:', {
    isInstalled: isRunningAsPWA(),
    isIOS: isIOS(),
    canInstall: !!deferredPrompt
});
