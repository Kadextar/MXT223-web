// Profile Page JavaScript
import './theme_init.js';

// Check authentication
// Check authentication
const token = localStorage.getItem('access_token');
// Removed hard redirect to allow Guest Mode UI
// Strict Auth: Redirect to login if no token
if (!token) {
    window.location.replace('/login.html');
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
    if (!token) return;

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

        // Stats
        if (data.created_at && data.created_at !== 'N/A') {
            const date = new Date(data.created_at);
            document.getElementById('join-date').textContent = date.toLocaleDateString('ru-RU');
        } else {
            document.getElementById('join-date').textContent = 'Неизвестно';
        }

        document.getElementById('reviews-count').textContent = data.ratings_count || 0;

        // Avatar
        if (data.avatar) {
            document.getElementById('current-avatar').src = `/static/avatars/${data.avatar}`;
        }
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
document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault(); // Prevent any default behavior

    // Direct logout without confirm dialog (since it was causing issues for user)
    // Clear ALL auth data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('student_id'); // KEY FIX: Clear legacy auth ID

    // Use replace to prevent going back
    window.location.replace('/login.html');
});

// Show message helper
function showMessage(text, type, elementId = 'message') {
    const messageEl = document.getElementById(elementId);
    if (!messageEl) {
        console.warn(`Message element #${elementId} not found, using alert:`, text);
        alert(text);
        return;
    }

    // Ensure it's visible if it was hidden via display:none logic or class
    messageEl.classList.remove('hidden');
    messageEl.style.display = 'block';

    messageEl.textContent = text;
    messageEl.className = `message ${type}`;

    setTimeout(() => {
        messageEl.classList.add('hidden');
        messageEl.style.display = 'none';
    }, 5000);
}

// Initialize
loadStudentInfo();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.error('SW Registration failed:', err));
    });
}

// --- Push Notifications ---
// Removed hardcoded VAPID_PUBLIC_KEY to prevent mismatch

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function toggleNotifications() {
    const btn = document.getElementById('enable-notifications-btn');
    const msg = document.getElementById('push-message');

    // Check if already subscribed
    const isSubscribed = btn.classList.contains('subscribed');

    try {
        btn.disabled = true;

        if (isSubscribed) {
            // UNSUBSCRIBE LOGIC
            btn.textContent = 'Отписка...';

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Unsubscribe from browser
                await subscription.unsubscribe();

                // Optional: Tell backend to remove (not strictly required if we handle 410 errors, but good practice)
                // await fetch('/api/unsubscribe', ...); 
            }

            btn.classList.remove('subscribed');
            btn.textContent = 'Включить уведомления';
            btn.style.background = 'var(--secondary)'; // Reset color
            showMessage('Уведомления выключены 🔕', 'success', 'push-message');

        } else {
            // SUBSCRIBE LOGIC
            btn.textContent = 'Получение ключей...';
            console.log('[Push] Fetching config...');

            // 1. Fetch VAPID Key from Server
            const configResp = await fetch('/api/push/config');
            if (!configResp.ok) throw new Error('Ошибка получения конфигурации Push');
            const configData = await configResp.json();
            const vapidKey = configData.vapid_public_key;

            if (!vapidKey) throw new Error('Сервер не вернул VAPID ключ');

            btn.textContent = 'Запрос разрешения...';
            console.log('[Push] Requesting permission...');

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Разрешение отклонено');
            }

            btn.textContent = 'Подписка...';
            console.log('[Push] Registering SW...');

            // Force Registration to ensure 'ready' resolves
            await navigator.serviceWorker.register('/sw.js');

            console.log('[Push] Waiting for SW ready...');
            const registration = await navigator.serviceWorker.ready;

            console.log('[Push] Checking existing subscription...');
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                console.log('[Push] Creating new subscription...');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey)
                });
            }

            const reminderMinutes = parseInt(document.getElementById('reminder-minutes')?.value || '15', 10);
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ subscription, reminder_minutes: reminderMinutes })
            });

            if (!response.ok) throw new Error('Ошибка сервера при подписке');

            const respData = await response.json();
            if (!respData.success) throw new Error(respData.error || 'Ошибка сервера');

            console.log('[Push] Success!');
            showMessage('Уведомления успешно включены! 🎉', 'success', 'push-message');

            btn.classList.add('subscribed');
            btn.textContent = 'Выключить уведомления';
            btn.style.background = 'var(--accent)';
        }

    } catch (error) {
        console.error('Push error:', error);
        showMessage(`${error.message}`, 'error', 'push-message');
    } finally {
        btn.disabled = false;
    }
}

