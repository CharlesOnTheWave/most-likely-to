import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SubmitButton({ pendingText, icon, children }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Spinner aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}
