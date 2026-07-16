export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export function getAuthToken() {
  return localStorage.getItem("titus-auth-token");
}

export function setAuthSession(authResponse) {
  localStorage.setItem("titus-auth-token", authResponse.access_token);
  localStorage.setItem("titus-auth-user", JSON.stringify(authResponse.user));
}

export function clearAuthSession() {
  localStorage.removeItem("titus-auth-token");
  localStorage.removeItem("titus-auth-user");
}

export function authenticatedAssetUrl(url) {
  const token = getAuthToken();
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

// Add the bearer token to all API calls made by existing screens.
export function installAuthenticatedFetch() {
  if (window.__titusAuthenticatedFetchInstalled) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const token = getAuthToken();
    const url = typeof input === "string" ? input : input.url;
    if (!token || !url.startsWith(API_BASE)) return originalFetch(input, init);
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
  };
  window.__titusAuthenticatedFetchInstalled = true;
}
