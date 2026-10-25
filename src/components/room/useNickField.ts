import { useEffect, useState, type RefObject } from "react";
import { browserNickStorage, readRememberedNick } from "@/lib/rooms/remembered-nick";

// The nick field's state for the join form and "Nowa gra". Once, after mounting (so the server's render and the first
// one stay empty and match), it looks at the field itself. Text that got there before the form ran in the browser
// (typed on a slow phone, restored by the browser, autofill) is only in the page, because hydration leaves the field as
// it is: it becomes the state, so the counter and the check before posting see it, and nothing replaces it. An empty
// field gets the nick this browser remembers (S-14) when the form allows it, and only while it is still empty, never
// over what the player typed meanwhile (impl-review F1 of remembered-nick).
export function useNickField(
  initial: string,
  formRef: RefObject<HTMLFormElement | null>,
  { enabled, suggest }: { enabled: boolean; suggest: boolean },
) {
  const [nick, setNick] = useState(initial);

  useEffect(() => {
    if (!enabled) return;
    const typed = formRef.current?.querySelector<HTMLInputElement>('[name="nick"]')?.value ?? "";
    const next = typed !== "" ? typed : suggest ? readRememberedNick(browserNickStorage()) : null;
    if (next === null) return;
    setNick((current) => (typed !== "" || current === "" ? next : current));
  }, [formRef, enabled, suggest]);

  return [nick, setNick] as const;
}
