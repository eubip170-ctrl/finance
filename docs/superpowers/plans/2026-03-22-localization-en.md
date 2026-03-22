# MiroFish English Localization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Chinese text with English across all 57 files in the MiroFish codebase.

**Architecture:** Pure in-place string replacement. No new files, no new dependencies, no i18n framework. Each task handles a batch of related files. Verification via grep for remaining Chinese characters.

**Tech Stack:** Vue 3, Python/Flask — no changes to stack.

**Spec:** `docs/superpowers/specs/2026-03-22-localization-en-design.md`

---

## Parallelism

All 11 tasks are independent — no task's output feeds into another. Tasks can run in parallel within these constraints:

- **Frontend tasks (1-4):** May run in parallel. Each task's verification step only greps its own files.
- **Backend tasks (5-11):** May run in parallel. Each task's verification step only greps its own files.
- **Final sweep (Task 11, Step 5):** Must run after ALL other tasks complete. This is the only cross-task verification.

---

## Translation Guidelines (for all tasks)

- **UI text**: Natural, professional English. Standard UI conventions.
- **Code comments**: Concise English. Remove comments that merely restate the code.
- **Docstrings**: Standard Python/JS documentation style.
- **LLM prompts**: Careful translation preserving prompt engineering intent. These affect output quality.
- **Log/error messages**: Clear, actionable English.
- **Config files** (pyproject.toml, requirements.txt): Translate section comments only.
- **String constants**: Translate Chinese string values assigned to variables/constants (e.g., `STATUS = "处理中"` becomes `STATUS = "Processing"`).
- **Do NOT change**: Identifier names (variables, functions, classes), import paths, or code logic.
- **Syntax safety**: After editing each file, ensure all quotes, f-strings, and template literals are properly closed. Do not break Python/JS/Vue syntax.

---

## Task 1: Frontend — Core Files

Smallest frontend files. Gets the shell, routing, API layer, and store translated.

**Files:**
- Modify: `frontend/index.html` (2 occurrences)
- Modify: `frontend/src/App.vue` (4 occurrences)
- Modify: `frontend/src/store/pendingUpload.js` (2 occurrences)
- Modify: `frontend/src/api/index.js` (8 occurrences)
- Modify: `frontend/src/api/graph.js` (10 occurrences)
- Modify: `frontend/src/api/simulation.js` (29 occurrences)
- Modify: `frontend/src/api/report.js` (8 occurrences)

- [ ] **Step 1: Read all 7 files**
- [ ] **Step 2: Replace all Chinese text with English in each file**
  - `index.html`: page title, meta description
  - `App.vue`: navigation labels, app title
  - `pendingUpload.js`: store state descriptions
  - `api/*.js`: error messages, console.log messages, comments
