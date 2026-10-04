import { useEffect, useState } from "react";

// Pending state for a native form post (React form status only tracks function actions). The form sets it once the post
// goes out; a page restored by Back (bfcache) clears it, otherwise the button would stay locked.
export function useSubmitPending(initial = false) {
  const [pending, setPending] = useState(initial);

  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setPending(false);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return [pending, setPending] as const;
}
