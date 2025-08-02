import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');

* {
    margin: 0;
    padding: 0;
    font-family: 'JetBrains Mono', monospace;
}

h1 {
    font-size: 50px;
    font-weight: 600;
    margin-bottom: 16px;
}    
h3 {
    font-size: 24px;
    font-weight: bold;
    margin: 8px 0;
}
`;

export default GlobalStyle;
