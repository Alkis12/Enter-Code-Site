import { useState, useEffect } from "react";
import { getMyGroups } from "../api/my_groups";

export function useMyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMyGroups() {
      try {
        const response = await getMyGroups();
        setGroups(response.data || response);
      } catch (err) {
        setError(err.message || "Произошла ошибка");
      } finally {
        setLoading(false);
      }
    }

    fetchMyGroups();
  }, []);
  console.log(groups);
  return { groups, loading, error };
}
