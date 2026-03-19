import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Navigate, useNavigate } from "react-router-dom";

import { getCurrentUserType, isAuthenticated } from "../api/auth";
import {
  createCourse,
  getMyCourses,
  uploadCourseCover,
} from "../api/learning";
import Header from "../components/Header/Header";
import ImageUploadControl from "../components/ImageUploadControl";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

const initialCourseForm = {
  name: "",
  description: "",
  public_info: "",
  accent_color: "#16a085",
  cover_image: "",
};

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function MyCoursesPage() {
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canOpenCourses = ["student", "teacher", "admin"].includes(userType);
  const canCreateCourse = userType === "teacher" || userType === "admin";

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [form, setForm] = useState(initialCourseForm);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await getMyCourses();
      setCourses(data.courses || []);
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить курсы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!canOpenCourses) {
    return <Navigate to="/profile" replace />;
  }

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm(initialCourseForm);
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();
    try {
      setCreating(true);
      await createCourse(form);
      closeCreateModal();
      await loadCourses();
    } catch (err) {
      setError(err.message || "Не удалось создать курс");
    } finally {
      setCreating(false);
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      setUploadingCover(true);
      const response = await uploadCourseCover(file);
      setForm((prev) => ({
        ...prev,
        cover_image: response.url || "",
      }));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить обложку курса");
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        <Intro>
          <div>
            <Eyebrow>Мои курсы</Eyebrow>
            <Title>Мои курсы</Title>
            <Description>
              Здесь собраны все ваши курсы, прогресс по ним и быстрый переход к
              урокам.
            </Description>
          </div>
          {canCreateCourse && (
            <ActionButton type="button" onClick={() => setShowCreateModal(true)}>
              Создать курс
            </ActionButton>
          )}
        </Intro>

        {loading && <StatusCard>Загрузка курсов...</StatusCard>}
        {error && <StatusCard $error>{error}</StatusCard>}

        <CourseGrid>
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              type="button"
              onClick={() => navigate(`/mycourses/${course.id}`)}
            >
              <CardText>
                <CardTitle style={{ color: course.accent_color || "#16a085" }}>
                  {course.name}
                </CardTitle>
                <CardDescription>
                  {course.description || "Описание курса пока не заполнено."}
                </CardDescription>
                <MetaRow>
                  <span>Уроков: {course.topic_ids?.length || 0}</span>
                  <span>Задач: {course.total_tasks || 0}</span>
                  {course.active_group_name && (
                    <span>Группа: {course.active_group_name}</span>
                  )}
                </MetaRow>
                {course.schedule_summary && (
                  <ScheduleLine>{course.schedule_summary}</ScheduleLine>
                )}
                <ProgressLabel>
                  Прогресс: {Math.round(course.progress_percent || 0)}%
                </ProgressLabel>
                <ProgressTrack>
                  <ProgressBar
                    style={{
                      width: `${Math.min(100, course.progress_percent || 0)}%`,
                      background: course.accent_color || "#16a085",
                    }}
                  />
                </ProgressTrack>
              </CardText>
              <Visual>
                {course.cover_image ? (
                  <Image src={resolveAssetUrl(course.cover_image)} alt={course.name} />
                ) : (
                  <CodePattern />
                )}
              </Visual>
            </CourseCard>
          ))}
        </CourseGrid>

        {showCreateModal && canCreateCourse && (
          <Overlay onClick={closeCreateModal}>
            <ModalCard onClick={(event) => event.stopPropagation()}>
              <ModalHeader>
                <div>
                  <FormTitle>Новый курс</FormTitle>
                  <ModalText>
                    Создание курса вынесено в отдельное окно, чтобы страница списка
                    оставалась чистой.
                  </ModalText>
                </div>
                <CloseButton type="button" onClick={closeCreateModal}>
                  ×
                </CloseButton>
              </ModalHeader>

              <CreateForm onSubmit={handleCreateCourse}>
                <FieldRow>
                  <Input
                    placeholder="Название курса"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                  />
                  <ColorInput
                    type="color"
                    value={form.accent_color}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        accent_color: event.target.value,
                      }))
                    }
                  />
                </FieldRow>
                <Textarea
                  placeholder="Краткое описание курса"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                />
                <Textarea
                  placeholder="Подробная общая информация о курсе"
                  value={form.public_info}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, public_info: event.target.value }))
                  }
                  rows={6}
                />

                <CoverSection>
                  <CoverPreview>
                    {form.cover_image ? (
                      <Image
                        src={resolveAssetUrl(form.cover_image)}
                        alt="Предпросмотр обложки курса"
                      />
                    ) : (
                      <CodePattern />
                    )}
                  </CoverPreview>
                  <CoverInfo>
                    <strong>Обложка курса</strong>
                    <span>
                      Вместо URL можно сразу загрузить изображение и посмотреть
                      предпросмотр.
                    </span>
                    <ImageUploadControl
                      inputId="create-course-cover"
                      onChange={handleCoverUpload}
                      onRemove={() =>
                        setForm((prev) => ({
                          ...prev,
                          cover_image: "",
                        }))
                      }
                      uploading={uploadingCover}
                      hasValue={Boolean(form.cover_image)}
                    />
                  </CoverInfo>
                </CoverSection>

                <ButtonRow>
                  <SecondaryButton type="button" onClick={closeCreateModal}>
                    Отмена
                  </SecondaryButton>
                  <SubmitButton type="submit" disabled={creating}>
                    {creating ? "Создаю..." : "Сохранить курс"}
                  </SubmitButton>
                </ButtonRow>
              </CreateForm>
            </ModalCard>
          </Overlay>
        )}
      </Content>
    </Page>
  );
}

