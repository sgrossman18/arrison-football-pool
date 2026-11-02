import { TEAM_ABBREVIATIONS, teamName } from "@/lib/teams";

// Sorted by the name shown in the dropdown (49ers, Bears, Bengals, ...), not
// by city, so what admins read is what they scan alphabetically.
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