- [ ] **Step 3: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' frontend/index.html frontend/src/App.vue frontend/src/store/ frontend/src/api/`
Expected: No matches.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/App.vue frontend/src/store/ frontend/src/api/
git commit -m "i18n: translate frontend core files to English"
```

---

## Task 2: Frontend — Views

All 7 view-level Vue components. These are page-level containers with moderate Chinese text.

**Files:**
- Modify: `frontend/src/views/Home.vue` (78 occurrences)
- Modify: `frontend/src/views/MainView.vue` (9 occurrences)
- Modify: `frontend/src/views/Process.vue` (191 occurrences)
- Modify: `frontend/src/views/SimulationView.vue` (42 occurrences)
- Modify: `frontend/src/views/SimulationRunView.vue` (43 occurrences)
- Modify: `frontend/src/views/ReportView.vue` (15 occurrences)
- Modify: `frontend/src/views/InteractionView.vue` (15 occurrences)

- [ ] **Step 1: Read all 7 view files**
- [ ] **Step 2: Translate Home.vue** — Landing page hero text, feature descriptions, upload instructions, navigation
- [ ] **Step 3: Translate MainView.vue** — Step labels, sidebar navigation
- [ ] **Step 4: Translate Process.vue** — Entity/relationship labels, graph status text, detail panel text (191 occurrences — largest view)
- [ ] **Step 5: Translate SimulationView.vue** — Simulation setup form labels, platform options
- [ ] **Step 6: Translate SimulationRunView.vue** — Real-time status indicators, round counters, action labels
- [ ] **Step 7: Translate ReportView.vue and InteractionView.vue** — Report display labels, chat interface text
- [ ] **Step 8: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' frontend/src/views/`
Expected: No matches.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/views/
git commit -m "i18n: translate frontend views to English"
```

---

## Task 3: Frontend — Components (Part 1: Step1-Step3)

The first three workflow step components.

**Files:**
- Modify: `frontend/src/components/Step1GraphBuild.vue` (24 occurrences)
- Modify: `frontend/src/components/Step2EnvSetup.vue` (210 occurrences — heaviest component)
- Modify: `frontend/src/components/Step3Simulation.vue` (74 occurrences)

- [ ] **Step 1: Read all 3 files**
- [ ] **Step 2: Translate Step1GraphBuild.vue** — File upload UI, ontology generation status, progress text
- [ ] **Step 3: Translate Step2EnvSetup.vue** — Agent profile generation UI, entity selection, config generation progress (210 occurrences — be thorough)
- [ ] **Step 4: Translate Step3Simulation.vue** — Simulation configuration form, parameter labels, platform selection
- [ ] **Step 5: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' frontend/src/components/Step1GraphBuild.vue frontend/src/components/Step2EnvSetup.vue frontend/src/components/Step3Simulation.vue`
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Step1GraphBuild.vue frontend/src/components/Step2EnvSetup.vue frontend/src/components/Step3Simulation.vue
git commit -m "i18n: translate Step1-Step3 components to English"
```

---

## Task 4: Frontend — Components (Part 2: Step4-Step5, GraphPanel, HistoryDatabase)

The remaining frontend components, including the two heaviest.

**Files:**
- Modify: `frontend/src/components/Step4Report.vue` (227 occurrences)
- Modify: `frontend/src/components/Step5Interaction.vue` (90 occurrences)
- Modify: `frontend/src/components/GraphPanel.vue` (91 occurrences)
- Modify: `frontend/src/components/HistoryDatabase.vue` (144 occurrences)

- [ ] **Step 1: Read all 4 files**
- [ ] **Step 2: Translate Step4Report.vue** — Report generation progress, chapter navigation, section headers (227 occurrences)
- [ ] **Step 3: Translate Step5Interaction.vue** — Agent chat interface, interview controls, message formatting
- [ ] **Step 4: Translate GraphPanel.vue** — D3 visualization labels, toolbar text, node/edge detail panels, status messages
- [ ] **Step 5: Translate HistoryDatabase.vue** — Project history table, simulation list, action buttons, status badges
- [ ] **Step 6: Verify no Chinese remains in this task's files**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' frontend/src/components/Step4Report.vue frontend/src/components/Step5Interaction.vue frontend/src/components/GraphPanel.vue frontend/src/components/HistoryDatabase.vue`
Expected: No matches.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Step4Report.vue frontend/src/components/Step5Interaction.vue frontend/src/components/GraphPanel.vue frontend/src/components/HistoryDatabase.vue
git commit -m "i18n: translate remaining frontend components to English"
```

---

## Task 5: Backend — Core & Utilities

Small foundational files: entry point, app factory, config, models, and utility modules.

**Files:**
- Modify: `backend/run.py` (12 occurrences)
- Modify: `backend/app/__init__.py` (19 occurrences)
- Modify: `backend/app/config.py` (20 occurrences)
- Modify: `backend/app/models/__init__.py` (1 occurrence)
- Modify: `backend/app/models/project.py` (50 occurrences)
- Modify: `backend/app/models/task.py` (37 occurrences)
- Modify: `backend/app/services/__init__.py` (1 occurrence)
- Modify: `backend/app/utils/__init__.py` (1 occurrence)
- Modify: `backend/app/utils/file_parser.py` (38 occurrences)
- Modify: `backend/app/utils/llm_client.py` (18 occurrences)
- Modify: `backend/app/utils/logger.py` (24 occurrences)
- Modify: `backend/app/utils/retry.py` (35 occurrences)
- Modify: `backend/app/utils/zep_paging.py` (6 occurrences)

- [ ] **Step 1: Read all 13 files**
- [ ] **Step 2: Translate run.py** — Startup comments, error messages, log messages
- [ ] **Step 3: Translate app/__init__.py and config.py** — App factory comments, configuration docstrings
- [ ] **Step 4: Translate models/** — Project and Task model comments, status messages, docstrings
- [ ] **Step 5: Translate utils/** — File parser, LLM client, logger, retry, pagination — all comments, docstrings, log messages
- [ ] **Step 6: Translate services/__init__.py and utils/__init__.py** — Module docstrings
- [ ] **Step 7: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/run.py backend/app/__init__.py backend/app/config.py backend/app/models/ backend/app/utils/ backend/app/services/__init__.py`
Expected: No matches.

- [ ] **Step 8: Commit**

```bash
git add backend/run.py backend/app/__init__.py backend/app/config.py backend/app/models/ backend/app/utils/ backend/app/services/__init__.py
git commit -m "i18n: translate backend core and utilities to English"
```

