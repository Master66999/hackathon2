/**
 * ClubPulse Auth Helper
 * Provides token management and authenticated fetch wrapper
 * Loaded by all dashboard pages BEFORE layout.js
 */

// Pages that don't need auth check
const PUBLIC_PAGES = ['landing.html', 'login.html', 'signup.html', 'matchmaker.html', 'register.html', 'attend.html'];

const AuthHelper = {
  // Store original fetch reference to bypass override and avoid recursion
  _originalFetch: window.fetch.bind(window),

  /** Get token from localStorage */
  getToken() {
    return localStorage.getItem('cp_token');
  },

  /** Get current user from localStorage */
  getUser() {
    try {
      const raw = localStorage.getItem('cp_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /** Save token and user after login/signup */
  setSession(token, user) {
    localStorage.setItem('cp_token', token);
    localStorage.setItem('cp_user', JSON.stringify(user));
  },

  /** Clear session */
  clearSession() {
    localStorage.removeItem('cp_token');
    localStorage.removeItem('cp_user');
  },

  /** Check if token is expired by peeking at JWT payload */
  isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },

  /** Redirect to login if not authenticated */
  guardPage() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1) || 'landing.html';
    if (PUBLIC_PAGES.includes(page)) return; // public page, skip

    const token = this.getToken();
    if (!token || this.isTokenExpired(token)) {
      this.clearSession();
      window.location.href = 'login.html';
      return;
    }
  },

  /** Authenticated fetch — wraps window.fetch with Authorization header */
  async fetch(url, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await this._originalFetch(url, { ...options, headers });

    // If 401/403 from server, session is invalid — force re-login
    if (response.status === 401 || response.status === 403) {
      this.clearSession();
      window.location.href = 'login.html';
      throw new Error('Session expired. Please log in again.');
    }
    return response;
  },

  /** Logout */
  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  }
};

// Run page guard immediately
AuthHelper.guardPage();

// Expose globally
window.AuthHelper = AuthHelper;

// Override global fetch for dashboard pages so all existing API calls get auth headers automatically
(function () {
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/') + 1) || 'landing.html';
  if (PUBLIC_PAGES.includes(page)) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (url, options = {}) {
    // Only intercept relative /api/ calls
    if (typeof url === 'string' && url.startsWith('/api/')) {
      return AuthHelper.fetch(url, options);
    }
    return originalFetch(url, options);
  };
})();
