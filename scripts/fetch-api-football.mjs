#!/usr/bin/env node
// Build-time API-Football adapter. The key is read only in Node, sent in the
// provider header, and never written to generated browser assets or logs.
// Failed refreshes are non-destructive: existing snapshots stay available.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

for (const envFile of [".env.local", ".env"]) {
  if (!existsSync(resolve(envFile))) continue;
  try { process.loadEnvFile(resolve(envFile)); }
  catch (error) { console.warn(`Warning: could not load ${envFile}: ${messageFor(error)}`); }
}

const API_ROOT = "https://v3.football.api-sports.io";
const DESTINATION = resolve(process.env.API_FOOTBALL_DESTINATION?.trim() || "data/portal.json");
const PUBLIC_DESTINATION = resolve(
  process.env.API_FOOTBALL_PUBLIC_DESTINATION?.trim() || "public/data/portal-live.json",
);
const KEY = process.env.API_FOOTBALL_KEY?.trim();
const FAIL_ON_ERROR = process.env.API_FOOTBALL_FAIL_ON_ERROR === "true";
const REFRESH_MODE = (process.env.API_FOOTBALL_REFRESH_MODE || "full").trim().toLowerCase();
const TIMEOUT_MS = integerEnv("API_FOOTBALL_TIMEOUT_MS", 15_000, 2_000, 60_000);
const LOOKAHEAD_DAYS = integerEnv("API_FOOTBALL_LOOKAHEAD_DAYS", 14, 0, 60);
const MAX_STANDING_TABLES = integerEnv("API_FOOTBALL_MAX_STANDING_TABLES", 20, 0, 100);
const RETRIES = integerEnv("API_FOOTBALL_RETRIES", 2, 0, 5);
const FETCH_LIVE = process.env.API_FOOTBALL_FETCH_LIVE !== "false";
const FETCH_STANDINGS = process.env.API_FOOTBALL_FETCH_STANDINGS !== "false";
const LEAGUE_IDS = new Set(
  (process.env.API_FOOTBALL_LEAGUE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite),
);
const observedRateLimits = [];

if (!KEY) {
  console.log("API-Football: API_FOOTBALL_KEY is not set; keeping the previous provider snapshot and using the fixture fallback.");
  process.exit(FAIL_ON_ERROR ? 1 : 0);
}

if (REFRESH_MODE !== "full" && REFRESH_MODE !== "live") {
  console.warn(`API-Football: unsupported API_FOOTBALL_REFRESH_MODE (${REFRESH_MODE}); expected full or live.`);
  process.exit(FAIL_ON_ERROR ? 1 : 0);
}

const startedAt = new Date();
const dateFrom = formatDate(startedAt);
const dateTo = formatDate(addUtcDays(startedAt, LOOKAHEAD_DAYS));

try {
  if (DESTINATION === PUBLIC_DESTINATION) {
    throw new Error("API_FOOTBALL_DESTINATION and API_FOOTBALL_PUBLIC_DESTINATION must be different files.");
  }
  const snapshot = REFRESH_MODE === "live"
    ? await refreshLiveSnapshot()
    : await refreshFullSnapshot();

  atomicJsonWrites([
    { destination: DESTINATION, value: snapshot },
    { destination: PUBLIC_DESTINATION, value: publicSnapshot(snapshot) },
  ]);
  console.log(
    `API-Football (${REFRESH_MODE}): wrote ${snapshot.fixtures.length} fixtures across ${snapshot.coverage.leagueCount} leagues and ${snapshot.coverage.standingTableCount} standing tables.`,
  );
} catch (error) {
  const previous = existingSnapshotDescription();
  console.warn(`API-Football ${REFRESH_MODE} refresh skipped: ${messageFor(error)} ${previous}`);
  // Static builds must remain available when the provider is down or rate limited.
  process.exitCode = FAIL_ON_ERROR ? 1 : 0;
}

