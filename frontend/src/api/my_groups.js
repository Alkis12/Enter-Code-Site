import { api } from "./client";

export async function getMyGroups() {
  const user_id = JSON.parse(localStorage.getItem("info")).user_id;
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  return await api("/group/my", {
    method: "POST",
    body: { user_id, access_token },
    auth: true,
  });
}
