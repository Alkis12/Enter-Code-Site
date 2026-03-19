import React from "react";
import styled from "styled-components";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";

function highlightCode(code, language) {
  if (language === "python") {
    return Prism.highlight(code, Prism.languages.python, "python");
  }
  return Prism.highlight(code, Prism.languages.clike, "clike");
}

function CodeEditor({
  value,
  onChange,
  language = "python",
  placeholder = "",
  minHeight = 320,
  readOnly = false,
}) {
  return (
    <EditorShell $minHeight={minHeight}>
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlightCode(code, language)}
        padding={16}
        textareaClassName="code-editor-textarea"
        preClassName={`language-${language}`}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 14,
          lineHeight: 1.6,
          minHeight,
          whiteSpace: "pre",
        }}
      />
    </EditorShell>
  );
}

export default CodeEditor;

const EditorShell = styled.div`
  border: 1px solid #1d2230;
  border-radius: 18px;
  background: #141925;
  overflow: hidden;
  min-height: ${(props) => `${props.$minHeight}px`};

  .code-editor-textarea,
  pre {
    outline: none;
    min-height: ${(props) => `${props.$minHeight}px`};
  }

  .code-editor-textarea {
    color: #edf1ff !important;
    caret-color: #ffffff;
  }

  pre {
    margin: 0 !important;
    background: transparent !important;
  }

  textarea,
  pre,
  code {
    font-family: "JetBrains Mono", monospace !important;
  }
`;