async function checkNotificationStatus() {
    const btn = document.getElementById('enable-notifications-btn');
    if (!btn) return;

    if (!('Notification' in window)) {
        btn.style.display = 'none';
        return;
    }

    if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            btn.textContent = 'Выключить уведомления';
            btn.style.background = 'var(--accent)';
            btn.classList.add('subscribed');
        }
    }
}

// Init Push Logic
document.getElementById('enable-notifications-btn')?.addEventListener('click', toggleNotifications);
checkNotificationStatus();

// --- Avatar Logic ---
const avatarModal = document.getElementById('avatar-modal');
const currentAvatarImg = document.getElementById('current-avatar');

// Open Modal
document.getElementById('edit-avatar-btn').addEventListener('click', () => {
    avatarModal.classList.remove('hidden');
});

// Close Modal
document.getElementById('close-avatar-modal').addEventListener('click', () => {
    avatarModal.classList.add('hidden');
});
avatarModal.querySelector('.modal-overlay').addEventListener('click', () => {
    avatarModal.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && avatarModal && !avatarModal.classList.contains('hidden')) {
        avatarModal.classList.add('hidden');
    }
});

// Select Avatar
document.querySelectorAll('.avatar-option').forEach(img => {
    img.addEventListener('click', async () => {
        const selectedAvatar = img.getAttribute('data-id');

        try {
            const response = await fetch('/api/me/avatar', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ avatar: selectedAvatar })
            });

            if (response.ok) {
                // Update UI immediately
                currentAvatarImg.src = `/static/avatars/${selectedAvatar}`;
                avatarModal.classList.add('hidden');
                showMessage('Аватарка обновлена! 📸', 'success');
            } else {
                showMessage('Ошибка при сохранении', 'error');
            }
        } catch (e) {
            console.error(e);
            showMessage('Ошибка соединения', 'error');
        }
    });
});


// --- Tab Handling ---
const APP_VERSION = '1.2';
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

async function updateSettingsMeta() {
    const cacheEl = document.getElementById('cache-date');
    const versionEl = document.getElementById('app-version');
    if (cacheEl) {
        const t = localStorage.getItem('cached_schedule_time');
        cacheEl.textContent = t ? 'Обновлено: ' + new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Обновлено: —';
    }
    if (versionEl) versionEl.textContent = 'Версия ' + APP_VERSION;
    const annList = document.getElementById('announcements-list');
    if (annList) {
        try {
            const r = await fetch('/api/announcements');
            const list = r.ok ? await r.json() : [];
            annList.innerHTML = list.length ? list.slice(0, 10).map(a => {
                const date = a.created_at ? new Date(a.created_at).toLocaleDateString('ru-RU') : '';
                return `<div class="announcement-item" style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;"><span class="text-muted" style="font-size: 0.8rem;">${date}</span><p style="margin: 4px 0 0;">${escapeHtml(a.message)}</p></div>`;
            }).join('') : '<p class="text-muted">Нет объявлений</p>';
        } catch (_) {
            annList.innerHTML = '<p class="text-muted">Нет объявлений</p>';
        }
    }
    const deadlinesList = document.getElementById('deadlines-list');
    if (deadlinesList) {
        try {
            const r = await fetch('/api/deadlines');
            const list = r.ok ? await r.json() : [];
            deadlinesList.innerHTML = list.length ? list.map(d => {
                const date = d.deadline_date ? new Date(d.deadline_date).toLocaleDateString('ru-RU') : '';
                return `<div class="deadline-item" style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;"><span>${escapeHtml(d.title)}</span><span class="text-muted">${date}</span></div>`;
            }).join('') : '<p class="text-muted">Нет важных дат</p>';
        } catch (_) {
            deadlinesList.innerHTML = '<p class="text-muted">Нет важных дат</p>';
        }
    }
    const reminderSelect = document.getElementById('reminder-minutes');
    if (reminderSelect) {
        try {
            const token = localStorage.getItem('access_token');
            const r = await fetch('/api/subscribe-settings', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
            const d = r.ok ? await r.json() : {};
            const rem = d.reminder_minutes || 15;
            reminderSelect.value = String([5, 15, 30].includes(rem) ? rem : 15);
        } catch (_) {}
    }
    const subgroupSelect = document.getElementById('subgroup-select');
    if (subgroupSelect) {
        try {
            const token = localStorage.getItem('access_token');
            const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } });
            const me = r.ok ? await r.json() : {};
            const sg = me.subgroup === 2 ? 2 : 1;
            subgroupSelect.value = String(sg);
        } catch (_) {}
        if (!subgroupSelect._bound) {
            subgroupSelect._bound = true;
            subgroupSelect.addEventListener('change', async () => {
                const token = localStorage.getItem('access_token');
                if (!token) return;
                const val = parseInt(subgroupSelect.value, 10);
                const res = await fetch('/api/me', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                    body: JSON.stringify({ subgroup: val })
                });
                if (res.ok) showMessage('Подгруппа ' + val + ' сохранена', 'success', 'push-message');
            });
        }
    }
    if (reminderSelect && !reminderSelect._bound) {
        reminderSelect._bound = true;
        reminderSelect.addEventListener('change', async () => {
                const token = localStorage.getItem('access_token');
                if (!token) return;
                const val = parseInt(reminderSelect.value, 10);
                const res = await fetch('/api/subscribe-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ reminder_minutes: val })
                });
                if (res.ok) showMessage('Напоминание: за ' + val + ' мин', 'success', 'push-message');
            });
        }
    }
}

