import { inngest } from "./client";
import { buildOntology } from "@/lib/studier/ontology";
import { generateActors } from "@/lib/studier/actors";
import {
  createSimulation,
  listActorIds,
  markSimulation,
  runActorRound,
} from "@/lib/studier/simulation";
import { generateReport } from "@/lib/studier/report";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Each Inngest step runs as its own short LLM call so we stay well within Vercel's
 * function timeout. Inngest persists state between steps and retries on failure.
 */

export const ontologyFn = inngest.createFunction(
  { id: "studier-ontology", retries: 2 },
  { event: "event/ontology.requested" },
  async ({ event, step }) => {
    return step.run("build-ontology", async () => buildOntology(event.data.eventId));
  },
);

export const actorsFn = inngest.createFunction(
  { id: "studier-actors", retries: 2 },
  { event: "event/actors.requested" },
  async ({ event, step }) => {
    return step.run("generate-actors", async () => generateActors(event.data.eventId));
  },
);

export const simulationFn = inngest.createFunction(
  { id: "studier-simulation", retries: 1 },
  { event: "event/simulation.requested" },
  async ({ event, step }) => {
    const { eventId, maxRounds = 6 } = event.data;

    const { simulationId } = await step.run("create-simulation", () =>
      createSimulation(eventId, { maxRounds }),
    );

    await step.run("mark-running", () => markSimulation(simulationId, "running"));

    const actorIds = await step.run("list-actors", () => listActorIds(eventId));
    if (actorIds.length === 0) {
      await step.run("mark-failed", () =>
        markSimulation(simulationId, "failed", "no actors generated"),
      );
      return { simulationId, error: "no_actors" };
    }

    for (let round = 1; round <= maxRounds; round++) {
      for (const actorId of actorIds) {
        await step.run(`round-${round}-${actorId}`, () =>
          runActorRound(simulationId, actorId, round),
        );
      }
    }

    await step.run("mark-completed", () => markSimulation(simulationId, "completed"));
    return { simulationId, rounds: maxRounds, actorCount: actorIds.length };
  },
);

export const reportFn = inngest.createFunction(
  { id: "studier-report", retries: 2 },
  { event: "event/report.requested" },
  async ({ event, step }) => {
    return step.run("generate-report", async () =>
      generateReport(event.data.eventId, event.data.simulationId),
    );
  },
);

/** End-to-end pipeline: ontology → actors → simulation → report. */
export const pipelineFn = inngest.createFunction(
  { id: "studier-pipeline", retries: 0 },
  { event: "event/pipeline.requested" },
  async ({ event, step }) => {
    const { eventId, maxRounds = 6 } = event.data;

    await step.run("ontology", () => buildOntology(eventId));
    await step.run("actors", () => generateActors(eventId));

    const { simulationId } = await step.run("create-sim", () =>
      createSimulation(eventId, { maxRounds }),
    );
    await step.run("mark-running", () => markSimulation(simulationId, "running"));

    const actorIds = await step.run("list-actors", () => listActorIds(eventId));
    if (actorIds.length === 0) {
      await step.run("mark-failed", () =>
        markSimulation(simulationId, "failed", "no actors generated"),
      );
      return { simulationId, error: "no_actors" };
    }

    for (let round = 1; round <= maxRounds; round++) {
      for (const actorId of actorIds) {
        await step.run(`round-${round}-${actorId}`, () =>
          runActorRound(simulationId, actorId, round),
        );
      }
    }

    await step.run("mark-completed", () => markSimulation(simulationId, "completed"));
    const report = await step.run("report", () => generateReport(eventId, simulationId));
    return { simulationId, reportId: report.reportId };
  },
);

/** Cron: ingest curated RSS feeds into the Second Brain (every 30 min). */
export const rssCronFn = inngest.createFunction(
  { id: "rss-ingest-cron", retries: 1 },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    return step.run("ingest-rss", async () => {
      const { runRssIngest } = await import("@/lib/cron/jobs");
      return runRssIngest({ maxItems: 60 });
    });
  },
);

/** Cron: classify recent Brain docs into events (every 2 hours). */
export const eventDetectCronFn = inngest.createFunction(
  { id: "event-detect-cron", retries: 1 },
  { cron: "15 */2 * * *" },
  async ({ step }) => {
    return step.run("detect", async () => {
      const { detectEventsFromBrain } = await import("@/lib/studier/event-detector");
      return detectEventsFromBrain({
        lookbackHours: 6,
        maxDocs: 30,
        minImpactToCreate: 0.45,
      });
    });
  },
);

/** Cron: auto-run the full pipeline on the top-impact unprocessed events. */
export const autoPipelineCronFn = inngest.createFunction(
  { id: "auto-pipeline-cron", retries: 0, concurrency: { limit: 1 } },
  { cron: "30 */4 * * *" },
  async ({ step }) => {
    const candidates = await step.run("pick-events", async () => {
      const { listUnprocessedEvents } = await import("@/lib/studier/event-detector");
      return listUnprocessedEvents(2);
    });
    if (candidates.length === 0) return { dispatched: 0 };
    for (const c of candidates) {
      await step.sendEvent(`dispatch-${c.id}`, {
        name: "event/pipeline.requested",
        data: { eventId: c.id, maxRounds: 4 },
      });
    }
    return { dispatched: candidates.length };
  },
);

// rssCronFn is intentionally not registered — NewsAPI.ai replaced the RSS
// feed loop. The function code is kept above so it can be re-enabled by
// adding it back into this array if NewsAPI ever needs to be bypassed.
export const functions = [
  ontologyFn,
  actorsFn,
  simulationFn,
  reportFn,
  pipelineFn,
  eventDetectCronFn,
  autoPipelineCronFn,
];
