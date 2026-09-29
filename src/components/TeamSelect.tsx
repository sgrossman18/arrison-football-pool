"use client";

import { useState } from "react";
import { TEAM_ABBREVIATIONS, teamName } from "@/lib/teams";

// Reshuffles the team list every time this field gets focus — i.e. every
// time an admin clicks in to open it — purely to mess with people used to
// finding teams by city. Purely cosmetic: option `value`s are still team
// abbreviations, so submission/defaultValue behave exactly as a normal
// alphabetical select would.
function shuffled(): string[] {
  const arr = [...TEAM_ABBREVIATIONS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
  const [order, setOrder] = useState(shuffled);

  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      required
      onFocus={() => setOrder(shuffled())}
      className={className}
    >
      <option value="" disabled>
        {placeholder ?? "Team"}
      </option>
      {order.map((abbr) => (
        <option key={abbr} value={abbr}>
          {teamName(abbr)}
        </option>
      ))}
    </select>
  );
}
