# calendAI

<img width="1215" height="710" alt="image" src="https://github.com/user-attachments/assets/1a016c38-d387-4c8b-ab47-04d6f4f504bc" />

## 🚀 Overview

CalendAI is a context-aware scheduling agent. By combining browser-based location intelligence with robust server-side state persistence, it handles complex scheduling requests like "What's on my plate today?" or "Reschedule my 3 PM meeting to tomorrow" with ease.

### Key Features
calendAI is able to create, edit and delete events based on the user's prompt and the users google calendar data, each user has its own chat history which persist between sessions

### 1. Identity-Aware Durable Objects
The application implements an identity-first architecture using **Google OAuth2** as the primary authentication layer.
- **Unique Account Pinning**: Every user session is anchored to a unique **Durable Object** instance, keyed by the user's verified Google email. This ensures strict data isolation and provides a persistent execution context for each individual user.
- **Stateful Token Management**: Google access tokens are exchanged on the backend and persisted directly within the agent's **SQLite-backed state**. This allows the assistant to maintain API access across multiple sessions and device reconnections without re-authentication.

### 2. Temporal & Geospatial Grounding
LLMs are notoriously bad at knowing what "tomorrow" means without help. CalendAI solves this by:
1. Triggering a **client-side location tool** on handshake.
2. Capturing the user's browser timezone and local date.
3. Injecting this **Live Context** into the system prompt.
This ensures the agent always knows exactly which UTC timestamp corresponds to "2 PM next Friday" for the user.

### 3. Human-in-the-Loop (HITL) Validation
Instead of blindly executing calendar changes, the agent uses a **two-stage verification**:
- **Stage 1 (Inference)**: The agent proposes a tool call (e.g., `createCalendarEvent`).
- **Stage 2 (Verification)**: The Durable Object holds the execution and sends an `approval-requested` signal to the UI.
- **Stage 3 (Manual Override)**: You can edit the parameters on the fly in the UI. The updated data is synced back to the DO, which then executes the final API call with the corrected values.

## 🛠️ Fulfilling Technical Requirements

This project is built from the ground up to demonstrate the power of the Cloudflare AI stack, meeting all assignment criteria through specific architectural choices:

### 1. LLM (Inference)
- **Model**: Uses **Llama 4 Scout** (`llama-4-scout-17b-16e-instruct`) via the `AI` binding.
- **Implementation**: Leverages Workers AI for high-throughput, low-latency inference. The agent is configured with a strict system prompt to enforce tool-calling standards and prevent raw JSON leakage.

### 2. Workflow & Coordination
- **Primitive**: **Durable Objects (`ChatAgent`)**.
- **Role**: Unlike a stateless Worker, the Durable Object acts as the "brain" of the operation. It coordinates the multi-step reasoning loop, ensuring that tool results from the Google API are correctly cleaned and paired with assistant messages before the next inference step.

### 3. User Input (Realtime)
- **Interface**: Built with **React** and **`@cloudflare/ai-chat`**.
- **Connectivity**: Real-time communication is handled via WebSockets, linking the browser directly to the `ChatAgent` Durable Object. This allows for immediate UI updates, such as showing "Thinking..." states and rendering interactive cards as soon as a tool call is initiated.

### 4. Memory & State
- **Persistence**: **SQLite in Durable Objects**.
- **Usage**: The agent maintains a "living" state that survives Worker cold starts. This includes:
  - **Thread Memory**: Full chat history persists in SQLite.
  - **Agent State**: OAuth tokens, user profiles, and location context are stored in the DO's persistent storage.
  - **Protocol States**: Tracks pending vs. approved HITL actions to prevent race conditions or redundant API calls.


---

---

## 🛠️ API & Tool Breakdown

| Tool | Action | Logic |
| :--- | :--- | :--- |
| `listCalendarEvents` | **GET** | Fetches `primary` calendar events using `timeMin` and `timeMax` derived from local context. |
| `createCalendarEvent` | **POST** | HITL-enabled. Supports descriptions, start/end ISO strings, and manual frontend overrides. |
| `deleteCalendarEvent` | **DELETE** | Requires explicit confirmation; passes a display summary to the confirmation card. |
| `getUserLocation` | **Browser API** | Client-side tool that feeds the current local date/time + offset into the Durable Object state. |

---

## How to Run it

### 1. Google API Setup
You need a Google Cloud project with the **Google Calendar API** enabled.
- **Redirect URI**: `http://localhost:5173` (or your production URL).
- **Environment**: Add `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_SECRET` to your `.env` in `chat-agent/`.

### 2. Install & Dev
```bash
cd chat-agent
bun install

# Start the Agent (Worker + DO)
bun run dev

# Start the UI (Vite)
bun run frontend
```

### 3. Deploy
```bash
bun run deploy
```
