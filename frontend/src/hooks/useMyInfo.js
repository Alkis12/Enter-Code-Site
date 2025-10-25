import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyInfoOnce } from "../api/profile_info";

export function useMyInfo() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getMyInfoOnce();
        if (!cancelled) setInfo(data);
      } catch (err) {
        if (String(err?.message).includes("401")) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          navigate("/login", { replace: true });
          return;
        }
        if (!cancelled) setError(err?.message || "Произошла ошибка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyInfoOnce({ force: true });
      setInfo(data);
    } catch (err) {
      setError(err?.message || "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return { info, loading, error, refetch };
}
