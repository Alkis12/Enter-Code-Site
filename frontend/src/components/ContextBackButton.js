import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function ContextBackButton({
  className,
  fallbackTo = "/profile",
  children = "Назад",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const handleClick = () => {
    const target = location.state?.from;
    if (typeof target === "string" && target && target !== currentPath) {
      navigate(target);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}

export default ContextBackButton;
