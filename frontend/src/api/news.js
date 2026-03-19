import { api } from "./client";

export async function getPublicNews() {
  return api("/news/public", { auth: false });
}

export async function getPublicNewsArticle(slug) {
  return api(`/news/public/${slug}`, { auth: false });
}

export async function getManageNews() {
  return api("/news/manage");
}

export async function getManageNewsArticle(slug) {
  return api(`/news/manage/${slug}`);
}

export async function createNewsArticle(payload) {
  return api("/news", {
    method: "POST",
    body: payload,
  });
}

export async function updateNewsArticle(articleId, payload) {
  return api(`/news/${articleId}`, {
    method: "PUT",
    body: payload,
  });
}
