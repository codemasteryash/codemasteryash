
import { mkdir, writeFile } from "node:fs/promises";

const username = "codemasteryash";
const token = process.env.GH_TOKEN;

if (!token) {
  throw new Error("Missing GH_TOKEN environment variable.");
}

const to = new Date();
to.setUTCHours(23, 59, 59, 999);

const from = new Date(to);
from.setUTCDate(from.getUTCDate() - 364);

const isoDate = (date) => date.toISOString().slice(0, 10);

const query = `
  query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    variables: {
      login: username,
      from: from.toISOString(),
      to: to.toISOString(),
    },
  }),
});

if (!response.ok) {
  throw new Error(`GitHub API returned HTTP ${response.status}`);
}

const result = await response.json();

if (result.errors?.length) {
  throw new Error(
    `GitHub GraphQL error: ${result.errors
      .map((error) => error.message)
      .join("; ")}`
  );
}

const calendar =
  result.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar) {
  throw new Error(`Could not find contribution calendar for ${username}.`);
}

const weeks = calendar.weeks;
const cell = 10;
const gap = 3;
const step = cell + gap;
const left = 36;
const top = 32;
const graphWidth = weeks.length * step;
const width = left + graphWidth + 16;
const height = 125;

const colors = {
  NONE: "#161B22",
  FIRST_QUARTILE: "#0E4429",
  SECOND_QUARTILE: "#006D32",
  THIRD_QUARTILE: "#26A641",
  FOURTH_QUARTILE: "#39D353",
};

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);

const parts = [];

parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`
);

parts.push(`
  <title id="title">${username}'s GitHub Contribution Graph</title>
  <desc id="desc">Daily GitHub contributions over approximately the last year. Total contributions: ${calendar.totalContributions}.</desc>
  <rect width="100%" height="100%" rx="8" fill="#0D1117"/>
  <text x="${left}" y="18" fill="#E6EDF3" font-size="11" font-family="Arial, sans-serif" font-weight="600">CONTRIBUTIONS</text>
  <text x="${width - 12}" y="18" fill="#00D9FF" font-size="10" text-anchor="end" font-family="Arial, sans-serif">${calendar.totalContributions} total</text>
`);

const weekdayLabels = [
  { day: 1, label: "Mon" },
  { day: 3, label: "Wed" },
  { day: 5, label: "Fri" },
];

for (const item of weekdayLabels) {
  parts.push(
    `<text x="3" y="${top + item.day * step + 8}" fill="#8B949E" font-size="9" font-family="Arial, sans-serif">${item.label}</text>`
  );
}

let previousMonth = "";

weeks.forEach((week, weekIndex) => {
  const x = left + weekIndex * step;
  const firstDate = week.contributionDays[0]?.date;

  if (firstDate) {
    const month = new Date(`${firstDate}T12:00:00Z`).getUTCMonth();
    const monthName = new Date(`${firstDate}T12:00:00Z`)
      .toLocaleString("en-US", { month: "short", timeZone: "UTC" });

    if (month !== previousMonth) {
      parts.push(
        `<text x="${x}" y="28" fill="#8B949E" font-size="9" font-family="Arial, sans-serif">${escapeXml(monthName)}</text>`
      );
      previousMonth = month;
    }
  }

  for (const day of week.contributionDays) {
    const y = top + day.weekday * step;
    const color = colors[day.contributionLevel] ?? colors.NONE;
    const date = escapeXml(day.date);
    const count = day.contributionCount;

    parts.push(
      `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${color}"><title>${count} contributions on ${date}</title></rect>`
    );
  }
});

const legendY = height - 13;
const legendItems = [
  { label: "Less", color: colors.NONE },
  { label: "", color: colors.FIRST_QUARTILE },
  { label: "", color: colors.SECOND_QUARTILE },
  { label: "", color: colors.THIRD_QUARTILE },
  { label: "More", color: colors.FOURTH_QUARTILE },
];

const legendWidth = 14;
const legendStart = width - 100;

parts.push(
  `<text x="${legendStart - 28}" y="${legendY + 8}" fill="#8B949E" font-size="9" font-family="Arial, sans-serif">Less</text>`
);

legendItems.slice(1, 4).forEach((item, index) => {
  parts.push(
    `<rect x="${legendStart + index * legendWidth}" y="${legendY}" width="9" height="9" rx="2" fill="${item.color}"/>`
  );
});

parts.push(
  `<rect x="${legendStart + 3 * legendWidth}" y="${legendY}" width="9" height="9" rx="2" fill="${colors.FOURTH_QUARTILE}"/>`,
  `<text x="${legendStart + 3 * legendWidth + 14}" y="${legendY + 8}" fill="#8B949E" font-size="9" font-family="Arial, sans-serif">More</text>`,
  "</svg>"
);

await mkdir("assets", { recursive: true });
await writeFile(
  "assets/contribution-graph.svg",
  parts.join("\n"),
  "utf8"
);

console.log(
  `Generated contribution graph: ${calendar.totalContributions} contributions across ${weeks.length} weeks.`
);
