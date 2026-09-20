// NFL kickoff times are always published in US Eastern time. Admins enter
// kickoff as a plain "wall clock" datetime-local value meaning Eastern time;
// this converts it to a correct UTC instant, handling EDT/EST automatically
// for whichever date is given (no extra timezone library needed).
//
// Deliberately avoids the common "round-trip through toLocaleString" trick:
// that depends on the *server process's own* local timezone to reinterpret
// the rendered string, which silently breaks in local dev (or any host not
// running in UTC). Instead we search the two possible fixed offsets Eastern
// time can have (EDT/EST) and pick whichever one Intl actually renders back
// to the wall-clock time the admin typed — timeZone-explicit, so it's
// correct no matter what timezone the process itself runs in.
export function easternDatetimeLocalToUtc(datetimeLocal: string): Date {
  const [datePart, timePart] = datetimeLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (const offsetHours of [4, 5]) {
    // EDT is UTC-4, EST is UTC-5, so "wall clock + offset" is the UTC instant.
    const candidateUtcMs = Date.UTC(year, month - 1, day, hour + offsetHours, minute);
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidateUtcMs)).map((p) => [p.type, p.value]),
    );
    // "24" renders as "00" the next day in this locale's hour12:false output.
    const renderedHour = parts.hour === "24" ? 0 : Number(parts.hour);
    if (
      Number(parts.year) === year &&
      Number(parts.month) === month &&
      Number(parts.day) === day &&
      renderedHour === hour &&
      Number(parts.minute) === minute
    ) {
      return new Date(candidateUtcMs);
    }
  }

  // Shouldn't happen for any real date, but fall back to the EST guess
  // rather than throwing.
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
}

// Human-readable Eastern-time display, e.g. "Sun, Sep 14, 1:00 PM ET".
// Deliberately explicit about the timeZone rather than using bare
// `.toLocaleString()` — that renders in whatever timezone the *server
// process* happens to run in (your local machine in dev, UTC on Vercel in
// prod), which would show everyone confusing UTC times in production.
// Displaying in Eastern consistently matches how NFL kickoffs are normally
// talked about and how the admin enters them, and avoids the
// server/client hydration mismatches that per-viewer local-time rendering
// would cause in a server component.
export function formatEastern(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted} ET`;
}

// Inverse, for pre-filling the admin edit form with the stored UTC instant
// shown back as an Eastern-time datetime-local string.
export function utcToEasternDatetimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export const DEADLINE_TIME_ET = "1:00 PM ET";

// The pool's picks deadline is always 1:00 PM Eastern on a single date the
// admin picks — no per-game kickoff entry needed. Combines a plain
// YYYY-MM-DD date with that fixed time.
export function easternDateAt1pmToUtc(dateOnly: string): Date {
  return easternDatetimeLocalToUtc(`${dateOnly}T13:00`);
}

// Inverse, for pre-filling the deadline date input — just the date part.
export function utcToEasternDateOnly(date: Date): string {
  return utcToEasternDatetimeLocal(date).split("T")[0];
}

// Pure calendar-date arithmetic on a YYYY-MM-DD string — deliberately not
// timezone-aware (no real instant involved), so it can't be thrown off by a
// DST transition falling between the two dates the way adding a fixed
// 7*24h to a UTC instant could.
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const EASTERN_WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// The Eastern-calendar Sunday on or after `after` — used to default a new
// week's deadline date without the admin having to pick it manually.
export function nextEasternSundayDateOnly(after: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(after);
  const daysUntilSunday = (7 - EASTERN_WEEKDAY_INDEX[weekday]) % 7;
  const candidate = new Date(after.getTime() + daysUntilSunday * 86_400_000);
  return utcToEasternDateOnly(candidate);
}

// A week stays "current" (the default on /picks) until 7:00 PM Eastern on the
// first Tuesday after its deadline — for the usual Sunday deadline, that's
// Tuesday evening two days later. Done on Eastern calendar dates so a DST
// change in between can't shift it to 6 or 8 PM.
export function currentWeekExpiry(lock: Date): Date {
  const lockDate = utcToEasternDateOnly(lock);
  const weekday = new Date(`${lockDate}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const daysToTuesday = ((2 - weekday + 7) % 7) || 7;
  return easternDatetimeLocalToUtc(`${addDaysToDateOnly(lockDate, daysToTuesday)}T19:00`);
}
