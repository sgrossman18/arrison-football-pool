import { TEAM_ABBREVIATIONS, teamName } from "@/lib/teams";

// Alphabetical by team name (Bears, Bengals, Bills...) rather than the
// city-first order teams.ts happens to be declared in (Arizona, Atlanta,
// Baltimore...), which people kept finding confusing.
const ALPHABETICAL_BY_NAME = [...TEAM_ABBREVIATIONS].sort((a, b) =>
  teamName(a).localeCompare(teamName(b)),
);

export default function TeamSelect({
  name,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required className={className}>
      <option value="" disabled>
        {placeholder ?? "Team"}
      </option>
      {ALPHABETICAL_BY_NAME.map((abbr) => (
        <option key={abbr} value={abbr}>
          {teamName(abbr)}
        </option>
      ))}
    </select>
  );
}
