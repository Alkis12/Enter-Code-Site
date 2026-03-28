import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";

const LINE_HEIGHT = 24;
const EDITOR_PADDING = 16;
const GUTTER_WIDTH = 52;

function normalizeLanguage(language) {
  const normalized = (language || "python").toLowerCase();
  if (normalized === "js") {
    return "javascript";
  }
  if (normalized === "javascript") {
    return "javascript";
  }
  return "python";
}

function getLanguageLabel(language) {
  return normalizeLanguage(language) === "javascript" ? "JavaScript" : "Python";
}

function highlightCode(code, language) {
  const prismLanguage = normalizeLanguage(language);
  const grammar =
    Prism.languages[prismLanguage] || Prism.languages.python || Prism.languages.clike;
  return Prism.highlight(code, grammar, prismLanguage);
}

function getLineCount(code) {
  return Math.max((code || "").split("\n").length, 1);
}

function getActiveLineFromPosition(code, position) {
  return Math.max((code || "").slice(0, position || 0).split("\n").length, 1);
}

function CodeEditor({
  value,
  onChange,
  language = "python",
  placeholder = "",
  minHeight = 320,
  readOnly = false,
}) {
  const normalizedLanguage = normalizeLanguage(language);
  const [activeLine, setActiveLine] = useState(1);
  const lineCount = getLineCount(value);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount]
  );

  useEffect(() => {
    setActiveLine((current) => Math.min(current, lineCount));
  }, [lineCount]);

  function handleCursorActivity(event) {
    setActiveLine(getActiveLineFromPosition(value, event.target.selectionStart));
  }

  return (
    <EditorShell $minHeight={minHeight}>
      <EditorTopBar>
        <LanguageBadge>{getLanguageLabel(normalizedLanguage)}</LanguageBadge>
        <EditorHint>
          {lineCount} строк · автоотступ · подсветка синтаксиса
        </EditorHint>
      </EditorTopBar>
      <EditorBody $minHeight={minHeight}>
        <ActiveLine
          aria-hidden="true"
          style={{
            transform: `translateY(${EDITOR_PADDING + (activeLine - 1) * LINE_HEIGHT}px)`,
          }}
        />
        <LineNumbers aria-hidden="true">
          {lineNumbers.map((lineNumber) => (
            <LineNumber key={lineNumber} $active={lineNumber === activeLine}>
              {lineNumber}
            </LineNumber>
          ))}
        </LineNumbers>
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={(code) => highlightCode(code, normalizedLanguage)}
          padding={{
            top: EDITOR_PADDING,
            right: EDITOR_PADDING,
            bottom: EDITOR_PADDING,
            left: EDITOR_PADDING + GUTTER_WIDTH,
          }}
          textareaClassName="code-editor-textarea"
          preClassName={`language-${normalizedLanguage}`}
          readOnly={readOnly}
          placeholder={placeholder}
          onClick={handleCursorActivity}
          onFocus={handleCursorActivity}
          onKeyUp={handleCursorActivity}
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
            lineHeight: `${LINE_HEIGHT}px`,
            minHeight,
            whiteSpace: "pre",
          }}
        />
      </EditorBody>
    </EditorShell>
  );
}

export default CodeEditor;

const EditorShell = styled.div`
  border: 1px solid #1f2837;
  border-radius: 20px;
  background:
    radial-gradient(circle at top left, rgba(74, 144, 226, 0.18), transparent 32%),
    linear-gradient(180deg, #101724 0%, #131b29 100%);
  overflow: hidden;
  min-height: ${(props) => `${props.$minHeight}px`};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
`;

const EditorTopBar = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(8, 13, 20, 0.35);
  flex-wrap: wrap;
`;

const LanguageBadge = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.14);
  color: #fde68a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const EditorHint = styled.div`
  color: rgba(203, 213, 225, 0.7);
  font-size: 12px;
`;

const EditorBody = styled.div`
  position: relative;
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

  .token.comment,
  .token.prolog,
  .token.doctype,
  .token.cdata {
    color: #60738f;
  }

  .token.keyword,
  .token.operator,
  .token.control-flow {
    color: #ff7ab8;
  }

  .token.function,
  .token.method,
  .token.class-name {
    color: #7dd3fc;
  }

  .token.string,
  .token.char,
  .token.attr-value {
    color: #a5e075;
  }

  .token.number,
  .token.boolean,
  .token.constant {
    color: #f8bd4f;
  }

  .token.punctuation {
    color: #d6deeb;
  }
`;

const ActiveLine = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: ${LINE_HEIGHT}px;
  background: rgba(59, 130, 246, 0.08);
  border-top: 1px solid rgba(96, 165, 250, 0.08);
  border-bottom: 1px solid rgba(96, 165, 250, 0.08);
  pointer-events: none;
`;

const LineNumbers = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${GUTTER_WIDTH}px;
  padding: ${EDITOR_PADDING}px 10px ${EDITOR_PADDING}px 0;
  background: rgba(8, 13, 20, 0.2);
  border-right: 1px solid rgba(148, 163, 184, 0.12);
  display: flex;
  flex-direction: column;
  pointer-events: none;
`;

const LineNumber = styled.span`
  height: ${LINE_HEIGHT}px;
  line-height: ${LINE_HEIGHT}px;
  text-align: right;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: ${(props) => (props.$active ? "#f8fafc" : "rgba(148, 163, 184, 0.72)")};
  font-weight: ${(props) => (props.$active ? 700 : 500)};
`;
