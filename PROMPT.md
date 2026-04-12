# Pormpt List

Prompts were mainly used to refine the system prompt given to the AI Model and bug fixes these included

- "Fix these `AI_TypeValidationError` crashes build a manual message sanitization pipeline that forces strict types and strips non-essential metadata, make sure assistant messages are always paired with results"
- "Im getting crashed by `MissingToolResultsError` again i need a strict message-pruning protocol that makes sure every tool call is paired with a result before it's sent to the LLM"
- "The agent is hallucinating dates because it doesn't know where I am refine the scheduling logic so that it calls the 'location-first' tools first before producing the card"

