// Profile Page JavaScript
import './theme_init.js';
import { applyTheme, applyAccent, applyAmoled, applyLargeFont, getVisitHistory } from './theme_init.js';
import { setScheduleData, getProgressBySubject } from './schedule_data.js';
import { showToast } from './toast.js';
import { getMe, updateAvatar } from './api/auth.js';

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
        let data;
        try {
            data = await getMe();
        } catch (err) {
            if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    window.location.reload();
                    return;
                }
                localStorage.clear();
                window.location.href = '/login.html';
                return;
            }
            throw err;
        }
        const nameEl = document.getElementById('student-name');
        nameEl.textContent = data.name;
        nameEl.classList.remove('skeleton-line');
        nameEl.removeAttribute('style');
        nameEl.removeAttribute('aria-busy');
        document.getElementById('student-id').textContent = `ID: ${data.telegram_id}`;

        // Stats
        if (data.created_at && data.created_at !== 'N/A') {
            const date = new Date(data.created_at);
            document.getElementById('join-date').textContent = date.toLocaleDateString('ru-RU');
        } else {
            document.getElementById('join-date').textContent = 'Неизвестно';
        }

        document.getElementById('reviews-count').textContent = data.ratings_count || 0;

        if (data.avatar) {
            const avatarEl = document.getElementById('current-avatar');
            avatarEl.src = `/static/avatars/${data.avatar}`;
            avatarEl.loading = 'lazy';
        }
        loadScheduleStats();
    } catch (error) {
        console.error('Error loading student info:', error);
        showMessage('Ошибка загрузки данных профиля', 'error');
    }
}

function getWeekNumber(date) {
    const start = new Date('2026-01-12');
    start.setHours(0, 0, 0, 0);
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    if (current < start) return 1;
    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    return Math.min(20, Math.floor(diffDays / 7) + 1);
}

async function loadScheduleStats() {
    const monthEl = document.getElementById('stats-lessons-month');
    const dayEl = document.getElementById('stats-busiest-day');
    const weekEl = document.getElementById('stats-lessons-week');
    const typeEl = document.getElementById('stats-most-type');
    const subjectEl = document.getElementById('stats-top-subject');
    const streakEl = document.getElementById('stats-login-streak');
    const semesterPctEl = document.getElementById('stats-semester-pct');
    const lessonsProgressEl = document.getElementById('stats-lessons-progress');
    if (!monthEl || !dayEl) return;
    try {
        const res = await fetch('/api/schedule');
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.items || []);
        setScheduleData(list);

        const now = new Date();
        const semesterStart = new Date('2026-01-12');
        const semesterEnd = new Date(semesterStart);
        semesterEnd.setDate(semesterEnd.getDate() + 18 * 7);
        const totalDays = Math.max(1, (semesterEnd - semesterStart) / (24 * 60 * 60 * 1000));
        const todayNorm = new Date(now);
        todayNorm.setHours(0, 0, 0, 0);
        const passedDays = Math.max(0, (todayNorm - semesterStart) / (24 * 60 * 60 * 1000));
        const pct = Math.min(100, Math.round((passedDays / totalDays) * 100));
        if (semesterPctEl) semesterPctEl.textContent = pct + '%';

        const progress = getProgressBySubject();
        let totalPassed = 0;
        let totalPlanned = 0;
        list.forEach(lesson => {
            const [wS, wE] = Array.isArray(lesson.weeks) ? lesson.weeks : [1, 18];
            totalPlanned += (wE - wS + 1);
        });
        Object.values(progress).forEach(p => {
            totalPassed += (p.lecture || 0) + (p.seminar || 0);
        });
        if (lessonsProgressEl) lessonsProgressEl.textContent = totalPlanned > 0 ? `${totalPassed} из ${totalPlanned}` : '—';

        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentWeek = getWeekNumber(now);
        let lessonsThisMonth = 0;
        let lessonsThisWeek = 0;
        const dayCount = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 };
        const typeCount = { lecture: 0, seminar: 0 };
        const subjectCount = {};
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        list.forEach(lesson => {
            if (!dayNames.includes(lesson.day)) return;
            dayCount[lesson.day] = (dayCount[lesson.day] || 0) + 1;
            const [wStart, wEnd] = Array.isArray(lesson.weeks) ? lesson.weeks : [1, 20];
            for (let w = wStart; w <= wEnd; w++) {
                const mon = new Date(semesterStart);
                mon.setDate(mon.getDate() + (w - 1) * 7);
                const dayOff = dayNames.indexOf(lesson.day);
                const lessonDate = new Date(mon);
                lessonDate.setDate(mon.getDate() + dayOff);
                if (lessonDate.getMonth() === currentMonth && lessonDate.getFullYear() === currentYear) lessonsThisMonth++;
                if (w === currentWeek) lessonsThisWeek++;
            }
            if (currentWeek >= (wStart || 1) && currentWeek <= (wEnd || 20)) {
                const t = (lesson.type || 'seminar').toLowerCase();
                typeCount[t] = (typeCount[t] || 0) + 1;
                subjectCount[lesson.subject] = (subjectCount[lesson.subject] || 0) + 1;
            }
        });
        monthEl.textContent = lessonsThisMonth;
        if (weekEl) weekEl.textContent = lessonsThisWeek;
        const busiest = dayNames.reduce((a, b) => (dayCount[a] || 0) >= (dayCount[b] || 0) ? a : b);
        const dayLabels = { monday: 'пн', tuesday: 'вт', wednesday: 'ср', thursday: 'чт', friday: 'пт' };
        dayEl.textContent = dayLabels[busiest] || busiest;
        if (typeEl) {
            const l = typeCount.lecture || 0;
            const s = typeCount.seminar || 0;
            if (l + s === 0) typeEl.textContent = '—';
            else typeEl.textContent = l >= s ? (l > s ? 'лекции' : 'лекции/семинары') : 'семинары';
        }
        if (subjectEl) {
            const entries = Object.entries(subjectCount);
            if (entries.length === 0) subjectEl.textContent = '—';
            else {
                const top = entries.sort((a, b) => b[1] - a[1])[0];
                subjectEl.textContent = top[0].length > 20 ? top[0].slice(0, 18) + '…' : top[0];
            }
        }
        if (streakEl) {
            const n = parseInt(localStorage.getItem('login_streak') || '0', 10);
            streakEl.textContent = n ? n + ' дн.' : '0';
        }
    } catch (_) {
        if (semesterPctEl) semesterPctEl.textContent = '—';
        if (lessonsProgressEl) lessonsProgressEl.textContent = '—';
        monthEl.textContent = '—';
        dayEl.textContent = '—';
        if (weekEl) weekEl.textContent = '—';
        if (typeEl) typeEl.textContent = '—';
        if (subjectEl) subjectEl.textContent = '—';
        if (streakEl) streakEl.textContent = '—';
    }
}

