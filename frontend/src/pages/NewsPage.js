import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

import Header from "../components/Header/Header";
import { newsItems } from "../content/news";

function NewsPage() {
  return (
    <Page>
      <Header />
      <Content>
        <SectionLabel>Новости</SectionLabel>
        <Title>Что нового в проекте</Title>
        <NewsList>
          {newsItems.map((item) => (
            <NewsCard key={item.slug} to={`/news/${item.slug}`}>
              <Intro>{item.intro}</Intro>
              <h2>{item.title}</h2>
              <p>{item.preview}</p>
              <ReadMore>Открыть новость</ReadMore>
            </NewsCard>
          ))}
        </NewsList>
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
`;

const SectionLabel = styled.div`
  color: var(--muted);
  font-style: italic;
  margin-bottom: 12px;
`;

const Title = styled.h1`
  font-size: clamp(36px, 6vw, 58px);
  margin-bottom: 24px;
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

const Intro = styled.div`
  color: #23598d;
  font-weight: 800;
`;

const ReadMore = styled.div`
  font-weight: 800;
  color: var(--text);
`;
