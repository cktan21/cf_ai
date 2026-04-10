import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useState, useEffect } from "react";

// Access the environment variable using Vite's import.meta.env system
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function BookingConfirmationCard({ part, msg, addToolApprovalResponse, sendMessage }: any) {
    const eventData = part.input;
    const [isEditing, setIsEditing] = useState(false);
    
    // Parses the AI's ISO string so the native HTML `<input type="datetime-local">` can read it cleanly
    const formatForInput = (isoString?: string) => {
        if (!isoString) return "";
        const d = new Date(isoString);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const [summary, setSummary] = useState(eventData.summary || "");
    const [description, setDescription] = useState(eventData.description || "");
    const [startTime, setStartTime] = useState(() => formatForInput(eventData.startTime));
    const [endTime, setEndTime] = useState(() => formatForInput(eventData.endTime));

    const handleAction = (approved: boolean) => {
        msg.parts.forEach((p: any) => {
            if (p.type.startsWith("tool-") && p.state === "approval-requested" && p.toolName === part.toolName) {
                addToolApprovalResponse({ id: p.approval.id, approved: p.toolCallId === part.toolCallId ? approved : false });
            }
        });
    };

    const handleSaveAndRun = () => {
        const payload = {
            summary,
            description,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString()
        };
        sendMessage({ text: `Actually, the user edited the exact event details manually on their interface. Please immediately run createCalendarEvent exactly ONCE with EXACTLY these JSON inputs. Do not output multiple tools:\n${JSON.stringify(payload, null, 2)}` });
    };

    return (
        <div style={{ marginTop: "15px", padding: "20px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#ffffff", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>📅</span>
                    <h3 style={{ margin: 0, color: "#1e293b", fontSize: "16px" }}>Booking Confirmation</h3>
                </div>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} style={{ background: "transparent", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}>✏️ Edit</button>
                )}
            </div>
            
            <div style={{ marginBottom: "20px" }}>
                {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "4px", fontWeight: "bold", textTransform: "uppercase" }}>Event Title</label>
                            <input value={summary} onChange={e => setSummary(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", outline: "none", fontFamily: "inherit" }} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "4px", fontWeight: "bold", textTransform: "uppercase" }}>Description (Optional)</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add any extra notes here..." style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", minHeight: "60px", resize: "vertical", outline: "none", fontFamily: "inherit" }} />
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "4px", fontWeight: "bold", textTransform: "uppercase" }}>Start Time</label>
                                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", outline: "none", fontFamily: "inherit", color: "#1e293b" }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "4px", fontWeight: "bold", textTransform: "uppercase" }}>End Time</label>
                                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", outline: "none", fontFamily: "inherit", color: "#1e293b" }} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", marginBottom: "4px" }}>{eventData.summary}</div>
                        {eventData.description ? <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>{eventData.description}</div> : <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "12px", fontStyle: "italic" }}>No description provided</div>}
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
                            <div><strong>Start:</strong> {new Date(eventData.startTime).toLocaleString()}</div>
                            <div><strong>End:</strong> {new Date(eventData.endTime).toLocaleString()}</div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                {isEditing ? (
                    <>
                        <button onClick={() => setIsEditing(false)} style={{ padding: "8px 16px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                        <button onClick={handleSaveAndRun} style={{ flex: 1, padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "background 0.2s" }}>Save Changes</button>
                    </>
                ) : (
                    <>
                        <button onClick={() => handleAction(true)} style={{ flex: 1, padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "background 0.2s" }}>Approve & Book</button>
                        <button onClick={() => handleAction(false)} style={{ padding: "8px 16px", background: "#fff", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Cancel Event</button>
                    </>
                )}
            </div>
        </div>
    );
}

function Chat({ user, token }: { user: any; token: string }) {
    // Unique agent for each user based on their email
    const agent = useAgent({ agent: "ChatAgent", name: user.email });

    // Store user data in Agent state, demonstrating persistence based on user data
    useEffect(() => {
        if (agent) {
            agent.setState({
                ...(agent.state || {}),
                userData: user,
                googleToken: token,
            });
        }
    }, [agent, user, token]);

    const { messages, sendMessage, clearHistory, addToolApprovalResponse, status } =
        useAgentChat({
            agent,
            // Handle client-side tools (tools with no server execute function)
            onToolCall: async ({ toolCall, addToolOutput }) => {
                if (toolCall.toolName === "getUserLocation") {
                    if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                addToolOutput({
                                    toolCallId: toolCall.toolCallId,
                                    output: {
                                        latitude: position.coords.latitude,
                                        longitude: position.coords.longitude,
                                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                        timezoneOffset: (() => {
                                            const offset = -new Date().getTimezoneOffset();
                                            const sign = offset >= 0 ? "+" : "-";
                                            const hh = Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0");
                                            const mm = (Math.abs(offset) % 60).toString().padStart(2, "0");
                                            return `${sign}${hh}:${mm}`;
                                        })(),
                                        localTime: new Date().toLocaleTimeString(),
                                        currentDate: new Date().toISOString(),
                                    },
                                });
                            },
                            (error) => {
                                addToolOutput({
                                    toolCallId: toolCall.toolCallId,
                                    output: {
                                        error: `User denied location access or an error occurred: ${error.message}`
                                    },
                                });
                            }
                        );
                    } else {
                        addToolOutput({
                            toolCallId: toolCall.toolCallId,
                            output: { error: "Geolocation is not supported by this browser." }
                        });
                    }
                }
            },
        });

    return (
        <div style={{ fontFamily: "Inter, sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "10px", background: "#f3f4f6", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {user.picture && <img src={user.picture} alt="Profile" style={{ width: "40px", borderRadius: "50%" }} />}
                    <div>
                        <h3 style={{ margin: 0 }}>{user.name}</h3>
                        <div style={{ fontSize: "12px", color: "gray" }}>Logged in with Google</div>
                    </div>
                </div>
                <button 
                    onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.hash = ""; window.location.reload(); }} 
                    style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                    Sign Out
                </button>
            </div>
            
            <div style={{ background: "#e0f2fe", padding: "10px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", border: "1px solid #bae6fd" }}>
                <strong>Agent State Persistence:</strong> Your Google user data and calendar auth token are securely synced with cloudflare workers' state. Check <code>server.ts</code> to see this in action!
            </div>

            <style>
                {`
                @keyframes typing-pulse {
                    0%, 100% { opacity: 0.4; transform: translateY(0px) scale(0.8); }
                    50% { opacity: 1; transform: translateY(-2px) scale(1.2); }
                }
                .typing-dot {
                    width: 6px;
                    height: 6px;
                    background-color: #9ca3af;
                    border-radius: 50%;
                    display: inline-block;
                    animation: typing-pulse 1.4s infinite ease-in-out;
                }
                `}
            </style>
            <div style={{ minHeight: "400px", border: "1px solid #ccc", borderRadius: "8px", padding: "20px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", background: "#fafafa" }}>
                {messages.length === 0 && <div style={{ color: "gray", textAlign: "center", marginTop: "100px" }}>No messages yet. Start chatting!</div>}
                {messages.map((msg) => (
                    <div key={msg.id} style={{ background: msg.role === "user" ? "#dcf8c6" : "#fff", padding: "10px", borderRadius: "8px", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
                        <strong>{msg.role}:</strong>
                        <div style={{ marginTop: "5px" }}>
                            {msg.parts.map((part, i) => {
                                if (part.type === "text") {
                                    return <span key={i}>{part.text}</span>;
                                }

                                if (part.type === "step-start") return null;

                                if (part.type.startsWith("tool-")) {
                                    if (part.state === "approval-requested") {
                                        const isLatestMessage = msg.id === messages[messages.length - 1].id;
                                        if (!isLatestMessage) {
                                            return <div key={part.toolCallId} style={{ marginTop: "10px", padding: "5px", color: "gray", fontSize: "12px", background: "#f3f4f6", borderRadius: "4px" }}>⚠️ Abandoned tool request</div>;
                                        }

                                        const firstApprovalIndex = msg.parts.findIndex((p: any) => p.type.startsWith("tool-") && p.state === "approval-requested" && p.toolName === part.toolName);
                                        if (i !== firstApprovalIndex) {
                                            return null; 
                                        }

                                        if (part.toolName === "createCalendarEvent" || (part.input && (part.input as any).summary && (part.input as any).startTime)) {
                                            return <BookingConfirmationCard key={part.toolCallId} part={part} msg={msg} addToolApprovalResponse={addToolApprovalResponse} sendMessage={sendMessage} />;
                                        }

                                        return (
                                            <div key={part.toolCallId} style={{ marginTop: "10px", padding: "10px", border: "1px solid #f59e0b", borderRadius: "4px", background: "#fef3c7" }}>
                                                <p style={{ margin: "0 0 10px 0" }}>Approve <strong>{part.toolName}</strong>?</p>
                                                <pre style={{ margin: "0 0 10px 0", fontSize: "12px", background: "#fff", padding: "5px" }}>{JSON.stringify(part.input, null, 2)}</pre>
                                                <button onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: true })} style={{ marginRight: "10px", padding: "5px 10px", background: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Approve</button>
                                                <button onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: false })} style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Reject</button>
                                            </div>
                                        );
                                    }

                                    if (part.state === "output-available") {
                                        let summaryText = `✅ ${part.toolName} completed`;
                                        let extraData = part.output;
                                        
                                        if (part.toolName === "getUserLocation" && part.output && (part.output as any).timezone) {
                                            summaryText = `📍 Identified device timezone as ${(part.output as any).timezone}`;
                                        } else if (part.toolName === "createCalendarEvent" && part.output && (part.output as any).success) {
                                            summaryText = `🗓️ Successfully added to Google Calendar!`;
                                            return (
                                                <div key={part.toolCallId} style={{ marginTop: "10px", padding: "10px", background: "#dcfce3", border: "1px solid #86efac", borderRadius: "8px", color: "#166534", fontSize: "14px", fontWeight: "500", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    {summaryText}
                                                    {(part.output as any).link && <a href={(part.output as any).link} target="_blank" rel="noreferrer" style={{ color: "#166534", textDecoration: "underline" }}>View Event</a>}
                                                </div>
                                            );
                                        }

                                        return (
                                            <details key={part.toolCallId} style={{ marginTop: "10px", padding: "8px", background: "#f1f5f9", borderRadius: "6px" }}>
                                                <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#475569" }}>{summaryText}</summary>
                                                <div style={{ marginTop: "8px", fontSize: "11px", color: "gray" }}>
                                                    <strong>Debug data:</strong>
                                                    <pre style={{ margin: "5px 0 0 0", whiteSpace: "pre-wrap" }}>{JSON.stringify(extraData, null, 2)}</pre>
                                                </div>
                                            </details>
                                        );
                                    }

                                    return (
                                        <div key={part.toolCallId} style={{ marginTop: "10px", fontSize: "12px", color: "#6366f1", fontStyle: "italic", padding: "5px", background: "#e0e7ff", borderRadius: "4px" }}>
                                            ⚙️ Using tool: <strong>{part.toolName}</strong>...
                                        </div>
                                    );
                                }

                                return <div key={i} style={{ fontSize: "10px", color: "red", background: "#fee2e2", padding: "4px" }}>UNCAUGHT PART: {JSON.stringify(part)}</div>;
                            })}
                        </div>
                    </div>
                ))}
                
                {status === "streaming" && (
                    <div style={{ background: "#fff", padding: "14px 18px", borderRadius: "8px", alignSelf: "flex-start", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", display: "flex", gap: "6px", alignItems: "center", marginTop: "5px" }}>
                        <div className="typing-dot" style={{ animationDelay: "0ms" }}></div>
                        <div className="typing-dot" style={{ animationDelay: "200ms" }}></div>
                        <div className="typing-dot" style={{ animationDelay: "400ms" }}></div>
                    </div>
                )}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem(
                        "message",
                    ) as HTMLInputElement;
                    if (!input.value.trim()) return;
                    sendMessage({ text: input.value });
                    input.value = "";
                }}
                style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
            >
                <input name="message" disabled={status === "streaming"} placeholder={status === "streaming" ? "The AI is thinking... please wait!" : "Try: book a trip to the bar tonight at 9"} style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc", outline: "none", fontSize: "16px" }} />
                <button type="submit" disabled={status === "streaming"} style={{ padding: "10px 20px", background: status === "streaming" ? "#9ca3af" : "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: status === "streaming" ? "not-allowed" : "pointer", fontSize: "16px", fontWeight: "bold" }}>
                    Send
                </button>
            </form>

            <button onClick={clearHistory} style={{ padding: "8px 16px", background: "#9ca3af", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px" }}>Clear history</button>
        </div>
    );
}

function Login() {
    const loginWithGoogle = () => {
        const redirectUri = window.location.origin;
        const scope = "email profile https://www.googleapis.com/auth/calendar";
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=consent`;
        window.location.href = url;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif", backgroundColor: "#f9fafb" }}>
            <h1 style={{ marginBottom: "10px", color: "#111827" }}>Welcome to CalendAI</h1>
            <p style={{ color: "#4b5563", marginBottom: "30px", textAlign: "center", maxWidth: "400px" }}>
                Log in to experience interactive calendar management power by cloudflare workers
            </p>
            <button 
                onClick={loginWithGoogle} 
                style={{ 
                    padding: "12px 24px", 
                    fontSize: "16px", 
                    backgroundColor: "#fff", 
                    color: "#374151", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontWeight: "600",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
            >
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style={{ width: "20px" }} />
                Sign in with Google
            </button>
        </div>
    );
}

export default function App() {
    const [authData, setAuthData] = useState<{ token: string; user: any } | null>(null);

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        const code = query.get("code");
        
        if (code) {
            fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, redirectUri: window.location.origin })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setAuthData({ token: data.token, user: data.user });
                    window.history.replaceState(null, "", window.location.pathname);
                    window.location.reload();
                }
            })
            .catch(console.error);
        } else {
            fetch("/api/auth/me")
                .then(res => res.json())
                .then(data => {
                    if (data && data.user) {
                        setAuthData({ token: data.token, user: data.user });
                    }
                })
                .catch(() => {});
        }
    }, []);

    if (!authData) {
        return <Login />;
    }

    return <Chat user={authData.user} token={authData.token} />;
}