function exportSchedulePdf() {
    const dayNames = { monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт' };
    const PAIR_TIMES = { 1: '08:00 - 09:20', 2: '09:30 - 10:50', 3: '11:00 - 12:20' };
    fetch('/api/schedule')
        .then(res => res.json())
        .then(data => {
            const list = Array.isArray(data) ? data : (data.items || []);
            const now = new Date();
            const currentWeek = getWeekNumber(now);
            const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            const lessonsByDay = {};
            daysOrder.forEach(d => { lessonsByDay[d] = []; });
            list.forEach(l => {
                if (!daysOrder.includes(l.day)) return;
                const [wStart, wEnd] = Array.isArray(l.weeks) ? l.weeks : [1, 20];
                if (currentWeek >= wStart && currentWeek <= wEnd) lessonsByDay[l.day].push(l);
            });
            daysOrder.forEach(d => lessonsByDay[d].sort((a, b) => a.pair - b.pair));
            let html = '<html><head><meta charset="utf-8"><title>Расписание</title></head><body style="font-family:sans-serif;padding:20px">';
            html += `<h2>Неделя ${currentWeek}</h2>`;
            daysOrder.forEach(day => {
                html += `<h3>${dayNames[day]}</h3><ul>`;
                lessonsByDay[day].forEach(l => {
                    html += `<li>${PAIR_TIMES[l.pair] || ''} ${l.subject} — ${l.room}</li>`;
                });
                html += '</ul>';
            });
            html += '</body></html>';
            const win = window.open('', '_blank');
            win.document.write(html);
            win.document.close();
            win.print();
            win.onafterprint = () => win.close();
        })
        .catch(() => showMessage('Ошибка загрузки расписания', 'error'));
}

document.getElementById('profile-pdf-btn')?.addEventListener('click', exportSchedulePdf);

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
    e.preventDefault();
    if (!confirm('Вы уверены, что хотите выйти из аккаунта?')) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('student_id');
    window.location.replace('/login.html');
});

// Show message: toast or in-element
function showMessage(text, type, elementId = 'message') {
    const messageEl = document.getElementById(elementId);
    if (!messageEl) {
        showToast(text, type || 'info');
        return;
    }
    messageEl.classList.remove('hidden');
    messageEl.style.display = 'block';
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    setTimeout(() => {
        messageEl.classList.add('hidden');
        messageEl.style.display = 'none';
    }, 5000);
}

// Load app version (from /api/flags)
async function loadAppVersion() {
    const el = document.getElementById('app-version');
    if (!el) return;
    try {
        const res = await fetch('/api/flags');
        const data = await res.json();
        if (data && data.version) el.textContent = data.version;
        else el.textContent = '1.0.0';
    } catch (_) {
        el.textContent = '—';
    }
}

