import { api } from "./client";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_ID_KEY = "user_id";
const USER_TYPE_KEY = "user_type";

export function saveSession(session) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  localStorage.setItem(USER_ID_KEY, session.user_id);
  localStorage.setItem(USER_TYPE_KEY, session.user_type);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_TYPE_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getCurrentUserType() {
  return localStorage.getItem(USER_TYPE_KEY) || "";
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export async function login({ tg_username, password }) {
  const response = await api("/auth/login", {
    method: "POST",
    body: { tg_username, password },
    auth: false,
  });
  saveSession(response);
  return response;
}

export async function register(payload) {
  const response = await api("/auth/register", {
    method: "POST",
    body: payload,
    auth: false,
  });
  saveSession(response);
  return response;
}

export async function logout() {
  const access_token = getAccessToken();
  const refresh_token = getRefreshToken();
  if (access_token && refresh_token) {
    try {
      await api("/auth/logout", {
        method: "POST",
        body: { access_token, refresh_token },
        auth: false,
      });
    } catch {
      // The server may already consider the session invalid. Clearing locally is enough.
    } finally {
      clearSession();
    }
    return;
  }
  clearSession();
}
