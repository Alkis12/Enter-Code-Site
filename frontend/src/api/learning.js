import { api } from "./client";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function getToken() {
  return localStorage.getItem("access_token");
}

export async function getMyCourses() {
  return api("/course/my");
}

export async function getCourseDetail(courseId) {
  return api(`/course/${courseId}`);
}

export async function getPublicCourseDetail(courseId) {
  return api(`/course/public/${courseId}`, { auth: false });
}

export async function createCourse(payload) {
  return api("/course/add", {
    method: "POST",
    body: payload,
  });
}

export async function uploadCourseCover(file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/course/upload-cover`, {
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

export async function updateCourse(courseId, payload) {
  return api(`/course/${courseId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function createCourseGroup(courseId, payload) {
  return api(`/course/${courseId}/groups`, {
    method: "POST",
    body: payload,
  });
}

export async function updateCourseGroup(courseId, groupId, payload) {
  return api(`/course/${courseId}/groups/${groupId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteCourseGroup(courseId, groupId) {
  return api(`/course/${courseId}/groups/${groupId}`, {
    method: "DELETE",
  });
}

export async function submitCourseRequest(courseId, payload) {
  return api(`/course/${courseId}/request`, {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export async function setCourseMembers(courseId, payload) {
  return api(`/course/${courseId}/members`, {
    method: "PUT",
    body: payload,
  });
}

export async function getLessonDetail(lessonId) {
  return api(`/topic/${lessonId}`);
}

export async function createLesson(payload) {
  return api("/topic/add", {
    method: "POST",
    body: payload,
  });
}

export async function updateLesson(lessonId, payload) {
  return api(`/topic/${lessonId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteLesson(lessonId) {
  return api(`/topic/${lessonId}`, {
    method: "DELETE",
  });
}

export async function createTask(payload) {
  return api("/task/add", {
    method: "POST",
    body: payload,
  });
}

export async function updateTask(taskId, payload) {
  return api(`/task/${taskId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteTask(taskId) {
  return api(`/task/${taskId}`, {
    method: "DELETE",
  });
}

export async function submitTask(taskId, payload) {
  return api(`/task/${taskId}/submit`, {
    method: "POST",
    body: payload,
  });
}

export async function runTaskCode(taskId, payload) {
  return api(`/task/${taskId}/run`, {
    method: "POST",
    body: payload,
  });
}

export async function reviewTaskSubmission(taskId, studentId, payload) {
  return api(`/task/${taskId}/review/${studentId}`, {
    method: "POST",
    body: payload,
  });
}
