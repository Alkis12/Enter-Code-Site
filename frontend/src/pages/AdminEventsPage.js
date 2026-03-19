import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import ImageUploadControl from "../components/ImageUploadControl";
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
  uploadEventImage,
} from "../api/events";

const emptyForm = {
  title: "",
  description: "",
  schedule_type: "weekly",
  date: "",
  weekday: "0",
  start_time: "",
  end_time: "",
  image_url: "",
  button_color: "#6fa2d0",
  card_color: "#ffffff",
  text_color: "#1f2a44",
  is_active: true,
};

const weekdayLabels = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [tags, setTags] = useState([]);
  const [tagLabel, setTagLabel] = useState("");
  const [tagColor, setTagColor] = useState("#6fa2d0");
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(
    localStorage.getItem("is_admin") === "true"
  );
  const [adminKey, setAdminKey] = useState(
    localStorage.getItem("admin_key") || ""
  );

  const canSubmit = useMemo(
    () => form.title.trim() && form.start_time,
    [form.title, form.start_time]
  );

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await listEvents();
      setEvents(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить мероприятия");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadEvents();
    }
  }, [isAdmin]);

  const handleAdminLogin = () => {
    localStorage.setItem("is_admin", "true");
    localStorage.setItem("admin_key", adminKey);
    setIsAdmin(true);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("is_admin");
    localStorage.removeItem("admin_key");
    setIsAdmin(false);
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddTag = () => {
    if (!tagLabel.trim()) return;
    setTags((prev) => [
      ...prev,
      { label: tagLabel.trim(), color: tagColor },
    ]);
    setTagLabel("");
  };

  const handleRemoveTag = (index) => {
    setTags((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const data = await uploadEventImage(file);
      setForm((prev) => ({ ...prev, image_url: data.url }));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setTags([]);
    setEditId(null);
  };

  const handleEdit = (event) => {
    setEditId(event.id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      schedule_type: event.schedule_type || "weekly",
      date: event.date || "",
      weekday:
        event.weekday === null || event.weekday === undefined
          ? "0"
          : `${event.weekday}`,
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      image_url: event.image_url || "",
      button_color: event.button_color || "#6fa2d0",
      card_color: event.card_color || "#ffffff",
      text_color: event.text_color || "#1f2a44",
      is_active: event.is_active !== false,
    });
    setTags(event.tags || []);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      schedule_type: form.schedule_type,
      date: form.schedule_type === "once" ? form.date || null : null,
      weekday:
        form.schedule_type === "weekly" ? Number(form.weekday || 0) : null,
      start_time: form.start_time,
      end_time: form.end_time || null,
      image_url: form.image_url || null,
      button_color: form.button_color || null,
      card_color: form.card_color || null,
      text_color: form.text_color || null,
      tags,
      is_active: form.is_active,
    };

    try {
      if (editId) {
        await updateEvent(editId, payload);
      } else {
        await createEvent(payload);
      }
      resetForm();
      loadEvents();
    } catch (err) {
      setError(err.message || "Не удалось сохранить мероприятие");
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await deleteEvent(eventId);
      loadEvents();
    } catch (err) {
      setError(err.message || "Не удалось удалить мероприятие");
    }
  };

  if (!isAdmin) {
    return (
      <Page>
        <Panel>
          <h1>Админ-доступ</h1>
          <p>
            Заглушка: введите ключ администратора (если он задан на бэкенде).
          </p>
          <Field>
            <label htmlFor="admin_key">Admin key</label>
            <input
              id="admin_key"
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="dev-admin"
            />
          </Field>
          <PrimaryButton type="button" onClick={handleAdminLogin}>
            Войти как админ
          </PrimaryButton>
        </Panel>
      </Page>
    );
  }

  return (
    <Page>
      <Panel>
        <PanelHeader>
          <div>
            <h1>Мероприятия</h1>
            <p>Создание, редактирование и управление расписанием.</p>
          </div>
          <SecondaryButton type="button" onClick={handleAdminLogout}>
            Выйти
          </SecondaryButton>
        </PanelHeader>

        {error && <Status>{error}</Status>}
        {loading && <Status>Загрузка...</Status>}

        <Form onSubmit={handleSubmit}>
          <FormGrid>
            <Field>
              <label htmlFor="title">Название</label>
              <input
                id="title"
                name="title"
                value={form.title}
                onChange={handleFormChange}
                required
              />
            </Field>
            <Field>
              <label htmlFor="schedule_type">Тип</label>
              <select
                id="schedule_type"
                name="schedule_type"
                value={form.schedule_type}
                onChange={handleFormChange}
              >
                <option value="weekly">Еженедельное</option>
                <option value="once">Разовое</option>
              </select>
            </Field>
            {form.schedule_type === "once" ? (
              <Field>
                <label htmlFor="date">Дата</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleFormChange}
                  required
                />
              </Field>
            ) : (
              <Field>
                <label htmlFor="weekday">День недели</label>
                <select
                  id="weekday"
                  name="weekday"
                  value={form.weekday}
                  onChange={handleFormChange}
                >
                  {weekdayLabels.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field>
              <label htmlFor="start_time">Начало</label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                value={form.start_time}
                onChange={handleFormChange}
                required
              />
            </Field>
            <Field>
              <label htmlFor="end_time">Окончание</label>
              <input
                id="end_time"
                name="end_time"
                type="time"
                value={form.end_time}
                onChange={handleFormChange}
              />
            </Field>
            <Field $wide>
              <label htmlFor="description">Описание</label>
              <textarea
                id="description"
                name="description"
                rows="3"
                value={form.description}
                onChange={handleFormChange}
              />
            </Field>
            <Field>
              <label htmlFor="button_color">Цвет кнопки</label>
              <input
                id="button_color"
                name="button_color"
                type="color"
                value={form.button_color}
                onChange={handleFormChange}
              />
            </Field>
            <Field>
              <label htmlFor="card_color">Цвет карточки</label>
              <input
                id="card_color"
                name="card_color"
                type="color"
                value={form.card_color}
                onChange={handleFormChange}
              />
            </Field>
            <Field>
              <label htmlFor="text_color">Цвет текста</label>
              <input
                id="text_color"
                name="text_color"
                type="color"
                value={form.text_color}
                onChange={handleFormChange}
              />
            </Field>
            <Field>
              <label htmlFor="image">Картинка</label>
              <ImageUploadControl
                inputId="event-image-upload"
                accept="image/*"
                hasValue={Boolean(form.image_url)}
                uploading={uploading}
                onChange={handleImageUpload}
                onRemove={() =>
                  setForm((prev) => ({
                    ...prev,
                    image_url: "",
                  }))
                }
              />
            </Field>
            <Field>
              <label htmlFor="is_active">Активно</label>
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={handleFormChange}
              />
            </Field>
          </FormGrid>

          <TagsSection>
            <TagInputs>
              <input
                type="text"
                placeholder="Тег"
                value={tagLabel}
                onChange={(event) => setTagLabel(event.target.value)}
              />
              <input
                type="color"
                value={tagColor}
                onChange={(event) => setTagColor(event.target.value)}
              />
              <SecondaryButton type="button" onClick={handleAddTag}>
                Добавить тег
              </SecondaryButton>
            </TagInputs>
            <TagList>
              {tags.map((tag, index) => (
                <TagItem key={`${tag.label}-${index}`}>
                  <TagSwatch style={{ background: tag.color }} />
                  {tag.label}
                  <TagRemove
                    type="button"
                    onClick={() => handleRemoveTag(index)}
                  >
                    x
                  </TagRemove>
                </TagItem>
              ))}
            </TagList>
          </TagsSection>

          <FormActions>
            <PrimaryButton type="submit" disabled={!canSubmit}>
              {editId ? "Обновить" : "Создать"}
            </PrimaryButton>
            {editId && (
              <SecondaryButton type="button" onClick={resetForm}>
                Отменить
              </SecondaryButton>
            )}
          </FormActions>
        </Form>

        <EventsList>
          {events.map((event) => (
            <EventRow key={event.id}>
              <EventInfo>
                <strong>{event.title}</strong>
                <span>
                  {event.schedule_type === "weekly"
                    ? `Еженедельно: ${weekdayLabels[event.weekday || 0]}`
                    : `Дата: ${event.date}`}
                </span>
                <span>
                  {event.start_time}
                  {event.end_time ? `-${event.end_time}` : ""}
                </span>
              </EventInfo>
              <EventActions>
                <SecondaryButton type="button" onClick={() => handleEdit(event)}>
                  Редактировать
                </SecondaryButton>
                <DangerButton
                  type="button"
                  onClick={() => handleDelete(event.id)}
                >
                  Удалить
                </DangerButton>
              </EventActions>
            </EventRow>
          ))}
        </EventsList>
      </Panel>
    </Page>
  );
}

export default AdminEventsPage;

const Page = styled.div`
  min-height: 100vh;
  background: #f3f5fb;
  padding: 40px 20px 80px;
  color: #1f2434;
  font-family: "Manrope", "Segoe UI", sans-serif;
`;

const Panel = styled.div`
  max-width: 1040px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 24px 50px rgba(20, 28, 80, 0.12);
  display: flex;
  flex-direction: column;
  gap: 28px;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h1 {
    margin: 0;
  }

  p {
    margin-top: 8px;
    color: #586178;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    color: #586178;
  }

  input,
  select,
  textarea {
    border-radius: 12px;
    border: 1px solid #d6dbea;
    padding: 10px 12px;
    font-size: 14px;
  }

  textarea {
    resize: vertical;
  }

  ${(props) =>
    props.$wide &&
    `
    grid-column: 1 / -1;
  `}
`;

const TagsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TagInputs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  input[type="text"] {
    flex: 1 1 200px;
  }
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const TagItem = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0f3ff;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
`;

const TagSwatch = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
`;

const TagRemove = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  color: #586178;
`;

const FormActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EventRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  background: #f6f7fb;
  border-radius: 16px;
  padding: 16px 20px;
`;

const EventInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
`;

const EventActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Status = styled.div`
  padding: 12px 16px;
  border-radius: 12px;
  background: #fff6e5;
  color: #8c5a00;
`;

const PrimaryButton = styled.button`
  border: none;
  background: #1f2a44;
  color: #ffffff;
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
`;

const SecondaryButton = styled.button`
  border: 1px solid #d6dbea;
  background: #ffffff;
  color: #1f2434;
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
`;

const DangerButton = styled.button`
  border: none;
  background: #ff5c5c;
  color: #ffffff;
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
`;
