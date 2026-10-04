import { Eye, EyeOff } from "lucide-react";
import { InputGroupButton } from "@/components/ui/input-group";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <InputGroupButton size="icon-xs" onClick={onToggle} aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}>
      {visible ? <EyeOff /> : <Eye />}
    </InputGroupButton>
  );
}
