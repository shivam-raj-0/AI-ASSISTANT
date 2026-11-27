# SmartMate AI – Your Context-Aware Personal Assistant

## 1. Project Name
**SmartMate AI – Your Context-Aware Personal Assistant**

---

## 2. Project Overview
SmartMate AI is a full-stack, context-aware intelligent personal assistant designed to go beyond basic conversational chatbots. Instead of generating generic replies, it runs every user message through a structured **6-stage decision pipeline** that detects intent, analyzes active tasks and user constraints, resolves competing priorities, executes real task operations, and explains *why* every recommendation is appropriate.

The application works seamlessly **with or without an external LLM API key**:
- When a supported API key (`GEMINI_API_KEY` or `OPENAI_API_KEY`) is configured on the secure backend, SmartMate AI uses the LLM for natural, grounded language generation while enforcing deterministic decision rules.
- When no API key is configured (or if an upstream AI provider is unavailable), SmartMate AI automatically runs its transparent **rule-based fallback decision engine**, clearly labeling every response with its active engine mode (`llm` vs. `fallback`).

---

## 3. Problem Statement
Modern productivity tools suffer from two opposite extremes:
1. **Static to-do lists** store tasks passively without understanding urgency, available time, user energy, or conflicting deadlines.
2. **Generic AI chatbots** produce verbose advice without persistent state, real task actions, conflict detection, or clear reasoning—and often fail completely when API keys are missing or rate-limited.

Users need a reliable, privacy-conscious assistant that bridges conversation, structured decision logic, and actionable task execution in one lightweight workspace.

---

## 4. Chosen Challenge Vertical and Persona
> **Note on Vertical Alignment:** Because the organizer's exact vertical list was not provided in the prompt, this submission is framed as a **proposed general-purpose personal productivity and decision-support assistant** until its alignment with an official challenge vertical is verified.

- **Target Persona:** Busy students, engineers, knowledge workers, and founders juggling competing deadlines, fluctuating energy levels, and limited daily time blocks who need clear triage decisions rather than passive task lists.

---

## 5. Proposed Solution
SmartMate AI combines a modern React + Tailwind workspace with an Express + SQLite backend powered by a deterministic, explainable decision engine:
- Converts natural-language requests into real task operations (`create`, `complete`, `update`, `delete`) or prioritization/conflict-resolution plans.
- Scores every active task using priority weights, deadline proximity, in-progress momentum, user energy, focus mode, and available time budget.
- Surfaces conflicting constraints (e.g., time-budget overload, deadline collisions, energy-vs-urgency mismatches) and proposes concrete trade-off plans.
- Protects sensitive user data via **PrivacyGuard**, which redacts API keys, bearer tokens, passwords, SSNs, and Luhn-valid payment card numbers *before* storing conversation memory or calling external LLMs.

---

## 6. Key Features
1. **Intelligent Chat Interface**: Natural-language conversation with intent detection, context retention across turns, clarification questions for ambiguous requests, and expandable **"Why this decision"** reasoning cards.
2. **Context-Aware Decision Engine**: Structured 6-stage pipeline that identifies needs, detects conflicts, handles missing info without guessing, and explains recommendations clearly.
3. **Smart Task Management**: Full CRUD (`pending`, `in_progress`, `completed`), priority levels (`urgent`, `high`, `medium`, `low`), categories (`Work`, `Personal`, `Health`, `Learning`, `Finance`, `Errands`), duration estimates, and auto-suggested concrete next actions.
4. **Intelligent Recommendation System**: Ranked task recommendations tuned to urgency, importance, focus mode (`balanced`, `deep_work`, `quick_wins`), energy level (`high`, `medium`, `low`), and time budget—with 1-click **Start** and **Complete** actions.
5. **Conversation Memory & Privacy Controls**: Persistent session history in SQLite, ability to inspect and clear conversation memory, and automatic redaction of sensitive credentials before persistence.
6. **Smart Dashboard**: Real-time overview of active vs. completed tasks, completion rate, workload vs. time budget, urgency alerts, conflict banners, category progress, and activity log.
7. **Resilient Error Handling**: Input validation, graceful fallback when LLM APIs are unavailable, loading/empty states, and non-leaking error responses.

