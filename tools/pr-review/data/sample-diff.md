diff --git a/src/pages/api/rooms/[id]/vote.ts b/src/pages/api/rooms/[id]/vote.ts
index 3c1f2aa..8d04e1b 100644
--- a/src/pages/api/rooms/[id]/vote.ts
+++ b/src/pages/api/rooms/[id]/vote.ts
@@ -44,7 +44,13 @@ export const POST: APIRoute = async (context) => {
   const supabase = createClient(context.request.headers, context.cookies);
   if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });
 
   const result = await castVote(supabase, roomId, target, playerToken, round);
-  if (result.ok) await ringLobby(context.locals, supabase, roomId);
+  if (result.ok) {
+    // Debug for the evening with friends: who voted, so we can see if the screen sends the right nick.
+    console.log("vote", { roomId, round, voter: playerToken ?? context.locals.user?.id, target });
+    await ringLobby(context.locals, supabase, roomId);
+  }
   return actionAnswer(OP, roomId, result);
 };
diff --git a/src/components/room/VoteButton.tsx b/src/components/room/VoteButton.tsx
index 51a9e02..b77c3d0 100644
--- a/src/components/room/VoteButton.tsx
+++ b/src/components/room/VoteButton.tsx
@@ -12,7 +12,7 @@ export function VoteButton({ nick, disabled, onVote }: VoteButtonProps) {
   return (
     <Button
-      className="w-full"
+      className="w-full bg-purple-600"
       disabled={disabled}
       onClick={() => {
         onVote(nick);
