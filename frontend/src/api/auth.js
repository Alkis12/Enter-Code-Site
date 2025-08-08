import { api } from "./client";

export async function login({ tg_username, password }) {
  const response = await api("/auth/login", {
    method: "POST",
    body: { tg_username, password },
    auth: false,
  });
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("refresh_token", response.refresh_token);
  return response;
}

export async function register({ tg_username, password }) {
  return api("/auth/register", {
    method: "POST",
    body: { tg_username, password },
    auth: false,
  });
}
export async function logout() {
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  return api("/auth/logout", {
    method: "POST",
    body: { access_token, refresh_token },
    auth: false,
  });
}
