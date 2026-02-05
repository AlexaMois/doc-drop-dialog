import { useState, useEffect } from "react";

const STORAGE_KEY = "ats_responsible_person";

export function useResponsiblePerson() {
  const [name, setName] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setName(stored);
      setIsLocked(true);
    }
    setIsLoading(false);
  }, []);

  const saveName = (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed && !isLocked) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setName(trimmed);
      setIsLocked(true);
    }
  };

  const updateTempName = (newName: string) => {
    if (!isLocked) {
      setName(newName);
    }
  };

  return {
    name,
    isLocked,
    isLoading,
    saveName,
    updateTempName,
  };
}
