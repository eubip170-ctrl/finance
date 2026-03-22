# MiroFish English Localization — Design Spec

## Problem

The entire MiroFish codebase is written with Chinese text — UI labels, code comments, docstrings, LLM prompts, log messages, error messages, and API responses. This makes the application unusable for English-speaking users and the codebase inaccessible to English-speaking developers.

## Goal

Replace all Chinese text with natural English equivalents across all 57 files (21 frontend, 36 backend). No i18n framework — straight replacement. The result is a fully English codebase.

## Scope

~5,700 Chinese text occurrences across 57 files:

| Category | % of total | Description |
|----------|-----------|-------------|
| Code comments | 34% | Developer-facing Python/JS comments |
| Docstrings | 19% | Function/class documentation |
| UI labels | 16% | Vue template text (buttons, headings, status, placeholders) |
| LLM prompts | 14% | System/user prompts, few-shot examples, output formatting |
| Error/log messages | 15% | API responses, logger calls, progress tracking |
| Variable names | 1% | Scattered constants |

## Files Affected

### Frontend (21 files)
- `frontend/index.html`
- `frontend/src/App.vue`
- `frontend/src/store/pendingUpload.js`
- `frontend/src/api/index.js`, `graph.js`, `simulation.js`, `report.js`
- `frontend/src/views/Home.vue`, `MainView.vue`, `Process.vue`, `SimulationView.vue`, `SimulationRunView.vue`, `ReportView.vue`, `InteractionView.vue`
- `frontend/src/components/Step1GraphBuild.vue`, `Step2EnvSetup.vue`, `Step3Simulation.vue`, `Step4Report.vue`, `Step5Interaction.vue`, `GraphPanel.vue`, `HistoryDatabase.vue`

### Backend (36 files)
- `backend/run.py`, `pyproject.toml`, `requirements.txt`
- `backend/app/__init__.py`, `config.py`
- `backend/app/models/__init__.py`, `project.py`, `task.py`
- `backend/app/api/__init__.py`, `graph.py`, `simulation.py`, `report.py`
- `backend/app/services/__init__.py`, `graph_builder.py`, `ontology_generator.py`, `text_processor.py`, `oasis_profile_generator.py`, `simulation_config_generator.py`, `simulation_manager.py`, `simulation_runner.py`, `simulation_ipc.py`, `report_agent.py`, `zep_tools.py`, `zep_entity_reader.py`, `zep_graph_memory_updater.py`
- `backend/app/utils/__init__.py`, `file_parser.py`, `llm_client.py`, `logger.py`, `retry.py`, `zep_paging.py`
- `backend/scripts/action_logger.py`, `run_parallel_simulation.py`, `run_twitter_simulation.py`, `run_reddit_simulation.py`, `test_profile_format.py`

## Translation Guidelines

- **UI text**: Natural, professional English. Use standard UI conventions (e.g., "Upload", "Submit", "Loading...", "Error").
- **Code comments**: Concise English. Match the intent, don't translate word-for-word. Remove comments that merely restate what the code does.
- **Docstrings**: Standard Python/JS documentation conventions.
- **LLM prompts**: Careful translation preserving prompt engineering intent. These are critical for output quality.
- **Log/error messages**: Clear, actionable English with context.
- **pyproject.toml / requirements.txt**: Translate section comments only.

## Constraints

- No new dependencies
- No structural/architectural changes
- No i18n framework
- Preserve all existing functionality — only text content changes
- UTF-8 encoding stays (some users may still upload Chinese documents)

## Verification

After all translations: `grep -rP '[\x{4e00}-\x{9fff}]' frontend/ backend/app/ backend/scripts/ backend/run.py` returns zero matches (excluding pyproject.toml description which may intentionally keep both languages).
