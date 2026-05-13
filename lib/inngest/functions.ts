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

/** Cron: ingest curated RSS feeds into the Second Brain. */
export const rssCronFn = inngest.createFunction(
  { id: "rss-ingest-cron", retries: 1 },
  { cron: "0 */2 * * *" }, // every 2 hours
  async ({ step }) => {
    const items = await step.run("fetch-feeds", async () => {
      const { fetchAllFeeds } = await import("@/lib/markets/rss");
      return fetchAllFeeds();
    });

    const supabase = supabaseAdmin();
    const { ingestDocument } = await import("@/lib/brain/ingest");

    let inserted = 0;
    for (const item of items.slice(0, 30)) {
      if (!item.title || !item.contentSnippet) continue;
      const { data: existing } = await supabase
        .from("brain_documents")
        .select("id")
        .eq("source_url", item.link ?? "")
        .maybeSingle();
      if (existing) continue;

      await step.run(`ingest-${inserted}`, () =>
        ingestDocument({
          sourceType: "rss",
          title: item.title,
          rawText: `${item.title}\n\n${item.contentSnippet ?? ""}`,
          sourceUrl: item.link,
          publishedAt: item.isoDate,
          metadata: { feed: item.feedName, category: item.category },
        }),
      );
      inserted++;
    }
    return { fetched: items.length, inserted };
  },
);

export const functions = [
  ontologyFn,
  actorsFn,
  simulationFn,
  reportFn,
  pipelineFn,
  rssCronFn,
];
