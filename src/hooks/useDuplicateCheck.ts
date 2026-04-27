import { useState, useEffect, useRef } from "react";
import { SUPABASE_BASE_URL, SUPABASE_ANON_KEY } from "@/lib/apiBase";

export interface DuplicateMatch {
  id: string;
  title: string;
  responsiblePerson: string;
  submissionDate: string;
  status: string;
}

interface DuplicateCheckResult {
  exactMatches: DuplicateMatch[];
  similarMatches: DuplicateMatch[];
  isChecking: boolean;
}

export function useDuplicateCheck(documentName: string): DuplicateCheckResult {
  const [exactMatches, setExactMatches] = useState<DuplicateMatch[]>([]);
  const [similarMatches, setSimilarMatches] = useState<DuplicateMatch[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = documentName.trim();

    if (trimmed.length < 5) {
      setExactMatches([]);
      setSimilarMatches([]);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const supabaseUrl = SUPABASE_BASE_URL;
        const supabaseKey = SUPABASE_ANON_KEY;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/bpium-api?action=check-duplicate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ documentName: trimmed }),
            signal: controller.signal,
          }
        );

        if (!response.ok) throw new Error("Failed");

        const data = await response.json();
        if (!controller.signal.aborted) {
          setExactMatches(data.exactMatches || []);
          setSimilarMatches(data.similarMatches || []);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("Duplicate check error:", e);
        setExactMatches([]);
        setSimilarMatches([]);
      } finally {
        if (!controller.signal.aborted) setIsChecking(false);
      }
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [documentName]);

  return { exactMatches, similarMatches, isChecking };
}