window.switchTab = function (tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabName}-view`).classList.remove('hidden');
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick')?.includes(tabName)) btn.classList.add('active');
    });
    if (tabName === 'settings') updateSettingsMeta();
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#settings') switchTab('settings');
    try {
        fetch('/api/analytics/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') },
            body: JSON.stringify({ page: 'profile' })
        });
    } catch (_) {}
});

// --- Theme & Font Handling ---
const themeToggle = document.getElementById('theme-toggle');
const fontLargeToggle = document.getElementById('font-large-toggle');
const themeAutoToggle = document.getElementById('theme-auto-toggle');

function syncThemeToggles() {
    const themeAuto = localStorage.getItem('theme_auto') === 'true';
    if (themeToggle) themeToggle.checked = document.body.classList.contains('light-mode');
    if (themeAutoToggle) themeAutoToggle.checked = themeAuto;
    if (fontLargeToggle) fontLargeToggle.checked = localStorage.getItem('font_large') === 'true';
}
if (themeToggle) {
    const savedTheme = localStorage.getItem('theme');
    themeToggle.checked = savedTheme === 'light';
    themeToggle.addEventListener('change', (e) => {
        localStorage.setItem('theme_auto', 'false');
        if (themeAutoToggle) themeAutoToggle.checked = false;
        if (e.target.checked) {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        }
    });
}
if (fontLargeToggle) {
    fontLargeToggle.checked = localStorage.getItem('font_large') === 'true';
    fontLargeToggle.addEventListener('change', (e) => {
        localStorage.setItem('font_large', e.target.checked ? 'true' : 'false');
        document.body.classList.toggle('font-large', e.target.checked);
    });
}
if (themeAutoToggle) {
    themeAutoToggle.checked = localStorage.getItem('theme_auto') === 'true';
    themeAutoToggle.addEventListener('change', (e) => {
        localStorage.setItem('theme_auto', e.target.checked ? 'true' : 'false');
        if (e.target.checked) {
            const hour = new Date().getHours();
            if (hour >= 6 && hour < 21) document.body.classList.add('light-mode');
            else document.body.classList.remove('light-mode');
        } else {
            const t = localStorage.getItem('theme');
            document.body.classList.toggle('light-mode', t === 'light');
        }
    });
}
syncThemeToggles();

// Global function for password toggle
window.togglePassword = function (inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        icon.style.color = 'var(--primary)';
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        icon.style.color = ''; // reset to default
    }
}

// --- Calendar Export ---
import { generateICS } from './calendar_export.js';
document.getElementById('export-calendar-btn')?.addEventListener('click', () => {
    try {
        generateICS();
        showMessage('Расписание скачано! 📅', 'success');
    } catch (e) {
        console.error(e);
        showMessage('Ошибка при экспорте', 'error');
    }
});
