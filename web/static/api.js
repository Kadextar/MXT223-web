/**
 * Shared API request wrapper: retry on 5xx/timeout, 429 handling, toasts.
 */
import { showToast } from './toast.js';

const DEFAULT_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {{ retries?: number, timeout?: number }} [opts]
 * @returns {Promise<Response>}
 */
export async function apiRequest(url, options = {}, opts = {}) {
    const retries = opts.retries ?? DEFAULT_RETRIES;
    const timeoutMs = opts.timeout ?? REQUEST_TIMEOUT_MS;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        let response;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const fetchOptions = { ...options, signal: controller.signal };
        try {
            response = await fetch(url, fetchOptions);
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                lastErr = new Error('Превышено время ожидания ответа сервера');
            } else {
                lastErr = err;
            }
            console.error('Network error:', lastErr);
            if (attempt < retries) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            showToast(lastErr.message || 'Ошибка подключения к серверу', 'error');
            throw lastErr;
        }
        clearTimeout(timeoutId);
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const msg = retryAfter
                ? `Слишком много попыток. Попробуйте через ${retryAfter} сек.`
                : 'Слишком много попыток. Подождите минуту.';
            showToast(msg, 'error');
            throw new Error(msg);
        }
        if (response.status >= 500) {
            if (attempt < retries) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            const body = await response.clone().json().catch(() => ({}));
            const requestId = body.request_id || response.headers.get('X-Request-ID') || '';
            const msg = requestId
                ? `Ошибка сервера. Код запроса: ${requestId}`
                : 'Ошибка сервера. Попробуйте позже.';
            showToast(msg, 'error');
        }
        return response;
    }
    throw lastErr;
}

/**
 * Same as apiRequest but parses JSON and returns { ok, data, error }.
 * Does not show toast for 4xx/5xx (caller can show).
 */
export async function apiRequestJson(url, options = {}) {
    const response = await apiRequest(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        return { ok: false, status: response.status, data };
    }
    return { ok: true, data };
}
