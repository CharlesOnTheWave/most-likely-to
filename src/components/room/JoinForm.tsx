import React, { useState } from "react";
import { DoorOpen, User } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useSubmitPending } from "@/components/auth/useSubmitPending";
import { FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { NICK_MAX_LENGTH, nickLength } from "@/lib/rooms/shared";

// Starting state for /dev/room-states, which renders several forms on one page; the real page never sets it.
interface Preview {
  idPrefix: string;
  nick?: string;
  showErrors?: boolean;
  pending?: boolean;
}

interface Props {
  // The code from /j/<code>, already checked by the page. It goes back in a hidden field; the nick never goes in a URL.
  linkToken: string;
  serverError?: string | null;
  preview?: Preview;
}

function getNickError(nick: string): string | undefined {
  const length = nickLength(nick);
  if (length === 0) return "Podaj swój nick";
  if (length > NICK_MAX_LENGTH) return `Nick może mieć najwyżej ${NICK_MAX_LENGTH} znaków`;
  return undefined;
}

export default function JoinForm({ linkToken, serverError, preview }: Props) {
  const [nick, setNick] = useState(preview?.nick ?? "");
  const [error, setError] = useState(() => (preview?.showErrors ? getNickError(nick) : undefined));
  const [pending, setPending] = useSubmitPending(preview?.pending);
  const idPrefix = preview ? `${preview.idPrefix}-` : "";
  const length = nickLength(nick);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next = getNickError(nick);
    setError(next);
    if (next) {
      e.preventDefault();
      e.currentTarget.querySelector<HTMLInputElement>('[name="nick"]')?.focus();
      return;
    }
    // The field stays enabled: a disabled input would drop out of the posted form.
    setPending(true);
  }

  return (
    <form method="POST" action="/api/rooms/join" onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="link" value={linkToken} />
      <FieldGroup>
        <FormField
          id={`${idPrefix}nick`}
          name="nick"
          label="Twój nick"
          value={nick}
          onChange={(v) => {
            setNick(v);
            if (error) setError(undefined);
          }}
          placeholder="np. Ola"
          error={error}
          hint={`Tak zobaczą cię inni gracze. Najwyżej ${NICK_MAX_LENGTH} znaków.`}
          icon={<User className="size-4" />}
          endContent={
            <span
              aria-hidden="true"
              className={cn(
                "text-xs tabular-nums",
                length > NICK_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {length}/{NICK_MAX_LENGTH}
            </span>
          }
        />

        <ServerError message={serverError} />

        <SubmitButton pending={pending} pendingText="Dołączanie…" icon={<DoorOpen className="size-4" />}>
          Dołącz
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
