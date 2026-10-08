import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DiscordIcon, GoogleIcon } from "@/components/auth/ProviderIcons";
import { useSubmitPending } from "@/components/auth/useSubmitPending";

type Provider = "discord" | "google";

const PROVIDERS: { id: Provider; label: string; Icon: typeof DiscordIcon }[] = [
  { id: "discord", label: "Zaloguj przez Discord", Icon: DiscordIcon },
  { id: "google", label: "Zaloguj przez Google", Icon: GoogleIcon },
];

// Starting state for /dev/ui-kitchen-sink (a provider already clicked); the real page never sets it.
interface Preview {
  pending?: Provider;
}

interface Props {
  preview?: Preview;
}

// One plain form per provider, so the buttons work without JS. The provider rides in a hidden field: the clicked
// button is disabled at once, and a disabled button drops out of the posted form.
export default function ProviderButtons({ preview }: Props) {
  const [pending, setPending] = useSubmitPending(preview?.pending !== undefined);
  // Only picks the button with the spinner; Back (bfcache) clears `pending`, which hides the spinner too.
  const [clicked, setClicked] = useState<Provider | null>(preview?.pending ?? null);

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <form
          key={id}
          method="POST"
          action="/api/auth/oauth"
          onSubmit={() => {
            setClicked(id);
            setPending(true);
          }}
        >
          <input type="hidden" name="provider" value={id} />
          <Button type="submit" variant="outline" disabled={pending} className="w-full">
            {pending && clicked === id ? (
              <>
                <Spinner aria-hidden="true" />
                Przekierowuję…
              </>
            ) : (
              <>
                <Icon />
                {label}
              </>
            )}
          </Button>
        </form>
      ))}
    </div>
  );
}
