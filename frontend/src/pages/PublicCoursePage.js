import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link, useParams } from "react-router-dom";

import Header from "../components/Header/Header";
import {
  getPublicCourseDetail,
  submitCourseRequest,
} from "../api/learning";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function PublicCoursePage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    contact_name: "",
    contact_value: "",
    comment: "",
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await getPublicCourseDetail(courseId);
        if (active) {
          setCourse(response.course);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Не удалось загрузить курс");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [courseId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      await submitCourseRequest(courseId, form);
      setNotice("Заявка отправлена. Мы свяжемся с вами.");
      setForm({
        contact_name: "",
        contact_value: "",
        comment: "",
      });
    } catch (err) {
      setError(err.message || "Не удалось отправить заявку");
    } finally {
      setSending(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        {loading && <InfoCard>Загрузка курса...</InfoCard>}
        {error && <InfoCard $error>{error}</InfoCard>}

        {!loading && course && (
          <>
            <HeroCard>
              <HeroBody>
                <Eyebrow>Курс</Eyebrow>
                <HeroTitle>{course.name}</HeroTitle>
                <HeroText>{course.description}</HeroText>

                <MetaRow>
                  <MetaCard>
                    <span>Расписание</span>
                    <strong>{course.schedule_summary || "Уточняется"}</strong>
                  </MetaCard>
                  <MetaCard>
                    <span>Уроков</span>
                    <strong>{course.topic_ids?.length || 0}</strong>
                  </MetaCard>
                  <MetaCard>
                    <span>Участников</span>
                    <strong>{course.total_students || 0}</strong>
                  </MetaCard>
                </MetaRow>

                <HeroActions>
                  <PrimaryButton href="#course-request">Записаться</PrimaryButton>
                  <SecondaryLink to="/events">Вернуться к расписанию</SecondaryLink>
                </HeroActions>
              </HeroBody>

              <Visual $accent={course.accent_color}>
                {course.cover_image ? (
                  <img src={resolveAssetUrl(course.cover_image)} alt={course.name} />
                ) : (
                  <VisualPattern />
                )}
              </Visual>
            </HeroCard>

            <Grid>
              <SectionCard>
                <SectionTitle>О курсе</SectionTitle>
                <SectionText>
                  {course.public_info || "Подробное описание курса преподаватель добавит позже."}
                </SectionText>
              </SectionCard>

              <SectionCard id="course-request">
                <SectionTitle>Оставить заявку</SectionTitle>
                <SectionText>
                  Оставьте контакт, и администратор свяжется с вами по этому курсу.
                </SectionText>
                {notice && <InfoCard>{notice}</InfoCard>}
                <Form onSubmit={handleSubmit}>
                  <Field>
                    <Label>Как к вам обращаться</Label>
                    <Input
                      value={form.contact_name}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_name: event.target.value,
                        }))
                      }
                      placeholder="Имя"
                    />
                  </Field>
                  <Field>
                    <Label>Контакт для связи</Label>
                    <Input
                      value={form.contact_value}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_value: event.target.value,
                        }))
                      }
                      placeholder="Телефон, Telegram или email"
                      required
                    />
                  </Field>
                  <Field>
                    <Label>Комментарий</Label>
                    <Textarea
                      rows={5}
                      value={form.comment}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          comment: event.target.value,
                        }))
                      }
                      placeholder="Например, возраст ученика и удобное время"
                    />
                  </Field>
                  <SubmitButton type="submit" disabled={sending}>
                    {sending ? "Отправляю..." : "Отправить заявку"}
                  </SubmitButton>
                </Form>
              </SectionCard>
            </Grid>
          </>
        )}
      </Content>
    </Page>
  );
}

export default PublicCoursePage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const HeroCard = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 360px;
  gap: 22px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const HeroBody = styled.div`
  background: var(--card);
  border-radius: 28px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Eyebrow = styled.div`
  color: var(--orange);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const HeroTitle = styled.h1`
  font-size: clamp(34px, 6vw, 58px);
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.7;
`;

const MetaRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
`;

const MetaCard = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  background: #f7f8fb;

  span {
    display: block;
    color: var(--muted);
    margin-bottom: 8px;
  }

  strong {
    font-size: 21px;
  }
`;

const HeroActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.a`
  text-decoration: none;
  border-radius: 14px;
  background: var(--orange);
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
`;

const SecondaryLink = styled(Link)`
  text-decoration: none;
  border-radius: 14px;
  border: 1px solid #d7dbe4;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
`;

const Visual = styled.div`
  min-height: 100%;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  background: linear-gradient(
    145deg,
    ${(props) => props.$accent || "#16a085"} 0%,
    #0f1824 100%
  );

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const VisualPattern = styled.div`
  width: 100%;
  height: 100%;
  min-height: 300px;
  background:
    radial-gradient(circle at 24% 24%, rgba(255,255,255,0.24), transparent 20%),
    linear-gradient(transparent 90%, rgba(255,255,255,0.08) 90%),
    linear-gradient(90deg, transparent 88%, rgba(255,255,255,0.05) 88%);
  background-size: auto, 100% 36px, 36px 100%;
`;

const Grid = styled.section`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const SectionCard = styled.section`
  background: var(--card);
  border-radius: 24px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionTitle = styled.h2`
  font-size: 30px;
`;

const SectionText = styled.p`
  color: var(--muted);
  line-height: 1.7;
  white-space: pre-wrap;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.span`
  font-weight: 700;
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

const SubmitButton = styled.button`
  align-self: flex-start;
  border: none;
  border-radius: 12px;
  background: #111722;
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;
`;

const InfoCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;
