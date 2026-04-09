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
                if (toolCall.toolName === "getUserTimezone") {
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: {
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            localTime: new Date().toLocaleTimeString(),
                        },
                    });
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
                    onClick={() => { window.location.hash = ""; window.location.reload(); }} 
                    style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                    Sign Out
                </button>
            </div>
            
            <div style={{ background: "#e0f2fe", padding: "10px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", border: "1px solid #bae6fd" }}>
                <strong>Agent State Persistence:</strong> Your Google user data and calendar auth token are securely synced with cloudflare workers' state. Check <code>server.ts</code> to see this in action!
            </div>

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

                                // Render approval UI for tools that need confirmation
                                if (
                                    part.type === "tool" &&
                                    part.state === "approval-required"
                                ) {
                                    return (
                                        <div key={part.toolCallId} style={{ marginTop: "10px", padding: "10px", border: "1px solid #f59e0b", borderRadius: "4px", background: "#fef3c7" }}>
                                            <p style={{ margin: "0 0 10px 0" }}>
                                                Approve <strong>{part.toolName}</strong>?
                                            </p>
                                            <pre style={{ margin: "0 0 10px 0", fontSize: "12px", background: "#fff", padding: "5px" }}>{JSON.stringify(part.input, null, 2)}</pre>
                                            <button
                                                onClick={() =>
                                                    addToolApprovalResponse({
                                                        id: part.toolCallId,
                                                        approved: true,
                                                    })
                                                }
                                                style={{ marginRight: "10px", padding: "5px 10px", background: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() =>
                                                    addToolApprovalResponse({
                                                        id: part.toolCallId,
                                                        approved: false,
                                                    })
                                                }
                                                style={{ padding: "5px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    );
                                }

                                // Show completed tool results
                                if (
                                    part.type === "tool" &&
                                    part.state === "output-available"
                                ) {
                                    return (
                                        <details key={part.toolCallId} style={{ marginTop: "10px", padding: "5px", background: "#f1f5f9", borderRadius: "4px" }}>
                                            <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>{part.toolName} result</summary>
                                            <pre style={{ margin: "5px 0 0 0", fontSize: "12px" }}>{JSON.stringify(part.output, null, 2)}</pre>
                                        </details>
                                    );
                                }

                                return null;
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem(
                        "message",
                    ) as HTMLInputElement;
                    sendMessage({ text: input.value });
                    input.value = "";
                }}
                style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
            >
                <input name="message" placeholder="Try: What's the weather in Paris?" style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc", outline: "none", fontSize: "16px" }} />
                <button type="submit" disabled={status === "streaming"} style={{ padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                    Send
                </button>
            </form>

            <button onClick={clearHistory} style={{ padding: "8px 16px", background: "#9ca3af", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px" }}>Clear history</button>
        </div>
    );
}

function Login() {
    const loginWithGoogle = () => {
        // Use Implicit flow to get access token for demonstration purposes
        const redirectUri = window.location.origin;
        const scope = "email profile https://www.googleapis.com/auth/calendar";
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
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
        const hash = window.location.hash;
        if (hash.includes("access_token")) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            if (token) {
                // Fetch user info from Google APIs using the granted standard token
                fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${token}` }
                })
                .then(res => res.json())
                .then(user => {
                    if (user && user.email) {
                        setAuthData({ token, user });
                        // Clean URL hash so the token disappears from the URL
                        window.history.replaceState(null, "", window.location.pathname);
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch user data", err);
                });
            }
        }
    }, []);

    if (!authData) {
        return <Login />;
    }

    return <Chat user={authData.user} token={authData.token} />;
}