export type TimezoneOption = {
  id: string;
  label: string;
  abbreviation: string;
  cities: string[];
};

// Four US zones for now, per spec — extensible later by adding more entries
// (the search/lookup logic below doesn't assume only these four exist).
export const timezoneOptions: TimezoneOption[] = [
  {
    id: "America/New_York",
    label: "Eastern Time",
    abbreviation: "ET",
    cities: ["New York", "Atlanta", "Miami", "Boston", "Washington DC", "Eastern"],
  },
  {
    id: "America/Chicago",
    label: "Central Time",
    abbreviation: "CT",
    cities: ["Chicago", "Dallas", "Houston", "New Orleans", "Central"],
  },
  {
    id: "America/Denver",
    label: "Mountain Time",
    abbreviation: "MT",
    cities: ["Denver", "Salt Lake City", "Provo", "Boise", "Mountain"],
  },
  {
    id: "America/Los_Angeles",
    label: "Pacific Time",
    abbreviation: "PT",
    cities: ["Los Angeles", "Seattle", "San Francisco", "Portland", "Pacific"],
  },
];

export const defaultTimezoneId = "America/Denver";

export function searchTimezones(query: string): TimezoneOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return timezoneOptions;
  return timezoneOptions.filter(
    (tz) =>
      tz.label.toLowerCase().includes(q) ||
      tz.abbreviation.toLowerCase().includes(q) ||
      tz.id.toLowerCase().includes(q) ||
      tz.cities.some((city) => city.toLowerCase().includes(q)),
  );
}

export function timezoneById(id: string): TimezoneOption | undefined {
  return timezoneOptions.find((tz) => tz.id === id);
}

export function zoneLabel(id: string): string {
  const tz = timezoneById(id);
  return tz ? `${tz.label} (${tz.abbreviation})` : id;
}

/** Formats a stored UTC instant (ISO string) as wall-clock time in the given IANA zone. */
export function formatInZone(
  isoInstant: string,
  zoneId: string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
): string {
  return new Date(isoInstant).toLocaleString(undefined, { ...options, timeZone: zoneId });
}

/** The zone's offset (in minutes, positive = ahead of UTC) at the given instant. */
function offsetMinutesAt(zoneId: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneId,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {} as Record<string, string>);
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - instant.getTime()) / 60000;
}

/** Converts a wall-clock date+time entered in a given IANA zone into a UTC ISO instant. */
export function zonedTimeToUtcIso(dateStr: string, timeStr: string, zoneId: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const utcGuess = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  const offset = offsetMinutesAt(zoneId, new Date(utcGuess));
  return new Date(utcGuess - offset * 60000).toISOString();
}

/** Splits a stored UTC instant into `{ date, time }` wall-clock strings for the given zone,
 * suitable for pre-filling `<input type="date">` / `<input type="time">`. */
export function isoToZonedParts(isoInstant: string, zoneId: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneId,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .formatToParts(new Date(isoInstant))
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {} as Record<string, string>);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