---

## Task 6: Backend — API Layer

Flask blueprint route handlers. These contain user-facing error messages and API docstrings.

**Files:**
- Modify: `backend/app/api/__init__.py` (1 occurrence)
- Modify: `backend/app/api/graph.py` (114 occurrences)
- Modify: `backend/app/api/simulation.py` (487 occurrences — largest API file)
- Modify: `backend/app/api/report.py` (149 occurrences)

- [ ] **Step 1: Read all 4 files**
- [ ] **Step 2: Translate api/__init__.py** — Blueprint registration comment
- [ ] **Step 3: Translate api/graph.py** — Endpoint docstrings, error responses, log messages, comments
- [ ] **Step 4: Translate api/simulation.py** — All 487 occurrences: endpoint docstrings, error responses (ZEP_API_KEY, project validation, entity checks), status messages, comments. This is the largest API file — be thorough.
- [ ] **Step 5: Translate api/report.py** — Report endpoint docstrings, generation status messages, chat error responses
- [ ] **Step 6: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/app/api/`
Expected: No matches.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/
git commit -m "i18n: translate backend API layer to English"
```

---

## Task 7: Backend — Services (Small/Medium)

Service files with fewer than 200 Chinese occurrences.

**Files:**
- Modify: `backend/app/services/text_processor.py` (17 occurrences)
- Modify: `backend/app/services/simulation_ipc.py` (72 occurrences)
- Modify: `backend/app/services/simulation_manager.py` (91 occurrences)
- Modify: `backend/app/services/graph_builder.py` (79 occurrences)
- Modify: `backend/app/services/zep_entity_reader.py` (77 occurrences)
- Modify: `backend/app/services/zep_graph_memory_updater.py` (159 occurrences)

- [ ] **Step 1: Read all 6 files**
- [ ] **Step 2: Translate text_processor.py** — Text chunking comments and docstrings
- [ ] **Step 3: Translate simulation_ipc.py** — IPC protocol comments, command handling messages
- [ ] **Step 4: Translate simulation_manager.py** — State management docstrings, status messages, directory handling comments
- [ ] **Step 5: Translate graph_builder.py** — Zep graph construction comments, progress log messages
- [ ] **Step 6: Translate zep_entity_reader.py** — Entity filtering docstrings, type mapping comments
- [ ] **Step 7: Translate zep_graph_memory_updater.py** — Batch update comments, episode text formatting, flush logic
- [ ] **Step 8: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/app/services/text_processor.py backend/app/services/simulation_ipc.py backend/app/services/simulation_manager.py backend/app/services/graph_builder.py backend/app/services/zep_entity_reader.py backend/app/services/zep_graph_memory_updater.py`
Expected: No matches.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/text_processor.py backend/app/services/simulation_ipc.py backend/app/services/simulation_manager.py backend/app/services/graph_builder.py backend/app/services/zep_entity_reader.py backend/app/services/zep_graph_memory_updater.py
git commit -m "i18n: translate small/medium backend services to English"
```

---

## Task 8: Backend — Services (Large: ontology, profile, config generators)

Medium-large service files focused on LLM-powered generation. These contain critical LLM prompts.

**Files:**
- Modify: `backend/app/services/ontology_generator.py` (149 occurrences)
- Modify: `backend/app/services/oasis_profile_generator.py` (315 occurrences)
- Modify: `backend/app/services/simulation_config_generator.py` (255 occurrences)

**Special attention:** These files contain LLM system prompts and few-shot examples. Translation must preserve prompt engineering intent — the LLM output language depends on these prompts being in English.

- [ ] **Step 1: Read all 3 files**
- [ ] **Step 2: Translate ontology_generator.py** — Entity/relationship extraction prompts, output format instructions, docstrings
- [ ] **Step 3: Translate oasis_profile_generator.py** — Profile generation prompts, personality trait descriptions, behavior templates, Zep search context formatting
- [ ] **Step 4: Translate simulation_config_generator.py** — Config generation prompts, time/parameter reasoning instructions, JSON repair comments
- [ ] **Step 5: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/app/services/ontology_generator.py backend/app/services/oasis_profile_generator.py backend/app/services/simulation_config_generator.py`
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ontology_generator.py backend/app/services/oasis_profile_generator.py backend/app/services/simulation_config_generator.py
git commit -m "i18n: translate LLM generator services to English"
```

---

## Task 9: Backend — Services (Large: report_agent, zep_tools, simulation_runner)

The three largest service files. These are the heaviest translation targets.