// Initialize
loadStudentInfo();
loadAppVersion();

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

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
            // На iPhone пуш работает только когда приложение добавлено на экран домой (PWA), не во вкладке Safari
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;
            if (isIOS && !isStandalone) {
                throw new Error('На iPhone уведомления работают только если открыть приложение с главного экрана. В Safari: «Поделиться» → «На экран „Домой“», затем откройте приложение с иконки и включите уведомления здесь.');
            }

            // SUBSCRIBE LOGIC: на мобильных дольше (SW и разрешения могут тормозить)
            const isMobile = isIOS || /Android/i.test(navigator.userAgent) || window.innerWidth < 768;
            const SUBSCRIBE_TIMEOUT_MS = isMobile ? 45000 : 22000;
            const timeoutMsg = isMobile
                ? 'Долго ожидание. Убедитесь, что открыли приложение с главного экрана (не из Safari). Разрешите уведомления и попробуйте снова.'
                : 'Превышено время ожидания. Проверьте интернет и разрешения сайта.';

            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(timeoutMsg)), SUBSCRIBE_TIMEOUT_MS);
            });

            const doSubscribe = async () => {
                btn.textContent = 'Получение ключей...';
                console.log('[Push] Fetching config...');

                // 1. Fetch VAPID Key from Server
                const configResp = await fetch('/api/push/config');
                if (!configResp.ok) throw new Error('Ошибка получения конфигурации Push');
                const configData = await configResp.json();
                const vapidKey = configData.vapid_public_key;

                if (!vapidKey) {
                    if (configData.configured === false) {
                        throw new Error('Уведомления не настроены на сервере. Администратор должен добавить VAPID ключи в настройки приложения.');
                    }
                    throw new Error('Сервер не вернул VAPID ключ');
                }

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

                console.log('[Push] Sending to backend...');
                // Сериализуем подписку: toJSON() даёт endpoint + keys (p256dh, auth) в нужном формате
                const subscriptionPayload = subscription.toJSON ? subscription.toJSON() : {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.getKey ? arrayBufferToBase64(subscription.getKey('p256dh')) : null,
                        auth: subscription.getKey ? arrayBufferToBase64(subscription.getKey('auth')) : null
                    }
                };
                const token = localStorage.getItem('access_token');
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify(subscriptionPayload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    let msg = 'Ошибка сервера при подписке';
                    try {
                        const errJson = JSON.parse(errText);
                        if (errJson.detail) msg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
                    } catch (_) { }
                    throw new Error(msg);
                }

                const respData = await response.json();
                if (!respData.success) throw new Error(respData.error || 'Ошибка сервера');

                console.log('[Push] Success!');
                localStorage.setItem('push_subscribed', '1');
                showMessage('Уведомления успешно включены! 🎉', 'success', 'push-message');

                btn.classList.add('subscribed');
                btn.textContent = 'Выключить уведомления';
                btn.style.background = 'var(--accent)';
            }; // end doSubscribe

            try {
                await Promise.race([doSubscribe(), timeoutPromise]);
            } finally {
                clearTimeout(timeoutId);
            }
        }

    } catch (error) {
        console.error('Push error:', error);
        showMessage(`${error.message}`, 'error', 'push-message');
        if (btn && !btn.classList.contains('subscribed')) {
            btn.textContent = 'Включить уведомления';
        }
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

// Select Avatar (optimistic update: show new avatar immediately, revert on error)
document.querySelectorAll('.avatar-option').forEach(img => {
    img.addEventListener('click', async () => {
        const selectedAvatar = img.getAttribute('data-id');
        const previousSrc = currentAvatarImg.src;
        currentAvatarImg.src = `/static/avatars/${selectedAvatar}`;
        avatarModal.classList.add('hidden');
        try {
            const response = await updateAvatar(selectedAvatar);
            if (!response.ok) {
                currentAvatarImg.src = previousSrc;
                showMessage('Ошибка при сохранении', 'error');
            } else {
                showMessage('Аватарка обновлена! 📸', 'success');
            }
        } catch (e) {
            console.error(e);
            currentAvatarImg.src = previousSrc;
            showMessage('Ошибка соединения', 'error');
        }
    });
});


// --- Tab Handling ---
window.switchTab = function (tabName) {
    // 1. Hide all views
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // 2. Remove active class from buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // 3. Show selected view
    document.getElementById(`${tabName}-view`).classList.remove('hidden');

    // 4. Activate button (simple match)
    // Find button with onclick containing the tabName
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });
}

