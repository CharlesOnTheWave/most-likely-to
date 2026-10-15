// The Worker's only way to write a log line (Workers Logs). Every line goes through a list of the keys it may carry:
// any other key is dropped here, whatever the caller passes, so a nick, a player token, a link code, a vote's target or
// the request's URL cannot slip into the log by mistake (AGENTS.md, Hard Rules; context/changes/first-live-round/
// research.md, T6; context/audits/observability/2026-10-11_guest-join-live-lobby.md, §6 step 2). A value stays only as
// a string, a finite number or a boolean, never an object that could hold one of those inside it.
//
// - op: what was attempted (a function or an action), route: the route pattern, never the URL; step: where it failed;
// - roomId: a room's id, not personal data; status: an HTTP status; code: a SQLSTATE or another short reason;
// - errName: an error's name, never its message; field: the field of an answer that did not pass a parser;
// - event, state: a report from a player's screen; outcome: "ok" or the refusal code of one attempt;
// - hasUser, hasPlayerCookie: whether the request had a session or the room's cookie, never their values.
export const LOG_FIELDS = [
  "op",
  "route",
  "step",
  "roomId",
  "status",
  "code",
  "errName",
  "field",
  "event",
  "state",
  "outcome",
  "hasUser",
  "hasPlayerCookie",
] as const;

export type LogField = (typeof LOG_FIELDS)[number];
export type LogValue = string | number | boolean;
export type LogLine = Partial<Record<LogField, LogValue>>;
export type LogLevel = "info" | "warn" | "error";

// Keeps one line short when a value is longer than expected.
const MAX_VALUE_LENGTH = 200;

// The entry's allowed fields with a loggable value; own keys only, so nothing is read from the prototype chain.
export function allowedFields(entry: Readonly<Record<string, unknown>>): LogLine {
  const line: LogLine = {};
  for (const field of LOG_FIELDS) {
    if (!Object.hasOwn(entry, field)) continue;
    const value = entry[field];
    if (typeof value === "string") {
      line[field] = value.slice(0, MAX_VALUE_LENGTH);
    } else if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      line[field] = value;
    }
  }
  return line;
}

// One line as an object, so Workers Logs can filter by its fields. The type stops a literal with another key at build
// time; allowedFields stops everything else at run time.
export function logEvent(level: LogLevel, entry: LogLine): void {
  const line = allowedFields(entry);
  /* eslint-disable no-console */
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
  /* eslint-enable no-console */
}
