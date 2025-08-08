import { api } from "./client";

export async function getMyInfo() {
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  return await api("/users/profile", {
    method: "POST",
    body: { access_token, refresh_token },
    auth: true,
  });
}