async function refreshFullSnapshot() {
  const datedFixtures = [];
  for (const date of utcDates(startedAt, LOOKAHEAD_DAYS)) {
    const result = await fetchAllPages("/fixtures", {
      date,
      timezone: "UTC",
    });
    datedFixtures.push(...result.data);
  }

  const warnings = [];
  let liveFixtures = [];
  if (FETCH_LIVE) {
    try {
      const result = await fetchAllPages("/fixtures", { live: "all", timezone: "UTC" });
      liveFixtures = result.data;
    } catch (error) {
      warnings.push(`Live endpoint: ${messageFor(error)}`);
    }
  }

  const fixtureById = new Map();
  for (const fixture of [...datedFixtures, ...liveFixtures]) {
    const id = numberOrNull(fixture?.fixture?.id);
    if (id !== null) fixtureById.set(String(id), fixture);
  }
  const mergedFixtures = [...fixtureById.values()];
  const sourceFixtures = LEAGUE_IDS.size
    ? mergedFixtures.filter((fixture) => LEAGUE_IDS.has(numberOrNull(fixture?.league?.id)))
    : mergedFixtures;
  const fixtures = sourceFixtures
    .map(normalizeFixture)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const standings = [];
  if (FETCH_STANDINGS) {
    const competitions = uniqueCompetitionSeasons(sourceFixtures).slice(0, MAX_STANDING_TABLES);
    for (const competition of competitions) {
      try {
        const result = await fetchAllPages("/standings", {
          league: String(competition.leagueId),
          season: String(competition.season),
        });
        standings.push(...normalizeStandingTables(result.data));
      } catch (error) {
        warnings.push(`Standings ${competition.leagueId}/${competition.season}: ${messageFor(error)}`);
      }
    }
  }

  const updatedAt = new Date().toISOString();
  const liveFixtureCount = fixtures.filter((fixture) => fixture.status.isLive).length;
  const finishedFixtureCount = fixtures.filter((fixture) => fixture.status.isFinished).length;
  const leagueCount = new Set(fixtures.map((fixture) => fixture.league.id)).size;
  const successfulStandingTables = standings.filter((table) => table.rows.length > 0).length;
  return {
    schemaVersion: 1,
    provider: "api-football",
    asOf: updatedAt,
    updatedAt,
    coverage: {
      dateFrom,
      dateTo,
      fixtureCount: fixtures.length,
      liveFixtureCount,
      finishedFixtureCount,
      leagueCount,
      standingTableCount: successfulStandingTables,
      requestedIncludes: ["fixtures", "live-fixtures", "standings"],
      features: {
        fixtures: true,
        scores: true,
        statuses: true,
        events: fixtures.some((fixture) => fixture.events.length > 0),
        lineups: fixtures.some((fixture) => fixture.lineups.length > 0),
        injuries: fixtures.some((fixture) => fixture.injuries.length > 0),
        standings: successfulStandingTables > 0,
      },
      rateLimit: rateLimitSummary(),
      warnings,
    },
    fixtures,
    standings,
  };
}

