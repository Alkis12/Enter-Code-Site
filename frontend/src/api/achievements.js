import { api } from "./client";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function getToken() {
  return localStorage.getItem("access_token");
}

export async function listEditableAchievements() {
  return api("/achievement/editable");
}

export async function listAchievementsOverview() {
  return api("/achievement/overview");
}

export async function updateAchievement(achievementId, payload) {
  return api(`/achievement/${achievementId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function uploadAchievementAvatar(achievementId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/achievement/${achievementId}/upload-avatar`, {
    method: "POST",
    headers,
    body: formData,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || res.statusText;
    throw new Error(msg);
  }
  return data;
}