// --- Theme, акцент, AMOLED, крупный шрифт ---
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
    const saved = localStorage.getItem('theme') || 'dark';
    themeSelect.value = ['light', 'dark', 'system', 'time'].includes(saved) ? saved : 'dark';
    themeSelect.addEventListener('change', () => {
        const v = themeSelect.value;
        localStorage.setItem('theme', v);
        applyTheme(v);
    });
}
const reminderSelect = document.getElementById('reminder-minutes');
if (reminderSelect) {
    reminderSelect.value = localStorage.getItem('reminder_minutes') || '15';
    reminderSelect.addEventListener('change', () => {
        localStorage.setItem('reminder_minutes', reminderSelect.value);
    });
}
const accentSelect = document.getElementById('accent-select');
if (accentSelect) {
    accentSelect.value = localStorage.getItem('accent') || 'blue';
    accentSelect.addEventListener('change', () => {
        const v = accentSelect.value;
        localStorage.setItem('accent', v);
        applyAccent(v);
    });
}
const amoledToggle = document.getElementById('amoled-toggle');
if (amoledToggle) {
    amoledToggle.checked = localStorage.getItem('amoled') === '1';
    amoledToggle.addEventListener('change', () => {
        localStorage.setItem('amoled', amoledToggle.checked ? '1' : '0');
        applyAmoled(amoledToggle.checked);
    });
}
const largeFontToggle = document.getElementById('large-font-toggle');
if (largeFontToggle) {
    largeFontToggle.checked = localStorage.getItem('large_font') === '1';
    largeFontToggle.addEventListener('change', () => {
        localStorage.setItem('large_font', largeFontToggle.checked ? '1' : '0');
        applyLargeFont(largeFontToggle.checked);
    });
}

// --- Countdown Widget ---
let countdownInterval;
function initCountdown() {
    const el = document.getElementById('countdown-days');
    if (!el) return;

    // Target date: Summer session (example: June 1, 2026)
    const targetDate = new Date('2026-06-01T00:00:00');

    function updateCountdown() {
        const now = new Date();
        const diffTime = targetDate - now;

        if (diffTime > 0) {
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            el.textContent = diffDays;
        } else {
            el.textContent = '0';
        }
    }

    updateCountdown();
    // Update every minute just in case they leave it open for days
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 60000);
}
initCountdown();

// --- Календарь заходов (стрик) ---
function renderStreakCalendar() {
    const el = document.getElementById('streak-calendar');
    if (!el) return;
    const history = getVisitHistory();
    if (history.length === 0) {
        el.innerHTML = '<p class="text-muted" style="font-size:0.85rem;margin:8px 0 0;">Заходите каждый день — здесь появится календарь заходов</p>';
        return;
    }
    const set = new Set(history);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 89);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
    }
    // Сетка: колонки = недели (слева направо), строки = дни недели (7 строк). Так заходы идут вправо, без пустого места справа.
    const cols = 13;
    const rows = 7;
    const cells = [];
    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const idx = col * rows + row;
            const day = idx < days.length ? days[idx] : null;
            const filled = day ? set.has(day) : false;
            cells.push(`<span class="streak-cell ${filled ? 'filled' : ''}" title="${day || ''}" aria-label="${day || ''} ${filled ? 'был заход' : ''}"></span>`);
        }
    }
    el.innerHTML = '<p class="streak-calendar-title">Заходы за последние 90 дней</p><div class="streak-grid streak-grid-wide">' + cells.join('') + '</div>';
}
renderStreakCalendar();

// --- Достижения (с сервера /api/achievements/me) ---
async function loadAndRenderAchievements() {
    const el = document.getElementById('achievements-list');
    if (!el) return;
    const t = localStorage.getItem('access_token');
    if (!t) {
        el.innerHTML = '<p class="text-muted">Войдите, чтобы видеть достижения</p>';
        return;
    }
    try {
        const res = await fetch('/api/achievements/me', { headers: { Authorization: 'Bearer ' + t } });
        const data = await res.json();
        const list = data.achievements || [];
        el.innerHTML = list.length ? list.map(a => {
            const has = !!a.unlocked_at;
            return `<div class="achievement-item ${has ? 'unlocked' : ''}"><span class="achievement-icon">${has ? (a.icon || '🏆') : '🔒'}</span><div><strong>${a.name}</strong><br><span class="text-muted">${a.description || ''}</span></div></div>`;
        }).join('') : '<p class="text-muted">Пока нет достижений</p>';
    } catch (_) {
        el.innerHTML = '<p class="text-muted">Не удалось загрузить</p>';
    }
}
loadAndRenderAchievements();

// --- Google Calendar (один тап) ---
const googleBtn = document.getElementById('google-calendar-btn');
if (googleBtn) {
    const icsUrl = window.location.origin + '/api/calendar.ics';
    googleBtn.href = 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(icsUrl);
}

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
