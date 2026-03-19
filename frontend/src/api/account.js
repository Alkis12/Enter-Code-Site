import { api } from "./client";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function getToken() {
  return localStorage.getItem("access_token");
}

export async function getDashboard() {
  return api("/users/dashboard");
}

export async function getProfile() {
  return api("/users/profile");
}

export async function updateProfile(payload) {
  return api("/users/profile", {
    method: "PUT",
    body: payload,
  });
}

export async function changePassword(payload) {
  return api("/users/change-password", {
    method: "POST",
    body: payload,
  });
}

export async function uploadProfileAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/users/profile/upload-avatar`, {
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

export async function listStudents() {
  return api("/users/students");
}

export async function createStudent(payload) {
  return api("/users/students", {
    method: "POST",
    body: payload,
  });
}

export async function updateStudent(studentId, payload) {
  return api(`/users/students/${studentId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function linkParentToStudent(studentId, payload) {
  return api(`/users/students/${studentId}/parents`, {
    method: "POST",
    body: payload,
  });
}

export async function unlinkParentFromStudent(studentId, parentId) {
  return api(`/users/students/${studentId}/parents/${parentId}`, {
    method: "DELETE",
  });
}