export default MyCoursesPage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: 38px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 26px;
`;

const Intro = styled.section`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
`;

const Eyebrow = styled.div`
  color: var(--muted);
  font-style: italic;
  margin-bottom: 10px;
`;

const Title = styled.h1`
  font-size: clamp(34px, 5vw, 52px);
  margin-bottom: 10px;
`;

const Description = styled.p`
  max-width: 660px;
  color: var(--muted);
  line-height: 1.6;
`;

const ActionButton = styled.button`
  border: none;
  border-radius: 14px;
  padding: 14px 18px;
  background: var(--orange);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
`;

const StatusCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;

const CourseGrid = styled.div`
  display: grid;
  gap: 22px;
`;

const CourseCard = styled.button`
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  cursor: pointer;
  text-align: left;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const CardText = styled.div`
  padding: 28px;
`;

const CardTitle = styled.h2`
  font-size: clamp(30px, 4vw, 42px);
  margin-bottom: 16px;
`;

const CardDescription = styled.p`
  font-size: 17px;
  line-height: 1.6;
  min-height: 56px;
  margin-bottom: 22px;
`;

const MetaRow = styled.div`
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  color: var(--muted);
  margin-bottom: 10px;
`;

const ScheduleLine = styled.div`
  margin-bottom: 10px;
  font-weight: 800;
`;

const ProgressLabel = styled.div`
  margin-bottom: 10px;
  font-weight: 700;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: #edf0f6;
  overflow: hidden;
`;

const ProgressBar = styled.div`
  height: 100%;
  border-radius: 999px;
`;

const Visual = styled.div`
  min-height: 260px;
  background: linear-gradient(135deg, #1d222d 0%, #11151d 100%);
  position: relative;
  overflow: hidden;
`;

const CodePattern = styled.div`
  width: 100%;
  height: 100%;
  background:
    linear-gradient(transparent 92%, rgba(255, 255, 255, 0.08) 92%),
    linear-gradient(90deg, transparent 85%, rgba(255, 255, 255, 0.04) 85%),
    radial-gradient(circle at 18% 20%, rgba(255, 127, 42, 0.25), transparent 26%),
    linear-gradient(135deg, #0f131c 0%, #202633 100%);
  background-size: 100% 36px, 36px 100%, auto, auto;
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  width: min(920px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 28px;
  box-shadow: 0 28px 80px rgba(19, 24, 34, 0.2);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
`;

const FormTitle = styled.h2`
  font-size: 28px;
`;

const ModalText = styled.p`
  color: var(--muted);
  line-height: 1.6;
  margin-top: 8px;
  max-width: 620px;
`;

const CloseButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #d6dae4;
  background: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
`;

const CreateForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 72px;
  gap: 12px;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid #d6dae4;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
`;

const ColorInput = styled(Input)`
  padding: 6px;
  min-height: 52px;
`;

const Textarea = styled.textarea`
  width: 100%;
  border: 1px solid #d6dae4;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
  resize: vertical;
`;

const CoverSection = styled.div`
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 18px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const CoverPreview = styled.div`
  min-height: 180px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid #e6eaf2;
  background: #f7f9fc;
`;

const CoverInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  strong {
    font-size: 20px;
  }

  span {
    color: var(--muted);
    line-height: 1.6;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const SecondaryButton = styled.button`
  border: 1px solid #d6dae4;
  border-radius: 12px;
  padding: 14px 18px;
  background: #fff;
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
`;

const SubmitButton = styled.button`
  border: none;
  border-radius: 12px;
  padding: 14px 18px;
  background: #12161f;
  color: #fff;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;
