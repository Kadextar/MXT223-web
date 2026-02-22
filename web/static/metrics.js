/**
 * Report Web Vitals (LCP, CLS, INP) to /api/metrics for monitoring.
 */
function reportMetrics(payload) {
    if (!payload || typeof fetch === 'undefined') return;
    try {
        fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(() => {});
    } catch (_) {}
}

function initWebVitals() {
    const sent = { lcp: false, cls: false };
    // LCP
    try {
        const po = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last && !sent.lcp) {
                sent.lcp = true;
                reportMetrics({ name: 'LCP', value: last.startTime, url: location.href });
            }
        });
        po.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}
    // CLS
    try {
        let clsValue = 0;
        const po = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
                if (!e.hadRecentInput) clsValue += e.value;
            }
        });
        po.observe({ type: 'layout-shift', buffered: true });
        window.addEventListener('pagehide', () => {
            if (!sent.cls) {
                sent.cls = true;
                reportMetrics({ name: 'CLS', value: clsValue, url: location.href });
            }
        });
    } catch (_) {}
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'complete') initWebVitals();
    else window.addEventListener('load', initWebVitals);
}
