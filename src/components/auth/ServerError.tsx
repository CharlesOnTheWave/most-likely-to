import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ServerErrorProps {
  message?: string | null;
}

// The message is in the HTML from the start (after a redirect), and most screen readers skip a role="alert" that never
// changed. SignInCard's script focuses [data-server-error] on load so it gets read; nothing to click, so no focus ring.
export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <Alert variant="destructive" tabIndex={-1} data-server-error className="outline-hidden">
      <CircleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
