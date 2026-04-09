import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import {
    streamText,
    convertToModelMessages,
    pruneMessages,
    tool,
    stepCountIs,
} from "ai";
import { z } from "zod";

export class ChatAgent extends AIChatAgent {
    // React to state changes from the client to demonstrate Cloudflare Agents state synchronization
    onStateChanged(state: any, source: import("agents").Connection | "server") {
        if (source !== "server" && state.userData) {
            console.log(`Agent State Synchronized via SQLite: User ${state.userData.email} logged in. Token available: ${!!state.googleToken}`);
        }
    }

    async onChatMessage() {
        const workersai = createWorkersAI({ binding: this.env.AI });

        const result = streamText({
            model: workersai("@cf/meta/llama-4-scout-17b-16e-instruct"),
            system:
                "You are a helpful assistant. You can check the weather, " +
                "get the user's timezone, run calculations, and schedule calendar events. " +
                "When asked to schedule an event or meeting, use the createCalendarEvent tool.",
            messages: pruneMessages({
                messages: await convertToModelMessages(this.messages),
                toolCalls: "before-last-2-messages",
            }),
            tools: {
                // Server-side tool: runs automatically on the server
                getWeather: tool({
                    description: "Get the current weather for a city",
                    inputSchema: z.object({
                        city: z.string().describe("City name"),
                    }),
                    execute: async ({ city }) => {
                        // Replace with a real weather API in production
                        const conditions = ["sunny", "cloudy", "rainy"];
                        const temp = Math.floor(Math.random() * 30) + 5;
                        return {
                            city,
                            temperature: temp,
                            condition:
                                conditions[Math.floor(Math.random() * conditions.length)],
                        };
                    },
                }),

                // Client-side tool: no execute function — the browser handles it
                getUserTimezone: tool({
                    description: "Get the user's timezone from their browser",
                    inputSchema: z.object({}),
                }),

                // Approval tool: requires user confirmation before executing
                calculate: tool({
                    description:
                        "Perform a math calculation with two numbers. " +
                        "Requires user approval for large numbers.",
                    inputSchema: z.object({
                        a: z.number().describe("First number"),
                        b: z.number().describe("Second number"),
                        operator: z
                            .enum(["+", "-", "*", "/", "%"])
                            .describe("Arithmetic operator"),
                    }),
                    needsApproval: async ({ a, b }) =>
                        Math.abs(a) > 1000 || Math.abs(b) > 1000,
                    execute: async ({ a, b, operator }) => {
                        const ops: Record<string, (x: number, y: number) => number> = {
                            "+": (x, y) => x + y,
                            "-": (x, y) => x - y,
                            "*": (x, y) => x * y,
                            "/": (x, y) => x / y,
                            "%": (x, y) => x % y,
                        };
                        if (operator === "/" && b === 0) {
                            return { error: "Division by zero" };
                        }
                        return {
                            expression: `${a} ${operator} ${b}`,
                            result: ops[operator](a, b),
                        };
                    },
                }),

                // HitL Approval tool: Requires user confirmation to schedule on their actual Google Calendar
                createCalendarEvent: tool({
                    description: "Schedule a new event on the user's Google Calendar. ALWAYS triggers a user confirmation prompt.",
                    inputSchema: z.object({
                        summary: z.string().describe("The title or name of the event"),
                        description: z.string().optional().describe("Description for the event"),
                        startTime: z.string().describe("ISO 8601 string format of the start time (e.g. 2026-04-10T10:00:00Z)"),
                        endTime: z.string().describe("ISO 8601 string format of the end time"),
                    }),
                    // The magic boolean triggering the HITL flow in @cloudflare/ai-chat
                    needsApproval: async () => true,
                    execute: async ({ summary, description, startTime, endTime }) => {
                        // Access the state persisted previously when the user logged in
                        const token = (this.state as any)?.googleToken;
                        
                        if (!token) {
                            return { error: "Authentication missing. User is not logged in or missing token." };
                        }

                        // Making the actual call to Google Calendar API using the persisted token
                        const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                summary,
                                description,
                                start: { dateTime: startTime },
                                end: { dateTime: endTime }
                            })
                        });

                        if (!response.ok) {
                            const errLog = await response.text();
                            return { error: "Google Calendar API rejected the request.", details: errLog };
                        }

                        const eventData = await response.json() as any;
                        return { 
                            success: true, 
                            message: "Event confirmed and successfully created!",
                            link: eventData.htmlLink 
                        };
                    }
                }),
            },
            stopWhen: stepCountIs(5),
        });

        return result.toUIMessageStreamResponse();
    }
}

export default {
    async fetch(request: Request, env: Env) {
        return (
            (await routeAgentRequest(request, env)) ||
            new Response("Not found", { status: 404 })
        );
    },
} satisfies ExportedHandler<Env>;