async function refreshLiveSnapshot() {
  const existing = readExistingSnapshot();
  if (!existing) {
    throw new Error("Live refresh requires an existing api-football snapshot; run full mode first.");
  }

  const today = formatDate(startedAt);
  const todayResult = await fetchAllPages("/fixtures", { date: today, timezone: "UTC" });
  const warnings = [];
  let liveFixtures = [];
  try {
    const liveResult = await fetchAllPages("/fixtures", { live: "all", timezone: "UTC" });
    liveFixtures = liveResult.data;
  } catch (error) {
    warnings.push(`Live endpoint: ${messageFor(error)}`);
  }

  const fixtureById = new Map();
  for (const fixture of existing.fixtures) {
    const isToday = fixture.startTime?.slice(0, 10) === today;
    if (!isToday && !fixture.status?.isLive) fixtureById.set(portalFixtureKey(fixture), fixture);
  }
  for (const fixture of [...todayResult.data, ...liveFixtures]) {
    if (!providerFixtureAllowed(fixture)) continue;
    const normalized = normalizeFixture(fixture);
    fixtureById.set(portalFixtureKey(normalized), normalized);
  }

  const fixtures = [...fixtureById.values()]
    .filter((fixture) => providerFixtureAllowed(fixture))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const standings = Array.isArray(existing.standings) ? existing.standings : [];
  const updatedAt = new Date().toISOString();
  const liveFixtureCount = fixtures.filter((fixture) => fixture.status.isLive).length;
  const finishedFixtureCount = fixtures.filter((fixture) => fixture.status.isFinished).length;
  const leagueCount = new Set(fixtures.map((fixture) => fixture.league.id)).size;
  const standingTableCount = standings.filter((table) => Array.isArray(table.rows) && table.rows.length > 0).length;
  const existingCoverage = object(existing.coverage) || {};
  const existingFeatures = object(existingCoverage.features) || {};

  return {
    ...existing,
    schemaVersion: 1,
    provider: "api-football",
    asOf: updatedAt,
    updatedAt,
    coverage: {
      ...existingCoverage,
      dateFrom: stringOrNull(existingCoverage.dateFrom) || today,
      dateTo: stringOrNull(existingCoverage.dateTo) || today,
      fixtureCount: fixtures.length,
      liveFixtureCount,
      finishedFixtureCount,
      leagueCount,
      standingTableCount,
      requestedIncludes: ["today-fixtures", "live-fixtures"],
      features: {
        fixtures: true,
        scores: true,
        statuses: true,
        events: Boolean(existingFeatures.events) || fixtures.some((fixture) => fixture.events.length > 0),
        lineups: Boolean(existingFeatures.lineups) || fixtures.some((fixture) => fixture.lineups.length > 0),
        injuries: Boolean(existingFeatures.injuries) || fixtures.some((fixture) => fixture.injuries.length > 0),
        standings: standingTableCount > 0,
      },
      rateLimit: rateLimitSummary(),
      warnings,
    },
    fixtures,
    standings,
  };
}

async function fetchAllPages(path, initialParams) {
  // API-Football v3 returns a paging object for consistency, but these football
  // endpoints reject a `page` query parameter. One request returns the full
  // result set for the supplied date, live filter or league/season pair.
  const response = await fetchApi(path, initialParams);
  if (!Array.isArray(response.data)) {
    throw new Error(`Unexpected ${path} response: response is not an array.`);
  }
  return { data: response.data };
}

