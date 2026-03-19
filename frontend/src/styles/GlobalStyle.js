import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  @import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Manrope:wght@400;500;700;800&display=swap");

  :root {
    --bg: #f8f6f2;
    --card: #ffffff;
    --text: #202126;
    --muted: #7e7f86;
    --orange: #ff7f2a;
    --orange-dark: #df6921;
    --green: #12a38a;
    --green-soft: #ddf7f2;
    --border: rgba(32, 33, 38, 0.08);
    --shadow: 0 14px 36px rgba(27, 33, 58, 0.1);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body, #root {
    min-height: 100%;
  }

  body {
    background: radial-gradient(circle at top left, #fff1dd 0%, transparent 35%), var(--bg);
    color: var(--text);
    font-family: "JetBrains Mono", monospace;
  }

  button, input, textarea, select {
    font: inherit;
  }

  a {
    color: inherit;
  }

  h1, h2, h3, h4 {
    font-weight: 800;
  }
`;

export default GlobalStyle;
