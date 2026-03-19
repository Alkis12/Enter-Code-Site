import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { Link, useNavigate } from "react-router-dom";

import { getCurrentUserType, isAuthenticated } from "../api/auth";
import {
  createNewsArticle,
  getManageNews,
  getPublicNews,
} from "../api/news";
import Header from "../components/Header/Header";

function createEmptyForm() {
  return {
    title: "",
    intro: "",
    preview: "",
    slug: "",
    bodyText: "",
    is_published: true,
  };
}

function splitBodyText(value) {
  return (value || "")
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function NewsPage() {
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canManageNews = userType === "teacher" || userType === "admin";

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createEmptyForm());

  const loadNews = useCallback(async () => {
    try {
      setLoading(true);
      const response = canManageNews && authed ? await getManageNews() : await getPublicNews();
      setArticles(response || []);
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить новости");
    } finally {
      setLoading(false);
    }
  }, [authed, canManageNews]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const closeModal = () => {
    setShowCreateModal(false);
    setForm(createEmptyForm());
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const article = await createNewsArticle({
        title: form.title,
        intro: form.intro,
        preview: form.preview,
        slug: form.slug || undefined,
        body: splitBodyText(form.bodyText),
        is_published: form.is_published,
      });
      closeModal();
      await loadNews();
      navigate(`/news/${article.slug}`);
    } catch (err) {
      setError(err.message || "Не удалось создать новость");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        <TopRow>
          <div>
            <SectionLabel>Новости</SectionLabel>
            <Title>Что нового в проекте</Title>
          </div>
          {canManageNews && (
            <CreateButton type="button" onClick={() => setShowCreateModal(true)}>
              Создать новость
            </CreateButton>
          )}
        </TopRow>

        {error && <StatusCard $error>{error}</StatusCard>}
        {loading ? (
          <StatusCard>Загрузка новостей...</StatusCard>
        ) : articles.length === 0 ? (
          <StatusCard>Новостей пока нет.</StatusCard>
        ) : (
          <NewsList>
            {articles.map((item) => (
              <NewsCard key={item.id} to={`/news/${item.slug}`}>
                <CardTop>
                  <Intro>{item.intro}</Intro>
                  {canManageNews && (
                    <StateBadge $published={item.is_published}>
                      {item.is_published ? "Опубликовано" : "Черновик"}
                    </StateBadge>
                  )}
                </CardTop>
                <h2>{item.title}</h2>
                <p>{item.preview}</p>
                <ReadMore>Открыть новость</ReadMore>
              </NewsCard>
            ))}
          </NewsList>
        )}

        {showCreateModal && (
          <Overlay onClick={closeModal}>
            <ModalCard onClick={(event) => event.stopPropagation()}>
              <ModalHeader>
                <div>
                  <ModalTitle>Новая новость</ModalTitle>
                  <ModalText>
                    Новость создается прямо отсюда, без отдельного административного хаба.
                  </ModalText>
                </div>
                <CloseButton type="button" onClick={closeModal}>
                  ×
                </CloseButton>
              </ModalHeader>

              <EditorForm onSubmit={handleCreate}>
                <Input
                  placeholder="Заголовок"
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
                <Input
                  placeholder="Короткий intro"
                  value={form.intro}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, intro: event.target.value }))
                  }
                />
                <Textarea
                  rows={3}
                  placeholder="Короткое превью для списка"
                  value={form.preview}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, preview: event.target.value }))
                  }
                />
                <Input
                  placeholder="Slug, необязательно"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, slug: event.target.value }))
                  }
                />
                <Textarea
                  rows={10}
                  placeholder="Текст новости. Разделяйте абзацы пустой строкой."
                  value={form.bodyText}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, bodyText: event.target.value }))
                  }
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
                  <span>Опубликовать сразу</span>
                </CheckboxRow>
                <ActionRow>
                  <SecondaryButton type="button" onClick={closeModal}>
                    Отмена
                  </SecondaryButton>
                  <CreateButton type="submit" disabled={saving}>
                    {saving ? "Сохраняю..." : "Сохранить"}
                  </CreateButton>
                </ActionRow>
              </EditorForm>
            </ModalCard>
          </Overlay>
        )}
      </Content>
    </Page>
  );
}

export default NewsPage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 1120px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const SectionLabel = styled.div`
  color: var(--muted);
  font-style: italic;
  margin-bottom: 12px;
`;

const Title = styled.h1`
  font-size: clamp(36px, 6vw, 58px);
`;

const NewsList = styled.div`
  display: grid;
  gap: 18px;
`;

const NewsCard = styled(Link)`
  text-decoration: none;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: inherit;

  h2 {
    font-size: 30px;
    color: var(--orange);
    line-height: 1.1;
  }

  p {
    line-height: 1.7;
    color: var(--muted);
  }
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const Intro = styled.div`
  color: #23598d;
  font-weight: 800;
`;

const StateBadge = styled.div`
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  background: ${(props) => (props.$published ? "#e7f7ef" : "#fff4e8")};
  color: ${(props) => (props.$published ? "#19785d" : "#c46a18")};
`;

const ReadMore = styled.div`
  font-weight: 800;
  color: var(--text);
`;

const StatusCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;

const CreateButton = styled.button`
  border: none;
  border-radius: 14px;
  padding: 14px 18px;
  background: var(--orange);
  color: #fff;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(18, 22, 31, 0.46);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
`;

const ModalCard = styled.section`
  width: min(860px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 28px;
  box-shadow: 0 28px 80px rgba(19, 24, 34, 0.2);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
`;

const ModalTitle = styled.h2`
  font-size: 30px;
`;

const ModalText = styled.p`
  color: var(--muted);
  line-height: 1.6;
  margin-top: 8px;
`;

const CloseButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #d7dee8;
  background: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
`;

const EditorForm = styled.form`
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

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const SecondaryButton = styled.button`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
  cursor: pointer;
`;
