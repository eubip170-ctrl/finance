import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "event-macro-studier",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export type Events = {
  "event/ontology.requested": { data: { eventId: string } };
  "event/actors.requested": { data: { eventId: string } };
  "event/simulation.requested": {
    data: { eventId: string; maxRounds?: number };
  };
  "event/report.requested": {
    data: { eventId: string; simulationId?: string };
  };
  "event/pipeline.requested": {
    data: { eventId: string; maxRounds?: number };
  };
};
