import { api } from "./client";

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

export async function reviewTaskSubmission(taskId, studentId, payload) {
  return api(`/task/${taskId}/review/${studentId}`, {
    method: "POST",
    body: payload,
  });
}
