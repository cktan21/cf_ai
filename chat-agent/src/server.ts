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
                "STRICT PROTOCOL: You are a high-performance scheduling assistant. \n" +
                "- If you need location or timezone data, call getUserLocation IMMEDIATELY. \n" +
                "- NEVER explain your internal steps (do not say 'Step 1', 'Calculating...', etc). \n" +
                "- NEVER output raw JSON. Your output must ONLY consist of Tool Calls until the task is ready for confirmation.\n" +
                "- When scheduling, use the timezone offset provided by the tool (e.g., +02:00). If the user says 12pm tomorrow in Paris (+02:00) and today is 2026-04-10, use '2026-04-11T12:00:00+02:00' for the ISO string.\n" +
                "- For 'today's events', always search the FULL day range (00:00 to 23:59) using the 'userLocalDate' provided by getUserLocation.\n" +
                "- Once createCalendarEvent or deleteCalendarEvent is successful, provide a brief confirmation and STOP. \n" +
                "- NEVER re-run listCalendarEvents or getUserLocation automatically after a successful action.\n" +
                "- FINAL RESULT ONLY: Once the task is complete, stop with a final short sentence.",
            messages: pruneMessages({
                messages: await convertToModelMessages(this.messages),
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

                // Tool to find events so the AI knows what IDs to delete
                listCalendarEvents: tool({
                    description: "Retrieve a list of events from the user's Google Calendar for a specific time range. Important: When asked for 'today's events', use the userLocalDate to fetch the FULL range from 00:00:00 to 23:59:59 in the user's local offset.",
                    inputSchema: z.object({
                        timeMin: z.string().describe("ISO 8601 start time including offset (e.g. 2026-04-10T00:00:00+02:00)"),
                        timeMax: z.string().describe("ISO 8601 end time including offset (e.g. 2026-04-10T23:59:59+02:00)"),
                    }),
                    execute: async ({ timeMin, timeMax }) => {
                        const token = (this.state as any)?.googleToken;
                        if (!token) return { error: "Not logged in" };

                        const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
                        url.searchParams.set("timeMin", timeMin);
                        url.searchParams.set("timeMax", timeMax);
                        url.searchParams.set("singleEvents", "true");
                        url.searchParams.set("orderBy", "startTime");

                        const response = await fetch(url.toString(), {
                            headers: { "Authorization": `Bearer ${token}` }
                        });

                        if (!response.ok) {
                            const errText = await response.text();
                            return { error: `Google API Error (${response.status})`, details: errText };
                        }

                        const data = await response.json() as any;
                        const items = data.items || [];
                        
                        return {
                            events: items.map((item: any) => ({
                                id: item.id,
                                summary: item.summary || "(No Title)",
                                start: item.start?.dateTime || item.start?.date,
                                end: item.end?.dateTime || item.end?.date,
                            })),
                            debug: {
                                url: url.toString(),
                                timeMin,
                                timeMax,
                                eventCount: items.length
                            }
                        };
                    }
                }),

                // HITL Deletion Tool
                deleteCalendarEvent: tool({
                    description: "Delete a specific event from the user's Google Calendar. ALWAYS triggers a user confirmation prompt.",
                    inputSchema: z.object({
                        eventId: z.string().describe("The unique ID of the event to delete"),
                        summary: z.string().describe("The title of the event (for display in the confirmation UI)"),
                    }),
                    needsApproval: async () => true,
                    execute: async ({ eventId }) => {
                        const token = (this.state as any)?.googleToken;
                        if (!token) return { error: "Not logged in" };

                        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
                            method: "DELETE",
                            headers: { "Authorization": `Bearer ${token}` }
                        });

                        if (!response.ok) {
                            return { error: "Failed to delete the event", details: await response.text() };
                        }

                        return { success: true, message: "Event successfully deleted." };
                    }
                }),

                // HitL Approval tool: Requires user confirmation to schedule on their actual Google Calendar
                createCalendarEvent: tool({
                    description: "Schedule a new event on the user's Google Calendar. ALWAYS triggers a user confirmation prompt.",
                    inputSchema: z.object({
                        summary: z.string().describe("The title or name of the event"),
                        description: z.string().optional().describe("Description for the event"),
                        startTime: z.string().describe("ISO 8601 string format of the start time (MUST include year-month-day, e.g. 2026-04-10T10:00:00+02:00)"),
                        endTime: z.string().describe("ISO 8601 string format of the end time"),
                    }),
                    // The magic boolean triggering the HITL flow in @cloudflare/ai-chat
                    needsApproval: async () => true,
                    execute: async (args, { toolCallId }) => {
                        // Check if the user manually edited these inputs on the frontend
                        const state = (this.state as any);
                        let finalArgs = args;
                        if (state?.editedInputs && state.editedInputs[toolCallId]) {
                            console.log(`Executing tool ${toolCallId} with manual overrides from state`);
                            finalArgs = state.editedInputs[toolCallId];
                            // Optional: clean up the override after use
                            delete state.editedInputs[toolCallId];
                            await this.setState(state);
                        }

                        const { summary, description, startTime, endTime } = finalArgs;
                        // Access the state persisted previously when the user logged in
                        const token = state?.googleToken;

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
                } catch (e) { }
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