---

## 7. Technology Stack
- **Frontend:** React 18, Vite 6, Tailwind CSS, Lucide Icons
- **Backend:** Node.js (`>=22.5.0`, verified on `v26.13.0`), Express 4
- **Database:** Built-in SQLite via Node's native `node:sqlite` (`DatabaseSync`) — zero native C++ compilation dependencies
- **AI Integration:** Native `fetch` REST integration for Google Gemini (`gemini-2.5-flash`) or OpenAI-compatible APIs, paired with a deterministic rule-based fallback engine
- **Security:** `helmet`, `cors`, `express-rate-limit`, `dotenv`, `PrivacyGuard` redaction, input sanitization

---

## 8. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite + Tailwind)             │
│  ChatView │ SmartDashboard │ TasksView │ Recommendations │ Context │
│                      (Light / Dark Mode, Responsive)               │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │ HTTPS / JSON (/api/*)
┌─────────────────────────────────▼──────────────────────────────────┐
│                 Backend API (Node.js + Express)                    │
│  Security Layer: Helmet CSP, CORS, Rate Limiting, Input Sanitizer  │
├────────────────────────────────────────────────────────────────────┤
│                   6-Stage AI Decision Pipeline                     │
│  1. PrivacyGuard (redact secrets/PII before storage)               │
│  2. Intent Detector (classify intent, entities, prompt constraints)│
│  3. Context Analyzer (tasks, profile, memory, conflicts, ambiguity)│
│  4. Decision Engine (deterministic scoring, trade-offs, actions)   │
│  5. Action Executor (atomic SQLite task mutations when authorized) │
│  6. Response Generator (LLM grounded in decision OR Rule Fallback) │
├────────────────────────────────────────────────────────────────────┤
│                SQLite Persistence (node:sqlite)                    │
│       tasks  │  messages  │  user_context  │  activity_logs        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 9. Decision-Making Logic
Every chat turn executes the deterministic pipeline in `backend/src/engine/`:

1. **Intent Detection (`intentDetector.js`)**:
   - Classifies queries into `create_task`, `complete_task`, `update_task`, `delete_task`, `prioritize_recommend`, `resolve_conflict`, `summarize_status`, `ambiguous_request`, or `general_guidance`.
   - Extracts entities (`title`, `priority`, `category`, `due_date`, `estimated_minutes`, `taskQuery`) and transient situational constraints (e.g., `"I only have 30 minutes"`, `"low energy"`).
   - Tracks follow-up turns when the previous assistant message requested clarification.
2. **Context Analysis (`contextAnalyzer.js`)**:
   - Combines active/overdue/due-soon tasks, stored user preferences, and recent conversation turns.
   - Detects conflicts:
     - **Time Budget Overload**: Urgent/high tasks exceed available minutes.
     - **Deadline Collision**: Multiple active tasks overdue or due within 24 hours.
     - **Energy vs. Urgency**: Heavy urgent tasks conflict with low energy or `quick_wins` focus mode.
     - **Priority Inflation**: High-priority queue saturation.
   - Flags ambiguous inputs or ambiguous task matches for clarification instead of guessing.
3. **Deterministic Scoring (`decisionEngine.js`)**:
   - `Base Priority`: urgent `+45`, high `+32`, medium `+18`, low `+8`
   - `Deadline Proximity`: overdue `+35`, <=12h `+28`, <=24h `+20`, <=72h `+10`
   - `Momentum`: `in_progress` `+12`
   - `Context Fit`: quick-win/low-energy bonus (`+15` for <=30m, `-10` for >=60m), deep-work bonus (`+12` for >=45m), time-budget fit (`+10` / `-15`), preferred category (`+8`)
4. **Transparent Response Generation (`responseGenerator.js`)**:
   - **LLM Mode (`mode: "llm"`)**: Sends only the sanitized prompt and structured decision JSON to Gemini or OpenAI so the LLM never hallucinates task IDs or dates.
   - **Fallback Mode (`mode: "fallback"`)**: Automatically triggers if no key is set or if the upstream API fails, clearly indicating `Rule-Based Fallback` in both the API payload and UI badge.

---

## 10. Installation Instructions

### Prerequisites
- **Node.js `>=22.5.0`** (uses built-in `node:sqlite`)
- **npm**

### Install Dependencies
From the repository root:
```bash
npm run install:all
```
Or install separately:
```bash
npm --prefix backend install
npm --prefix frontend install
```

---

## 11. Environment Setup
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*
2. Configure `.env` as needed:
   - **No API Key (Fallback Mode):** Leave `GEMINI_API_KEY` and `OPENAI_API_KEY` blank. SmartMate AI will run in full rule-based fallback mode.
   - **With Google Gemini:** Set `AI_PROVIDER=gemini` and add your `GEMINI_API_KEY`.
   - **With OpenAI-Compatible API:** Set `AI_PROVIDER=openai` and add `OPENAI_API_KEY`.

> **Security:** Never commit `.env` or place API keys in `frontend/` files. All AI requests run strictly from the backend.

---

## 12. How to Run Frontend and Backend

### Option A: Run Both Together (Development)
From the repository root:
```bash
npm run dev
```
- Backend runs on `http://localhost:4000`
- Frontend runs on `http://localhost:5173` (with Vite `/api` proxy to port `4000`)

### Option B: Run Separately
Terminal 1 (Backend):
```bash
npm run dev:backend
```
Terminal 2 (Frontend):
```bash
npm run dev:frontend
```

### Production Frontend Build
```bash
npm run build
```

---

## 13. Testing Instructions
Run the automated backend unit & integration test suite (Node's built-in test runner):
```bash
npm test
```
This tests:
- `privacy.test.js`: Redaction of API keys, bearer tokens, passwords, and SSNs while preserving normal task inputs.
- `engine.test.js`: Intent detection, conflict detection, multi-turn clarification memory, and graceful fallback when upstream LLM calls fail.
- `api.test.js`: Security headers, task CRUD + validation errors, chat execution + memory clearing, context preference updates, recommendations, and dashboard aggregation.

---

## 14. Security Considerations
- **Zero Frontend Secrets:** API keys live strictly in server-side environment variables and are never returned by `/api/health` or `/api/dashboard`.
- **PrivacyGuard Redaction:** Sensitive tokens, credentials, SSNs, and Luhn-validated card numbers are scrubbed before saving to SQLite or sending to external LLMs.
- **HTTP Hardening:** `helmet` sets strict Content-Security-Policy and `X-Content-Type-Options: nosniff`; `x-powered-by` is disabled.
- **CORS & Rate Limiting:** Origin-checked CORS and sliding-window rate limiters (`120` req/15m on `/api`, `40` req/15m on `/api/chat`).
- **Input Validation & Safe Rendering:** All payloads are length-bounded, sanitized for control characters, validated by type/enum, and rendered in React without `dangerouslySetInnerHTML`.

---

## 15. Assumptions and Limitations
- **Single-Workspace / Local SQLite Persistence:** Designed as a lightweight single-user personal assistant without multi-tenant authentication or OAuth login.
- **Rule-Based Natural Language Parsing:** In fallback mode, task extraction relies on structured pattern matching; complex multi-clause sentences may prompt a clarification question.
- **Node.js Version:** Relies on Node.js built-in `node:sqlite` (`>=22.5.0`) to eliminate native binary compilation issues and keep repository dependencies minimal.

---

## 16. Future Improvements
- Multi-user authentication with JWT/session isolation.
- Calendar integration (ICS/Google Calendar) for real-time free/busy slot awareness.
- Recurring tasks and automated daily briefing notifications.
- End-to-end Playwright browser tests and streaming token responses for LLM mode.
