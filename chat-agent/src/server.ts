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
                "You are a helpful assistant. You can check the weather, run calculations, and schedule calendar events.\n" +
                "If the user wants to schedule an event, you MUST immediately call the getUserLocation tool to determine their timezone. Do not output raw JSON or explain your actions—just silently execute the tool.\n" +
                "If the getUserLocation tool returns an error saying 'denied location access', fallback and ask the user to manually type their city.\n" +
                "Once you possess the timezone, calculate the correct time and execute the createCalendarEvent tool.\n" +
                "CRITICAL INSTRUCTION: Once the createCalendarEvent tool is executed successfully and returns a Google Calendar link, you MUST ONLY output a final conversational text message confirming the booking. DO NOT call the createCalendarEvent tool a second time. DO NOT output identical tool calls sequentially. You may only execute createCalendarEvent ONCE per scheduling request.",
            messages: pruneMessages({
                messages: (await convertToModelMessages(this.messages)).filter((m, i, arr) => {
                    // Safe-clip orphaned tool calls to dynamically prevent `MissingToolResultsError` crashes
                    const hasToolCall = m.role === "assistant" && Array.isArray(m.content) && m.content.some((part: any) => part.type === "tool-call");
                    if (hasToolCall) {
                        const nextM = arr[i + 1];
                        // Keep the assistant message if it's the last message (waiting for result/approval)
                        // OR if the next message is the tool result. 
                        // Drop it if the next message is NOT a tool result (i.e., it's an orphaned call).
                        return !nextM || nextM.role === "tool";
                    }
                    return true;
                }),
                toolCalls: "before-last-2-messages",
            }),
            tools: {
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

                getUserLocation: tool({
                    description: "Get the user's physical geographic location and timezone. Prompts the user's browser for location permission.",
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
    async fetch(request: Request, env: any) {
        const url = new URL(request.url);

        if (url.pathname === "/api/auth/google" && request.method === "POST") {
            try {
                const { code, redirectUri } = await request.json<any>();
                
                const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        code,
                        client_id: env.VITE_GOOGLE_CLIENT_ID,
                        client_secret: env.VITE_GOOGLE_CLIENT_SECRET,
                        redirect_uri: redirectUri,
                        grant_type: "authorization_code"
                    })
                });
                
                const tokenData = await tokenRes.json<any>();
                if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
                
                const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                });
                const user = await userRes.json<any>();
                
                const sessionPayload = JSON.stringify({ token: tokenData.access_token, user });
                const base64Session = btoa(encodeURIComponent(sessionPayload));
                
                const cookie = `auth_session=${base64Session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`;
                
                return new Response(JSON.stringify({ success: true, user }), {
                    headers: { 
                        "Content-Type": "application/json",
                        "Set-Cookie": cookie
                    }
                });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), { status: 400 });
            }
        }
        
        if (url.pathname === "/api/auth/me" && request.method === "GET") {
            const cookieHeader = request.headers.get("Cookie") || "";
            const match = cookieHeader.match(/auth_session=([^;]+)/);
            if (match) {
                try {
                    const session = JSON.parse(decodeURIComponent(atob(match[1])));
                    return new Response(JSON.stringify({ user: session.user, token: session.token }), {
                        headers: { "Content-Type": "application/json" }
                    });
                } catch(e) {}
            }
            return new Response(JSON.stringify({ user: null }), { status: 401 });
        }

        if (url.pathname === "/api/auth/logout" && request.method === "POST") {
            return new Response(JSON.stringify({ success: true }), {
                headers: { 
                    "Content-Type": "application/json",
                    "Set-Cookie": "auth_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
                }
            });
        }

        return (
            (await routeAgentRequest(request, env)) ||
            new Response("Not found", { status: 404 })
        );
    },
} satisfies ExportedHandler<Env>;