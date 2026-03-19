import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "../components/Header/Header";
import { createCourse, getMyCourses } from "../api/learning";
import { getCurrentUserType, isAuthenticated } from "../api/auth";

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
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialCourseForm);
  const [showCreate, setShowCreate] = useState(false);

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

  const handleCreateCourse = async (event) => {
    event.preventDefault();
    try {
      await createCourse(form);
      setForm(initialCourseForm);
      setShowCreate(false);
      loadCourses();
    } catch (err) {
      setError(err.message || "Не удалось создать курс");
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
              Здесь собраны все ваши курсы, прогресс по ним и переход к урокам.
            </Description>
          </div>
          {userType !== "student" && (
            <ActionButton type="button" onClick={() => setShowCreate((prev) => !prev)}>
              {showCreate ? "Скрыть форму" : "Создать курс"}
            </ActionButton>
          )}
        </Intro>

        {showCreate && userType !== "student" && (
          <CreateCard onSubmit={handleCreateCourse}>
            <FormTitle>Новый курс</FormTitle>
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
              rows={5}
            />
            <Input
              placeholder="Ссылка на картинку курса (необязательно)"
              value={form.cover_image}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, cover_image: event.target.value }))
              }
            />
            <SubmitButton type="submit">Сохранить курс</SubmitButton>
          </CreateCard>
        )}

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
                <CardDescription>{course.description}</CardDescription>
                <MetaRow>
                  <span>Уроков: {course.topic_ids?.length || 0}</span>
                  <span>Задач: {course.total_tasks || 0}</span>
                  {course.active_group_name && <span>Группа: {course.active_group_name}</span>}
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

const CreateCard = styled.form`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const FormTitle = styled.h2`
  font-size: 24px;
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

const SubmitButton = styled.button`
  align-self: flex-start;
  border: none;
  border-radius: 12px;
  padding: 14px 18px;
  background: #12161f;
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
    linear-gradient(transparent 92%, rgba(255,255,255,0.08) 92%),
    linear-gradient(90deg, transparent 85%, rgba(255,255,255,0.04) 85%),
    radial-gradient(circle at 18% 20%, rgba(255,127,42,0.25), transparent 26%),
    linear-gradient(135deg, #0f131c 0%, #202633 100%);
  background-size: 100% 36px, 36px 100%, auto, auto;
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
