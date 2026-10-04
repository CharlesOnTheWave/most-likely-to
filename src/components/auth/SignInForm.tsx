import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { FieldGroup } from "@/components/ui/field";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { useSubmitPending } from "@/components/auth/useSubmitPending";

interface FieldErrors {
  email?: string;
  password?: string;
}

// Starting state for /dev/ui-kitchen-sink, which renders several forms on one page; the real page never sets it.
interface Preview {
  idPrefix: string;
  email?: string;
  password?: string;
  showErrors?: boolean;
  pending?: boolean;
}

interface Props {
  serverError?: string | null;
  preview?: Preview;
}

function getFieldErrors(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = "Podaj adres e-mail";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Podaj poprawny adres e-mail";
  }
  if (!password) {
    errors.password = "Podaj hasło";
  }
  return errors;
}

export default function SignInForm({ serverError, preview }: Props) {
  const [email, setEmail] = useState(preview?.email ?? "");
  const [password, setPassword] = useState(preview?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(() => (preview?.showErrors ? getFieldErrors(email, password) : {}));
  const [pending, setPending] = useSubmitPending(preview?.pending);
  const idPrefix = preview ? `${preview.idPrefix}-` : "";

  function validate() {
    const next = getFieldErrors(email, password);
    setErrors(next);
    return next;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next = validate();
    const firstInvalid = next.email ? "email" : next.password ? "password" : null;
    if (firstInvalid) {
      e.preventDefault();
      // Send the user (and a screen reader) straight to the first broken field.
      e.currentTarget.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    // Fields stay enabled: disabled inputs would drop out of the posted form.
    setPending(true);
  }

  return (
    <form method="POST" action="/api/auth/signin" onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <FormField
          id={`${idPrefix}email`}
          name="email"
          type="email"
          label="E-mail"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearError("email");
          }}
          placeholder="ty@przyklad.pl"
          error={errors.email}
          icon={<Mail className="size-4" />}
        />

        <FormField
          id={`${idPrefix}password`}
          name="password"
          label="Hasło"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearError("password");
          }}
          placeholder="Twoje hasło"
          error={errors.password}
          icon={<Lock className="size-4" />}
          endContent={
            <PasswordToggle
              visible={showPassword}
              onToggle={() => {
                setShowPassword(!showPassword);
              }}
            />
          }
        />

        <ServerError message={serverError} />

        <SubmitButton pending={pending} pendingText="Logowanie…" icon={<LogIn className="size-4" />}>
          Zaloguj się
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
