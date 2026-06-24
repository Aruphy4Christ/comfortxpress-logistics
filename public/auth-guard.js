// auth-guard.js — include this as the FIRST script on every protected admin page.
//
// localStorage.cx_session is now just a UX flag for an instant redirect.
// The real check is the httpOnly session cookie issued by POST /api/auth/login.
(function () {
    // 1. LocalStorage check for instant redirect (UX)
    if (localStorage.getItem('cx_session') !== 'authenticated_token') {
        window.location.replace('login.html');
        return;
    }

    // 2. Server check (Security)
    // We include {credentials: 'include'} so the browser sends the HTTP-only cookie
    fetch('/api/auth/me', { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error('not authenticated');
        })
        .catch(() => {
            localStorage.removeItem('cx_session');
            window.location.replace('login.html');
        });
})();

function logout() {
    // Added {credentials: 'include'} so the server receives the cookie to invalidate it
    fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include' 
    }).finally(() => {
        localStorage.removeItem('cx_session');
        window.location.replace('login.html');
    });
}