**Files:**
- Modify: `backend/app/services/report_agent.py` (670 occurrences — largest file)
- Modify: `backend/app/services/zep_tools.py` (461 occurrences)
- Modify: `backend/app/services/simulation_runner.py` (348 occurrences)

**Special attention:** `report_agent.py` has the most Chinese text in the entire codebase — extensive LLM prompts, tool descriptions, logging, and output formatting. `zep_tools.py` formats search results into structured text for LLM consumption.

- [ ] **Step 1: Read report_agent.py**
- [ ] **Step 2: Translate report_agent.py** — Report generation prompts, outline planning prompts, chapter generation prompts, tool descriptions, reflection prompts, all log messages (670 occurrences)
- [ ] **Step 3: Read zep_tools.py**
- [ ] **Step 4: Translate zep_tools.py** — Search result formatting (to_text methods), query construction, insight analysis prompts, interview formatting, docstrings (461 occurrences)
- [ ] **Step 5: Read simulation_runner.py**
- [ ] **Step 6: Translate simulation_runner.py** — Process management comments, OASIS integration, action parsing, status reporting (348 occurrences)
- [ ] **Step 7: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/app/services/report_agent.py backend/app/services/zep_tools.py backend/app/services/simulation_runner.py`
Expected: No matches.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/report_agent.py backend/app/services/zep_tools.py backend/app/services/simulation_runner.py
git commit -m "i18n: translate large backend services to English"
```

---

## Task 10: Backend — Scripts

Standalone simulation driver scripts.

**Files:**
- Modify: `backend/scripts/action_logger.py` (34 occurrences)
- Modify: `backend/scripts/run_parallel_simulation.py` (306 occurrences — very large file)
- Modify: `backend/scripts/run_twitter_simulation.py` (152 occurrences)
- Modify: `backend/scripts/run_reddit_simulation.py` (130 occurrences)
- Modify: `backend/scripts/test_profile_format.py` (35 occurrences)

- [ ] **Step 1: Read all 5 files**
- [ ] **Step 2: Translate action_logger.py** — Log format strings, round markers, action descriptions
- [ ] **Step 3: Translate run_parallel_simulation.py** — Orchestration comments, status updates, command handling, interview logic, dual-platform coordination (306 occurrences)
- [ ] **Step 4: Translate run_twitter_simulation.py** — Twitter-specific simulation comments, round logging, agent action formatting
- [ ] **Step 5: Translate run_reddit_simulation.py** — Reddit-specific simulation comments, subreddit handling, comment threading
- [ ] **Step 6: Translate test_profile_format.py** — Test descriptions, assertion messages
- [ ] **Step 7: Verify no Chinese remains**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/scripts/`
Expected: No matches.

- [ ] **Step 8: Commit**

```bash
git add backend/scripts/
git commit -m "i18n: translate backend scripts to English"
```

---

## Task 11: Backend — Config Files

Translate dependency file comments.

**Files:**
- Modify: `backend/pyproject.toml` (7 occurrences)
- Modify: `backend/requirements.txt` (10 occurrences)

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Translate pyproject.toml** — Project description, dependency section comments. Translate all Chinese including the description field.
- [ ] **Step 3: Translate requirements.txt** — Section header comments
- [ ] **Step 4: Verify no Chinese remains in these files**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' backend/pyproject.toml backend/requirements.txt`
Expected: No matches.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/requirements.txt
git commit -m "i18n: translate config files to English"
```

---

## Task 12: Final Verification Sweep

**Prerequisite:** All tasks 1-11 must be complete before running this task.

This task verifies the entire codebase is Chinese-free and checks for syntax errors introduced during translation.

- [ ] **Step 1: Full-codebase Chinese text scan**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' frontend/ backend/app/ backend/scripts/ backend/run.py backend/pyproject.toml backend/requirements.txt`
Expected: No matches (zero Chinese characters remaining).

- [ ] **Step 2: Python syntax verification**

Run: `find backend -name '*.py' -exec python -m py_compile {} +`
Expected: No syntax errors. If any file fails to compile, fix the broken string/quote and re-verify.

- [ ] **Step 3: Frontend build check**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 || true; npm run build`
Expected: Build succeeds (warnings are acceptable, errors are not).

- [ ] **Step 4: Fix any issues found in Steps 1-3, then re-run all three checks until clean**

---

## Verification Summary

Each task (1-11) includes a per-task grep verification step. Task 12 runs after all others and performs:

1. **Full-codebase Chinese scan** — zero matches expected
2. **Python syntax check** — `python -m py_compile` on all .py files
3. **Frontend build check** — `npm run build` succeeds

The acceptance criteria is all three checks passing.
