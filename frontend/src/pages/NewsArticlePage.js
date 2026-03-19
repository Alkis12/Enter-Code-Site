import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { getCurrentUserType, isAuthenticated } from "../api/auth";
import {
  getManageNewsArticle,
  getPublicNewsArticle,
  updateNewsArticle,
} from "../api/news";
import Header from "../components/Header/Header";

function bodyToText(body) {
  return (body || []).join("\n\n");
}

function splitBodyText(value) {
  return (value || "")
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function NewsArticlePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canManageNews = userType === "teacher" || userType === "admin";

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let active = true;

    const loadArticle = async () => {
      try {
        setLoading(true);
        const response =
          canManageNews && authed
            ? await getManageNewsArticle(slug)
            : await getPublicNewsArticle(slug);
        if (!active) {
          return;
        }
        setArticle(response);
        setForm({
          title: response.title || "",
          intro: response.intro || "",
          preview: response.preview || "",
          slug: response.slug || "",
          bodyText: bodyToText(response.body),
          is_published: Boolean(response.is_published),
        });
        setError("");
      } catch (err) {
        if (active) {
          setError(err.message || "Не удалось загрузить новость");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadArticle();
    return () => {
      active = false;
    };
  }, [authed, canManageNews, slug]);

  if (!loading && error && !article) {
    return <Navigate to="/news" replace />;
  }

  const handleSave = async (event) => {
    event.preventDefault();
    if (!article) return;

    try {
      setSaving(true);
      const updated = await updateNewsArticle(article.id, {
        title: form.title,
        intro: form.intro,
        preview: form.preview,
        slug: form.slug || undefined,
        body: splitBodyText(form.bodyText),
        is_published: form.is_published,
      });
      setArticle(updated);
      setForm({
        title: updated.title,
        intro: updated.intro,
        preview: updated.preview,
        slug: updated.slug,
        bodyText: bodyToText(updated.body),
        is_published: updated.is_published,
      });
      setEditing(false);
      setError("");
      if (updated.slug !== slug) {
        navigate(`/news/${updated.slug}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || "Не удалось сохранить новость");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        <BackLink to="/news">Ко всем новостям</BackLink>
        {error && <StatusCard $error>{error}</StatusCard>}
        {loading ? (
          <StatusCard>Загрузка новости...</StatusCard>
        ) : article ? (
          <ArticleCard as={editing ? "form" : "article"} onSubmit={editing ? handleSave : undefined}>
            <TopRow>
              <div>
                <Intro>{article.intro}</Intro>
                {canManageNews && (
                  <StateBadge $published={article.is_published}>
                    {article.is_published ? "Опубликовано" : "Черновик"}
                  </StateBadge>
                )}
              </div>
              {canManageNews && (
                <ActionRow>
                  <ActionButton
                    type="button"
                    onClick={() => setEditing((prev) => !prev)}
                  >
                    {editing ? "Закрыть редактор" : "Редактировать"}
                  </ActionButton>
                  {editing && (
                    <SaveButton type="submit" disabled={saving}>
                      {saving ? "Сохраняю..." : "Сохранить"}
                    </SaveButton>
                  )}
                </ActionRow>
              )}
            </TopRow>

            {editing ? (
              <EditorStack>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Заголовок"
                />
                <Input
                  value={form.intro}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, intro: event.target.value }))
                  }
                  placeholder="Короткий intro"
                />
                <Textarea
                  rows={3}
                  value={form.preview}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, preview: event.target.value }))
                  }
                  placeholder="Превью для карточки"
                />
                <Input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, slug: event.target.value }))
                  }
                  placeholder="Slug"
                />
                <Textarea
                  rows={12}
                  value={form.bodyText}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, bodyText: event.target.value }))
                  }
                  placeholder="Текст новости. Разделяйте абзацы пустой строкой."
                />
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        is_published: event.target.checked,
                      }))
                    }
                  />
                  <span>Опубликовано</span>
                </CheckboxRow>
              </EditorStack>
            ) : (
              <>
                <Title>{article.title}</Title>
                {article.body.map((paragraph, index) => (
                  <Paragraph key={`${paragraph}-${index}`}>{paragraph}</Paragraph>
                ))}
              </>
            )}
          </ArticleCard>
        ) : null}
      </Content>
    </Page>
  );
}

export default NewsArticlePage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 920px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const BackLink = styled(Link)`
  text-decoration: none;
  color: var(--muted);
  font-style: italic;
`;

const StatusCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;

const ArticleCard = styled.article`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const Intro = styled.div`
  color: #23598d;
  font-weight: 800;
`;

const StateBadge = styled.div`
  margin-top: 10px;
  display: inline-flex;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  background: ${(props) => (props.$published ? "#e7f7ef" : "#fff4e8")};
  color: ${(props) => (props.$published ? "#19785d" : "#c46a18")};
`;

const Title = styled.h1`
  font-size: clamp(34px, 5vw, 56px);
  line-height: 1.04;
`;

const Paragraph = styled.p`
  color: var(--text);
  line-height: 1.8;
  font-size: 17px;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
  cursor: pointer;
`;

const SaveButton = styled.button`
  border: none;
  border-radius: 12px;
  background: var(--orange);
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;

const EditorStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
`;

const Textarea = styled.textarea`
  width: 100%;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
  resize: vertical;
`;

const CheckboxRow = styled.label`
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-weight: 700;
`;
