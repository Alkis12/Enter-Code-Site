import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const AchievementToastContext = createContext({
  pushAchievements: () => {},
});

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(18px) translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateX(0);
  }
`;

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function AchievementToastProvider({ children }) {
  const navigate = useNavigate();
  const counterRef = useRef(0);
  const [toasts, setToasts] = useState([]);

  const pushAchievements = (items) => {
    const nextItems = (items || []).filter(Boolean);
    if (nextItems.length === 0) {
      return;
    }

    const mapped = nextItems.map((item) => {
      counterRef.current += 1;
      return {
        ...item,
        toastId: `${item.id || "achievement"}-${counterRef.current}`,
      };
    });

    setToasts((prev) => [...prev, ...mapped].slice(-4));
    mapped.forEach((item) => {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.toastId !== item.toastId));
      }, 7000);
    });
  };

  const value = useMemo(
    () => ({
      pushAchievements,
    }),
    []
  );

  return (
    <AchievementToastContext.Provider value={value}>
      {children}
      <Viewport>
        {toasts.map((toast) => (
          <ToastButton
            key={toast.toastId}
            type="button"
            onClick={() => {
              setToasts((prev) => prev.filter((item) => item.toastId !== toast.toastId));
              navigate("/profile#achievements");
            }}
          >
            <ToastIcon>
              {toast.avatar_url ? (
                <img src={resolveAssetUrl(toast.avatar_url)} alt={toast.title} />
              ) : (
                <span>{(toast.title || "A").slice(0, 1).toUpperCase()}</span>
              )}
            </ToastIcon>
            <ToastBody>
              <ToastLabel>Новое достижение</ToastLabel>
              <strong>{toast.title}</strong>
              <p>{toast.description}</p>
            </ToastBody>
          </ToastButton>
        ))}
      </Viewport>
    </AchievementToastContext.Provider>
  );
}

export function useAchievementToasts() {
  return useContext(AchievementToastContext);
}

const Viewport = styled.div`
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(360px, calc(100vw - 24px));
`;

const ToastButton = styled.button`
  width: 100%;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(255, 185, 107, 0.32), transparent 38%),
    linear-gradient(145deg, #ffffff 0%, #fff7ef 100%);
  box-shadow: 0 18px 38px rgba(17, 24, 39, 0.16);
  padding: 16px;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 14px;
  text-align: left;
  cursor: pointer;
  animation: ${slideIn} 0.28s ease;
`;

const ToastIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, #ff8f3d 0%, #f4c252 100%);
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 28px;
  font-weight: 800;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ToastBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    font-size: 17px;
  }

  p {
    color: #5a6375;
    line-height: 1.5;
  }
`;

const ToastLabel = styled.span`
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #d06e14;
`;
