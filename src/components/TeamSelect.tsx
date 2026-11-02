import { TEAM_ABBREVIATIONS, teamName } from "@/lib/teams";

// TEAM_ABBREVIATIONS follows NFL_TEAMS' declaration order, which is
// alphabetical by city (Arizona, Atlanta, Baltimore, Buffalo, ...).
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
      {TEAM_ABBREVIATIONS.map((abbr) => (
        <option key={abbr} value={abbr}>
          {teamName(abbr)}
        </option>
      ))}
    </select>
  );
}
