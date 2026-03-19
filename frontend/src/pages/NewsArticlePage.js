import React from "react";
import styled from "styled-components";
import { Link, Navigate, useParams } from "react-router-dom";

import Header from "../components/Header/Header";
import { getNewsItem } from "../content/news";

function NewsArticlePage() {
  const { slug } = useParams();
  const article = getNewsItem(slug);

  if (!article) {
    return <Navigate to="/news" replace />;
  }

  return (
    <Page>
      <Header />
      <Content>
        <BackLink to="/news">Ко всем новостям</BackLink>
        <ArticleCard>
          <Intro>{article.intro}</Intro>
          <Title>{article.title}</Title>
          {article.body.map((paragraph) => (
            <Paragraph key={paragraph}>{paragraph}</Paragraph>
          ))}
        </ArticleCard>
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

const Intro = styled.div`
  color: #23598d;
  font-weight: 800;
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
