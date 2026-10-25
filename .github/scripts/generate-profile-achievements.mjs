
import { mkdir, writeFile } from "node:fs/promises";

const username = "codemasteryash";
const token = process.env.GH_TOKEN;

if (!token) {
  throw new Error("Missing GH_TOKEN environment variable.");
}

const to = new Date();
const from = new Date(to);
from.setUTCDate(from.getUTCDate() - 364);

const query = `
  query ProfileHighlights($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      followers {
        totalCount
      }
      repositories(
        first: 100
        ownerAffiliations: OWNER
        privacy: PUBLIC
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          stargazerCount
        }
      }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
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
    result.errors.map((error) => error.message).join("; ")
  );
}

const user = result.data?.user;

if (!user) {
  throw new Error(`GitHub user "${username}" was not found.`);
}

const publicRepos = user.repositories.totalCount;
const followers = user.followers.totalCount;
const contributions =
  user.contributionsCollection.contributionCalendar.totalContributions;

// Sum stars across the repositories returned by this query.
// If there are more than 100 public repositories, this is a partial total.
const stars = user.repositories.nodes.reduce(
  (sum, repo) => sum + repo.stargazerCount,
  0
);

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);

const metrics = [
  {
    icon: "01",
    value: publicRepos,
    label: "PUBLIC REPOSITORIES",
    detail: "Projects shared on GitHub",
    color: "#00D9FF",
  },
  {
    icon: "02",
    value: followers,
    label: "FOLLOWERS",
    detail: "Growing developer network",
    color: "#4F9DFF",
  },
  {
    icon: "03",
    value: contributions,
    label: "CONTRIBUTIONS",
    detail: "Activity in the last year",
    color: "#39D353",
  },
  {
    icon: "04",
    value: stars,
    label: "STARS RECEIVED",
    detail: publicRepos > 100
      ? "Across up to 100 public repos"
      : "Across public repositories",
    color: "#C084FC",
  },
];

const width = 900;
const height = 180;
const margin = 8;
const gap = 12;
const cardWidth = (width - margin * 2 - gap * 3) / 4;
const cardHeight = 128;
const cardY = 36;

const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
  `<title id="title">${username} GitHub achievements and milestones</title>`,
  `<desc id="desc">GitHub profile metrics: public repositories, followers, contributions during the last year, and stars received.</desc>`,
  `<rect width="100%" height="100%" rx="12" fill="#0D1117"/>`,
  `<text x="${margin}" y="22" fill="#E6EDF3" font-size="15" font-weight="700" font-family="Arial, sans-serif">GITHUB ACHIEVEMENTS &amp; MILESTONES</text>`,
];

metrics.forEach((metric, index) => {
  const x = margin + index * (cardWidth + gap);

  parts.push(
    `<rect x="${x}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="10" fill="#111B2A" stroke="#263B52" stroke-width="1"/>`,
    `<rect x="${x}" y="${cardY}" width="${cardWidth}" height="3" rx="1.5" fill="${metric.color}"/>`,
    `<text x="${x + 14}" y="${cardY + 26}" fill="${metric.color}" font-size="10" font-weight="700" font-family="Arial, sans-serif">${metric.icon} / ${escapeXml(metric.label)}</text>`,
    `<text x="${x + 14}" y="${cardY + 66}" fill="#F0F6FC" font-size="29" font-weight="700" font-family="Arial, sans-serif">${escapeXml(metric.value)}</text>`,
    `<text x="${x + 14}" y="${cardY + 94}" fill="#9FB0C3" font-size="10" font-family="Arial, sans-serif">${escapeXml(metric.detail)}</text>`
  );
});

parts.push("</svg>");

await mkdir("assets", { recursive: true });

await writeFile(
  "assets/profile-achievements.svg",
  parts.join("\n"),
  "utf8"
);

console.log("Generated profile achievement metrics:", {
  publicRepos,
  followers,
  contributions,
  stars,
});
