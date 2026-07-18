/* SlideGuard API client */

const API_BASE = '/api';

async function apiUpload(file, mode = 'standard') {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    const res = await fetch(`${API_BASE}/scan`, { method: 'POST', body: form });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
    }
    return await res.json();
}

async function apiFix(filePath) {
    const res = await fetch(`${API_BASE}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fix failed');
    }
    return await res.json();
}

async function apiReport(filePath, format) {
    const res = await fetch(`${API_BASE}/report/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Report generation failed');
    }
    return res;
}

async function apiRescan(filePath) {
    const res = await fetch(`${API_BASE}/rescan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Rescan failed');
    }
    return await res.json();
}

async function apiGetConfig() {
    const res = await fetch(`${API_BASE}/config`);
    return await res.json();
}
