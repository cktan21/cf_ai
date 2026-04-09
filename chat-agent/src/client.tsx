import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useState, useEffect } from "react";

// Access the environment variable using Vite's import.meta.env system
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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

                                // Ignore backend streaming steps
                                if (part.type === "step-start") return null;

                                // The Cloudflare Agents structure prefixes tool calls with 'tool-'
                                if (part.type.startsWith("tool-")) {
                                    // Render approval UI for tools that need confirmation
                                    if (part.state === "approval-requested") {
                                        return (
                                            <div key={part.toolCallId} style={{ marginTop: "10px", padding: "10px", border: "1px solid #f59e0b", borderRadius: "4px", background: "#fef3c7" }}>
                                                <p style={{ margin: "0 0 10px 0" }}>
                                                    Approve <strong>{part.toolName}</strong>?
                                                </p>
                                                <pre style={{ margin: "0 0 10px 0", fontSize: "12px", background: "#fff", padding: "5px" }}>{JSON.stringify(part.input, null, 2)}</pre>
                                                <button
                                                    onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: true })}
                                                    style={{ marginRight: "10px", padding: "5px 10px", background: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: false })}
                                                    style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        );
                                    }

                                    // Show completed tool results
                                    if (part.state === "output-available") {
                                        return (
                                            <details key={part.toolCallId} style={{ marginTop: "10px", padding: "5px", background: "#f1f5f9", borderRadius: "4px" }}>
                                                <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>✅ {part.toolName} result</summary>
                                                <pre style={{ margin: "5px 0 0 0", fontSize: "12px", whiteSpace: "pre-wrap" }}>{JSON.stringify(part.output, null, 2)}</pre>
                                            </details>
                                        );
                                    }

                                    // Show loading state for running tools
                                    return (
                                        <div key={part.toolCallId} style={{ marginTop: "10px", fontSize: "12px", color: "#6366f1", fontStyle: "italic", padding: "5px", background: "#e0e7ff", borderRadius: "4px" }}>
                                            ⚙️ Using tool: <strong>{part.toolName}</strong>...
                                        </div>
                                    );
                                }

                                // Fallback
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
            <h1 style={{ marginBottom: "10px", color: "#111827" }}>Welcome to AI Chat Agent</h1>
            <p style={{ color: "#4b5563", marginBottom: "30px", textAlign: "center", maxWidth: "400px" }}>
                Log in to experience stateful agent sessions persisted automatically by Cloudflare Workers!
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
            <p style={{ fontSize: "14px", color: "#b45309", marginTop: "2rem", maxWidth: "400px", textAlign: "center", background: "#fef3c7", padding: "12px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                <strong>Note:</strong> You must update the <code>GOOGLE_CLIENT_ID</code> variable in <code>src/client.tsx</code> for this to work.
            </p>
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