async function fetchApi(path, params) {
  const url = new URL(`${API_ROOT}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(name, value);
  }

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "x-apisports-key": KEY,
          "User-Agent": "theopenmodel.com portal snapshot",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < RETRIES) {
        await wait(backoffMs(attempt));
        continue;
      }
      throw new Error(`API-Football request timed out or failed: ${messageFor(error)}`);
    }

    const bodyText = await response.text();
    let body;
    try { body = bodyText ? JSON.parse(bodyText) : {}; }
    catch { body = {}; }

    const rateLimit = rateLimitFromHeaders(response.headers, path);
    if (rateLimit) observedRateLimits.push(rateLimit);
    const detail = providerErrorDetail(body);
    if (response.ok && !detail) {
      if (!Array.isArray(body.response)) {
        throw new Error("API-Football response did not contain a response array.");
      }
      return { data: body.response, paging: object(body.paging) || {} };
    }

    const rejectedBecause = detail || response.statusText || "request rejected";
    const retryable = response.status === 429
      || response.status >= 500
      || /rate.?limit|too many|temporar/i.test(rejectedBecause);
    if (retryable && attempt < RETRIES) {
      const retryAfter = numberOrNull(response.headers.get("retry-after"));
      const delay = retryAfter !== null
        ? Math.min(retryAfter * 1_000, 15_000)
        : backoffMs(attempt);
      await wait(delay);
      continue;
    }
    throw new ApiError(response.status, `API-Football HTTP ${response.status}: ${rejectedBecause}`);
  }

  throw new Error("API-Football request exhausted its retry budget.");
}

function normalizeFixture(input) {
  const fixture = object(input?.fixture) || {};
  const league = object(input?.league) || {};
  const teams = object(input?.teams) || {};
  const home = normalizeParticipant(teams.home, "home");
  const away = normalizeParticipant(teams.away, "away");
  const goals = object(input?.goals) || {};
  const score = object(input?.score) || {};
  const halfTime = object(score.halftime) || {};
  const status = object(fixture.status) || {};
  const shortStatus = stringOrNull(status.short) || "NS";
  const currentHome = numberOrNull(goals.home);
  const currentAway = numberOrNull(goals.away);
  const halfTimeHome = numberOrNull(halfTime.home);
  const halfTimeAway = numberOrNull(halfTime.away);
  const scores = [
    normalizeScore(home.id, "home", "CURRENT", currentHome),
    normalizeScore(away.id, "away", "CURRENT", currentAway),
    normalizeScore(home.id, "home", "1ST_HALF", halfTimeHome),
    normalizeScore(away.id, "away", "1ST_HALF", halfTimeAway),
  ].filter((entry) => entry.goals !== null);
  const isLive = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(shortStatus);
  const isFinished = ["FT", "AET", "PEN"].includes(shortStatus);
  const leagueId = numberOrNull(league.id);

  return {
    id: `api-football:${fixture.id}`,
    providerId: numberOrNull(fixture.id),
    name: `${home.name} vs ${away.name}`,
    startTime: isoDate(fixture.date, fixture.timestamp),
    resultInfo: isFinished && currentHome !== null && currentAway !== null
      ? `${currentHome}-${currentAway}`
      : null,
    seasonId: numberOrNull(league.season),
    stageId: null,
    roundId: null,
    hasOdds: false,
    lastProcessedAt: null,
    status: {
      id: null,
      name: stringOrNull(status.long) || shortStatus,
      shortName: shortStatus,
      developerName: shortStatus,
      isLive,
      isFinished,
    },
    league: {
      id: leagueId,
      name: stringOrNull(league.name),
      shortCode: null,
      imageUrl: safeHttpUrl(league.logo),
    },
    round: {
      id: null,
      name: stringOrNull(league.round),
      shortCode: null,
      imageUrl: null,
    },
    venue: normalizeVenue(fixture.venue),
    participants: [home, away],
    score: {
      home: currentHome,
      away: currentAway,
      halfTimeHome,
      halfTimeAway,
    },
    scores,
    events: array(input?.events).map(normalizeEvent).sort(eventSort),
    lineups: array(input?.lineups).flatMap(normalizeLineupBlock),
    injuries: array(input?.injuries).map(normalizeInjury),
  };
}

function normalizeParticipant(input, role = null, position = null) {
  const team = object(input) || {};
  return {
    id: numberOrNull(team.id),
    name: stringOrNull(team.name) || "Unknown team",
    shortCode: stringOrNull(team.code),
    imageUrl: safeHttpUrl(team.logo),
    role,
    position,
    winner: typeof team.winner === "boolean" ? team.winner : null,
  };
}

function normalizeScore(participantId, participant, description, goals) {
  return {
    id: null,
    typeId: null,
    participantId: numberOrNull(participantId),
    description,
    participant,
    goals,
  };
}

function normalizeEvent(input) {
  const time = object(input?.time) || {};
  const team = object(input?.team) || {};
  const player = object(input?.player) || {};
  const assist = object(input?.assist) || {};
  const detail = stringOrNull(input?.detail);
  return {
    id: null,
    typeId: null,
    typeName: stringOrNull(input?.type),
    subTypeId: null,
    participantId: numberOrNull(team.id),
    playerId: numberOrNull(player.id),
    playerName: stringOrNull(player.name),
    relatedPlayerId: numberOrNull(assist.id),
    relatedPlayerName: stringOrNull(assist.name),
    minute: numberOrNull(time.elapsed),
    extraMinute: numberOrNull(time.extra),
    result: null,
    info: stringOrNull(input?.comments),
    addition: detail,
    injured: detail ? /injur/i.test(detail) : null,
  };
}

function normalizeLineupBlock(input) {
  const team = object(input?.team) || {};
  const participantId = numberOrNull(team.id);
  const starters = array(input?.startXI).map((entry) => normalizeLineupPlayer(entry, participantId, "starter"));
  const substitutes = array(input?.substitutes).map((entry) => normalizeLineupPlayer(entry, participantId, "substitute"));
  return [...starters, ...substitutes];
}

function normalizeLineupPlayer(input, participantId, role) {
  const player = object(input?.player) || {};
  return {
    id: null,
    participantId,
    playerId: numberOrNull(player.id),
    playerName: stringOrNull(player.name),
    typeId: null,
    positionId: null,
    formationField: stringOrNull(player.grid),
    jerseyNumber: numberOrNull(player.number),
    captain: null,
    details: [{ typeId: null, value: role }],
  };
}

function normalizeInjury(input) {
  const player = object(input?.player) || {};
  const team = object(input?.team) || {};
  return {
    id: null,
    participantId: numberOrNull(team.id),
    playerId: numberOrNull(player.id),
    playerName: stringOrNull(player.name),
    category: stringOrNull(player.type),
    reason: stringOrNull(player.reason),
    startDate: null,
    endDate: null,
  };
}

function normalizeStandingTables(input) {
  return array(input).flatMap((entry) => {
    const league = object(entry?.league) || {};
    const leagueId = numberOrNull(league.id);
    const seasonId = numberOrNull(league.season);
    if (seasonId === null) return [];
    const rows = array(league.standings)
      .flatMap((group) => array(group))
      .map((row) => normalizeStandingRow(row, leagueId, seasonId))
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    return [{ seasonId, leagueId, rows }];
  });
}

function normalizeStandingRow(input, leagueId, seasonId) {
  const team = object(input?.team) || {};
  const all = object(input?.all) || {};
  const goals = object(all.goals) || {};
  const form = stringOrNull(input?.form) || "";
  return {
    id: null,
    participantId: numberOrNull(team.id),
    position: numberOrNull(input?.rank),
    points: numberOrNull(input?.points),
    result: stringOrNull(input?.description) || stringOrNull(input?.status),
    leagueId,
    seasonId,
    stageId: null,
    groupId: null,
    roundId: null,
    participant: normalizeParticipant(team, null, numberOrNull(input?.rank)),
    details: [
      standingDetail("Played", all.played),
      standingDetail("Won", all.win),
      standingDetail("Drawn", all.draw),
      standingDetail("Lost", all.lose),
      standingDetail("Goals for", goals.for),
      standingDetail("Goals against", goals.against),
      standingDetail("Goal difference", input?.goalsDiff),
    ].filter((detail) => detail.value !== null),
    form: [...form].map((value) => ({ fixtureId: null, form: value })),
  };
}

function standingDetail(description, value) {
  return { typeId: null, value: scalarOrNull(value), description };
}

function normalizeVenue(input) {
  const venue = object(input) || {};
  return {
    id: numberOrNull(venue.id),
    name: stringOrNull(venue.name),
    city: stringOrNull(venue.city),
    capacity: null,
    imageUrl: null,
  };
}

function uniqueCompetitionSeasons(fixtures) {
  const values = new Map();
  for (const fixture of fixtures) {
    const leagueId = numberOrNull(fixture?.league?.id);
    const season = numberOrNull(fixture?.league?.season);
    if (leagueId === null || season === null) continue;
    values.set(`${leagueId}:${season}`, { leagueId, season });
  }
  return [...values.values()];
}

function providerFixtureAllowed(fixture) {
  if (LEAGUE_IDS.size === 0) return true;
  return LEAGUE_IDS.has(numberOrNull(fixture?.league?.id));
}

function portalFixtureKey(fixture) {
  const providerId = numberOrNull(fixture?.providerId ?? fixture?.fixture?.id);
  return providerId !== null ? String(providerId) : String(fixture?.id);
}

function rateLimitFromHeaders(headers, requestedEntity) {
  const remaining = numberOrNull(headers.get("x-ratelimit-requests-remaining"));
  const resetsInSeconds = numberOrNull(headers.get("x-ratelimit-requests-reset"));
  if (remaining === null && resetsInSeconds === null) return null;
  return { resetsInSeconds, remaining, requestedEntity };
}

function rateLimitSummary() {
  if (observedRateLimits.length === 0) return null;
  const remaining = observedRateLimits
    .map((entry) => entry.remaining)
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0] ?? null;
  const resetsInSeconds = observedRateLimits
    .map((entry) => entry.resetsInSeconds)
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0] ?? null;
  return { resetsInSeconds, remaining, requestedEntity: "API-Football daily requests" };
}

function atomicJsonWrites(entries) {
  const temporaryFiles = [];
  try {
    for (const entry of entries) {
      mkdirSync(dirname(entry.destination), { recursive: true });
      const temporary = `${entry.destination}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(entry.value, null, 2)}\n`, { mode: 0o644 });
      temporaryFiles.push({ temporary, destination: entry.destination });
    }
    for (const file of temporaryFiles) renameSync(file.temporary, file.destination);
  } catch (error) {
    for (const file of temporaryFiles) {
      try { if (existsSync(file.temporary)) unlinkSync(file.temporary); }
      catch { /* Best-effort temporary-file cleanup. */ }
    }
    throw error;
  }
}

function publicSnapshot(snapshot) {
  return {
    ...snapshot,
    standings: [],
    fixtures: snapshot.fixtures.map((fixture) => ({
      ...fixture,
      scores: [],
      events: [],
      lineups: [],
      injuries: [],
    })),
  };
}

function existingSnapshotDescription() {
  if (!existsSync(DESTINATION)) return "No provider snapshot exists; the fixture fallback remains active.";
  try {
    const snapshot = JSON.parse(readFileSync(DESTINATION, "utf8"));
    return `Keeping the previous snapshot from ${snapshot.updatedAt || "an unknown time"}.`;
  } catch {
    return "The existing provider file was left untouched; the fixture fallback remains available.";
  }
}

function readExistingSnapshot() {
  for (const path of [DESTINATION, PUBLIC_DESTINATION]) {
    if (!existsSync(path)) continue;
    try {
      const snapshot = JSON.parse(readFileSync(path, "utf8"));
      if (
        snapshot?.schemaVersion === 1
        && snapshot?.provider === "api-football"
        && Array.isArray(snapshot.fixtures)
        && Array.isArray(snapshot.standings)
        && object(snapshot.coverage)
      ) return snapshot;
    } catch {
      // Try the other configured snapshot before failing live mode.
    }
  }
  return null;
}

function providerErrorDetail(body) {
  const errors = body?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errorValue(errors[0]);
  if (errors && typeof errors === "object" && Object.keys(errors).length > 0) {
    const [name, value] = Object.entries(errors)[0];
    const detail = errorValue(value);
    return detail ? `${name}: ${detail}` : name;
  }
  if (typeof errors === "string" && errors.trim()) return errors.trim().slice(0, 240);
  return null;
}

function errorValue(value) {
  if (typeof value === "string") return value.slice(0, 240);
  if (value && typeof value === "object") {
    const message = value.message || value.error;
    if (typeof message === "string") return message.slice(0, 240);
  }
  return null;
}

function utcDates(start, lookaheadDays) {
  return Array.from(
    { length: lookaheadDays + 1 },
    (_, offset) => formatDate(addUtcDays(start, offset)),
  );
}

function isoDate(value, timestamp) {
  const normalized = isoDateOrNull(value);
  if (normalized) return normalized;
  const seconds = numberOrNull(timestamp);
  if (seconds !== null) return new Date(seconds * 1_000).toISOString();
  throw new Error("Fixture is missing a valid date timestamp.");
}

function isoDateOrNull(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch { return null; }
}

function scalarOrNull(value) {
  return ["string", "number", "boolean"].includes(typeof value) ? value : null;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function eventSort(a, b) {
  return (a.minute ?? 999) - (b.minute ?? 999)
    || (a.extraMinute ?? 0) - (b.extraMinute ?? 0);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function integerEnv(name, fallback, minimum, maximum) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function backoffMs(attempt) {
  return Math.min(750 * (2 ** attempt), 5_000);
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function messageFor(error) {
  const message = error instanceof Error ? error.message : String(error);
  return KEY ? message.split(KEY).join("[redacted]") : message;
}
