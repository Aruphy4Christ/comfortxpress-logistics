// auth-guard.js — include this as the FIRST script on every protected admin page.
//
// localStorage.cx_session is now just a UX flag for an instant redirect (no flash of
// protected content while we wait on a network request). It carries no security weight —
// the real check is the httpOnly session cookie issued by POST /api/auth/login, verified
// here against GET /api/auth/me and on every protected API call on the server.
(function () {
    if (localStorage.getItem('cx_session') !== 'authenticated_token') {
        window.location.replace('login.html');
        return;
    }

    fetch('/api/auth/me')
        .then(res => {
            if (!res.ok) throw new Error('not authenticated');
        })
        .catch(() => {
            localStorage.removeItem('cx_session');
            window.location.replace('login.html');
        });
})();

function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        localStorage.removeItem('cx_session');
        window.location.replace('login.html');
    });
}