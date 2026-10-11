import { describe, expect, it } from "vitest";
import { anonClient, newLinkToken } from "./support/clients";

// First proof that the publishable key really gets the database's refusals. If this file ever passes on a privileged
// key, or after a grant is opened, every db test is suspect.
describe("canary: the publishable key is refused by the real database", () => {
  const anon = anonClient();

  it("anon reading player_secrets gets 42501 and no rows", async () => {
    const result = await anon.from("player_secrets").select("*");
    const data: unknown = result.data;

    expect(result.error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  // Positive control: an allowed call must work, or a wrong address would look like a refusal everywhere. A fresh,
  // well-formed code reaches the table lookup instead of stopping at the pattern check.
  it("anon asking room_link about an unknown code gets status unknown", async () => {
    const result = await anon.rpc("room_link", { p_link_token: newLinkToken() });
    const data: unknown = result.data;

    expect(result.error).toBeNull();
    expect(data).toEqual({ status: "unknown" });
  });
});
