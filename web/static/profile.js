// Profile Page JavaScript

// Check authentication
const token = localStorage.getItem('access_token');
if (!token) {
    window.location.href = '/login.html';
}

// Token refresh function
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        return false;
    }

    try {
        const response = await fetch('/api/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Token refresh error:', error);
        return false;
    }
}

// Load student info
async function loadStudentInfo() {
    if (!token) return; // Double check

    try {
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Check for authentication errors
        if (response.status === 401 || response.status === 403) {
            // Try to refresh token
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry with new token
                window.location.reload();
                return;
            }

            // Refresh failed, redirect to login
            localStorage.clear();
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load student info');
        }

        const data = await response.json();
        document.getElementById('student-name').textContent = data.name;
        document.getElementById('student-id').textContent = `ID: ${data.telegram_id}`;
    } catch (error) {
        console.error('Error loading student info:', error);
        showMessage('Ошибка загрузки данных профиля', 'error');
    }
}

// Password change form handler
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validation
    if (newPassword.length < 6) {
        showMessage('Новый пароль должен содержать минимум 6 символов', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage('Пароли не совпадают', 'error');
        return;
    }

    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.detail || 'Ошибка при смене пароля', 'error');
            return;
        }

        showMessage('✅ Пароль успешно изменен!', 'success');

        // Clear form
        document.getElementById('password-form').reset();
    } catch (error) {
        console.error('Error changing password:', error);
        showMessage('Ошибка при смене пароля', 'error');
    }
});

// Logout handler
document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login.html';
    }
});

// Show message helper
function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;

    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

// Initialize
loadStudentInfo();
