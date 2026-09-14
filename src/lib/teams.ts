// NFL team abbreviations, display names, and colors, keyed the same way
// ESPN's API uses them, so games/picks can be matched without translation.
export const NFL_TEAMS: Record<string, { name: string; color: string }> = {
  ARI: { name: "Cardinals", color: "#97233F" },
  ATL: { name: "Falcons", color: "#A71930" },
  BAL: { name: "Ravens", color: "#241773" },
  BUF: { name: "Bills", color: "#00338D" },
  CAR: { name: "Panthers", color: "#0085CA" },
  CHI: { name: "Bears", color: "#0B162A" },
  CIN: { name: "Bengals", color: "#FB4F14" },
  CLE: { name: "Browns", color: "#311D00" },
  DAL: { name: "Cowboys", color: "#041E42" },
  DEN: { name: "Broncos", color: "#FB4F14" },
  DET: { name: "Lions", color: "#0076B6" },
  GB: { name: "Packers", color: "#203731" },
  HOU: { name: "Texans", color: "#03202F" },
  IND: { name: "Colts", color: "#002C5F" },
  JAX: { name: "Jaguars", color: "#101820" },
  KC: { name: "Chiefs", color: "#E31837" },
  LV: { name: "Raiders", color: "#000000" },
  LAC: { name: "Chargers", color: "#0080C6" },
  LAR: { name: "Rams", color: "#003594" },
  MIA: { name: "Dolphins", color: "#008E97" },
  MIN: { name: "Vikings", color: "#4F2683" },
  NE: { name: "Patriots", color: "#002244" },
  NO: { name: "Saints", color: "#D3BC8D" },
  NYG: { name: "Giants", color: "#0B2265" },
  NYJ: { name: "Jets", color: "#125740" },
  PHI: { name: "Eagles", color: "#004C54" },
  PIT: { name: "Steelers", color: "#FFB612" },
  SF: { name: "49ers", color: "#AA0000" },
  SEA: { name: "Seahawks", color: "#002244" },
  TB: { name: "Buccaneers", color: "#D50A0A" },
  TEN: { name: "Titans", color: "#0C2340" },
  WSH: { name: "Commanders", color: "#5A1414" },
};

export function teamName(abbr: string): string {
  return NFL_TEAMS[abbr]?.name ?? abbr;
}

export const TEAM_ABBREVIATIONS = Object.keys(NFL_TEAMS);
