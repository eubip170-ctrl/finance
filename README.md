# Event / Macro Studier

Investment research tool ispirato a MiroFish, riscritto in Node.js/Next.js per essere
deployato su Vercel.

L'obiettivo finale è una pipeline:

```
Second Brain  →  Markets  →  Anomalies  →  Opportunities  →  Portfolios  →  Optimizer
```

Il progetto cresce per sprint. Lo **sprint 1** copre le fondamenta:

- **Second Brain** — ingestion + embeddings su Supabase pgvector, retrieval semantico.
- **Markets** — connettori Yahoo Finance e RSS curato.
- **Event Studier** — stile MiroFish ma orientato a eventi macro/geopolitici:
  ontologia → knowledge graph → attori di mercato → simulazione → report scenario.

## Stack

| Layer | Scelta |
| --- | --- |
| App | Next.js 15 (App Router, RSC) + TypeScript + Tailwind |
| DB / Vector | Supabase (Postgres + pgvector) |
| Job orchestration | Inngest (step functions) + Vercel Cron |
| LLM | OpenAI (`gpt-4o-mini` di default, configurabile via env) |
| Embeddings | OpenAI `text-embedding-3-small` forzato a 1024 dims (o Voyage opzionale) |
| Markets data | `yahoo-finance2` + `rss-parser` |
| Hosting | Vercel |

## Struttura

```
.
├── app/                 # Next.js App Router (UI + API routes)
│   ├── api/
│   │   ├── brain/       # ingest + query (Second Brain)
│   │   ├── events/      # CRUD eventi seed
│   │   ├── markets/     # quote, history, feed news
│   │   ├── reports/     # report scenario
│   │   └── inngest/     # webhook Inngest
│   ├── brain/           # UI Second Brain
│   ├── events/          # UI eventi + grafo
│   ├── markets/         # UI mercati
│   └── reports/         # UI report
├── lib/
│   ├── brain/           # chunking, embeddings, retrieval
│   ├── markets/         # yahoo, rss
│   ├── studier/         # ontology, actors, simulation, report (pattern MiroFish)
│   ├── llm/             # client Anthropic
│   ├── supabase/        # client + types
│   └── inngest/         # functions Inngest
├── supabase/migrations/ # schema SQL
└── legacy/              # MiroFish originale (riferimento)
```

## Setup locale

```bash
npm install
cp .env.example .env.local         # riempi le chiavi
npm run dev
```

Per il database serve un progetto Supabase con `pgvector` abilitato. Le migration sono
in `supabase/migrations/`.

## Deploy

Su Vercel: import del repo, aggiungere le variabili in `.env.example`. Gli endpoint
`/api/inngest` e `/api/cron/*` vengono chiamati rispettivamente da Inngest e dal cron
Vercel (config in `vercel.json`).

## Roadmap

| Sprint | Contenuto |
| --- | --- |
| 1 (corrente) | Brain ingestion/RAG · Markets connectors · Event Studier minimale |
| 2 | Anomaly detector (z-score, volume spike, sentiment shift) → tabella `signals` |
| 3 | Opportunities (LLM ragiona sui signal usando Brain come contesto) |
| 4 | Portfolios prestabiliti + matching opportunities |
| 5 | Optimizer (mean-variance / Black-Litterman) |

## License

AGPL-3.0 (ereditata dal progetto MiroFish originale, conservato in `legacy/`).
