import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useState, useEffect, useRef } from "react";

// Access the environment variable using Vite's import.meta.env system
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function BookingConfirmationCard({ part, msg, addToolApprovalResponse, sendMessage, agent }: any) {
    const eventData = part.input;
    const [isEditing, setIsEditing] = useState(false);
    
    // Parses the AI's ISO string so the native HTML `<input type="datetime-local">` can read it cleanly
    const formatForInput = (isoString?: string) => {
        if (!isoString) return "";
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return "";
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const [summary, setSummary] = useState(eventData.summary || "");
    const [description, setDescription] = useState(eventData.description || "");
    const [startTime, setStartTime] = useState(() => formatForInput(eventData.startTime));
    const [endTime, setEndTime] = useState(() => formatForInput(eventData.endTime));

    // Keep state in sync with AI updates unless user is actively editing
    useEffect(() => {
        if (!isEditing) {
            setSummary(eventData.summary || "");
            setDescription(eventData.description || "");
            setStartTime(formatForInput(eventData.startTime));
            setEndTime(formatForInput(eventData.endTime));
        }
    }, [eventData, isEditing]);

    const handleAction = async (approved: boolean) => {
        if (approved) {
            // Capture the current component state (which might have been edited)
            const payload = {
                summary,
                description,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString()
            };
            
            // Stash the final data in the Agent's state so the server uses it instead of original inputs
            const currentEdited = (agent.state as any)?.editedInputs || {};
            await agent.setState({
                ...agent.state,
                editedInputs: { ...currentEdited, [part.toolCallId]: payload }
            });
        }

        // Only respond to the specific tool call for this card
        if (part.approval?.id) {
            addToolApprovalResponse({ id: part.approval.id, approved });
        }
    };

    const handleSaveLocal = () => {
        setIsEditing(false);
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
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", marginBottom: "4px" }}>{summary}</div>
                        {description ? <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>{description}</div> : <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "12px", fontStyle: "italic" }}>No description provided</div>}
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #f1f5f9" }}>
                            <div><strong>Start:</strong> {startTime ? new Date(startTime).toLocaleString() : "Not set"}</div>
                            <div><strong>End:</strong> {endTime ? new Date(endTime).toLocaleString() : "Not set"}</div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                {isEditing ? (
                    <>
                        <button onClick={() => setIsEditing(false)} style={{ padding: "8px 16px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                        <button onClick={handleSaveLocal} style={{ flex: 1, padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", transition: "background 0.2s" }}>Save & Preview</button>
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

function DeleteConfirmationCard({ part, msg, addToolApprovalResponse }: any) {
    const { summary } = part.input;
    const [hasClicked, setHasClicked] = useState(false);

    const handleAction = (approved: boolean) => {
        if (approved) setHasClicked(true);
        // Only respond to the specific tool call for this card
        if (part.approval?.id) {
            addToolApprovalResponse({ id: part.approval.id, approved });
        }
    };

    if (hasClicked) return null; // Immediately "remove" from frontend while running in background

    return (
        <div style={{ marginTop: "15px", padding: "16px", border: "1px solid #fee2e2", borderRadius: "12px", background: "#fffcfc", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>🗑️</span>
                <h3 style={{ margin: 0, color: "#991b1b", fontSize: "15px", fontWeight: "700" }}>Confirm Deletion</h3>
            </div>
            
            <div style={{ marginBottom: "16px", padding: "10px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fee2e2" }}>
                <div style={{ fontSize: "14px", color: "#451a1a", fontWeight: "600" }}>{summary}</div>
                <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "4px" }}>Are you sure you want to remove this event?</div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => handleAction(true)} style={{ flex: 1, padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Delete Now</button>
                <button onClick={() => handleAction(false)} style={{ padding: "8px 16px", background: "#fff", color: "#475569", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Keep Event</button>
            </div>
        </div>
    );
}

function DebugInfo({ debug }: { debug: any }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div style={{ marginTop: "8px", borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", cursor: "pointer", fontWeight: "600", padding: 0 }}
            >
                {isOpen ? "🔼 Hide Debug Info" : "🔽 Show Debug Info"}
            </button>
            {isOpen && (
                <pre style={{ margin: "8px 0 0 0", padding: "10px", background: "#f1f5f9", borderRadius: "6px", fontSize: "10px", color: "#475569", overflowX: "auto", border: "1px solid #e2e8f0" }}>
                    {JSON.stringify(debug, null, 2)}
                </pre>
            )}
        </div>
    );
}

function Chat({ user, token }: { user: any; token: string }) {
    // Unique agent for each user based on their email
    const agent = useAgent({ agent: "ChatAgent", name: user.email });

    // State to force a refresh of the calendar iframe
    const [calendarNonce, setCalendarNonce] = useState(0);

    // Resizable panels state
    const [chatWidth, setChatWidth] = useState(50); // percentage
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const newWidth = (e.clientX / window.innerWidth) * 100;
            // Set bounds to prevent panels from disappearing
            if (newWidth > 15 && newWidth < 85) {
                setChatWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    // Store user data in Agent state, demonstrating persistence based on user data
    useEffect(() => {
        if (agent && agent.state?.googleToken !== token) {
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
                                        currentDate: new Date().toISOString(),
                                        userLocalDate: new Date().toLocaleDateString('en-CA'), // Returns YYYY-MM-DD in local time
                                        userLocalTime: new Date().toLocaleTimeString(),
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

    // Automatically refresh the calendar when an event is successfully booked or deleted
    // Use a ref to track which tool results we've already refreshed for, preventing redundant reloads
    const refreshedToolCalls = useRef(new Set());
    useEffect(() => {
        const toolResultParts = messages.flatMap(m => m.parts).filter((p: any) => 
            p.type === "tool-result" && 
            (p.toolName === "createCalendarEvent" || p.toolName === "deleteCalendarEvent") && 
            p.output?.success
        );

        let didChange = false;
        toolResultParts.forEach((p: any) => {
            if (!refreshedToolCalls.current.has(p.toolCallId)) {
                refreshedToolCalls.current.add(p.toolCallId);
                didChange = true;
            }
        });

        if (didChange) {
            // Delay slightly to give the Google backend time to reflect the change
            setTimeout(() => setCalendarNonce((n) => n + 1), 1000);
        }
    }, [messages]);

    return (
        <div style={{ display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "Inter, sans-serif", overflow: "hidden", userSelect: isDragging ? "none" : "auto" }}>
            {/* Sidebar: Chat Interface */}
            <div style={{ width: `${chatWidth}%`, minWidth: "300px", display: "flex", flexDirection: "column", backgroundColor: "white", boxShadow: "4px 0 24px rgba(0,0,0,0.02)", zIndex: 10 }}>
                {/* User Header */}
                <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(to right, #ffffff, #f8faff)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {user.picture && <img src={user.picture} alt="Profile" style={{ width: "40px", height: "40px", borderRadius: "12px", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} />}
                        <div>
                            <h3 style={{ margin: 0, fontSize: "15px", color: "#1e293b" }}>{user.name}</h3>
                            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "500" }}>Live Assistant</div>
                        </div>
                    </div>
                    <button 
                        onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.hash = ""; window.location.reload(); }} 
                        style={{ padding: "6px 12px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                    >
                        Sign Out
                    </button>
                </div>

                <style>
                    {`
                    @keyframes typing-pulse {
                        0%, 100% { opacity: 0.4; transform: scale(0.8); }
                        50% { opacity: 1; transform: scale(1.1); }
                    }
                    .typing-dot {
                        width: 6px;
                        height: 6px;
                        background-color: #3b82f6;
                        border-radius: 50%;
                        display: inline-block;
                        animation: typing-pulse 1.4s infinite ease-in-out;
                    }
                    ::-webkit-scrollbar { width: 6px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                    `}
                </style>

                {/* Messages Area */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px", scrollBehavior: "smooth" }}>
                    {messages.length === 0 && (
                        <div style={{ color: "#94a3b8", textAlign: "center", marginTop: "100px", padding: "0 40px" }}>
                            <div style={{ fontSize: "40px", marginBottom: "10px" }}>👋</div>
                            <h2 style={{ fontSize: "18px", color: "#475569", marginBottom: "8px" }}>Hello, {user.given_name}!</h2>
                            <p style={{ fontSize: "14px", lineHeight: "1.5" }}>I'm your CalendAI assistant. You can ask me to book meetings or check your schedule.</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} style={{ 
                            background: msg.role === "user" ? "#3b82f6" : "#ffffff", 
                            color: msg.role === "user" ? "white" : "#1e293b",
                            padding: "12px 16px", 
                            borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", 
                            alignSelf: msg.role === "user" ? "flex-end" : "flex-start", 
                            maxWidth: "85%", 
                            boxShadow: msg.role === "user" ? "0 4px 12px rgba(59, 130, 246, 0.2)" : "0 2px 8px rgba(0,0,0,0.05)",
                            fontSize: "14px",
                            lineHeight: "1.5"
                        }}>
                            <div style={{ fontWeight: "700", fontSize: "11px", marginBottom: "4px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{msg.role}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {msg.parts.map((part, i) => {
                                    if (part.type === "text") return <span key={i} style={{ marginTop: "4px" }}>{part.text}</span>;
                                    if (part.type === "step-start") return null;
                                    if (part.type.startsWith("tool-")) {
                                        if (part.state === "approval-requested") {
                                            const lastUserMsgIndex = [...messages].reverse().findIndex(m => m.role === "user");
                                            const actualLastUserIndex = lastUserMsgIndex === -1 ? -1 : messages.length - 1 - lastUserMsgIndex;
                                            const currentMsgIndex = messages.findIndex(m => m.id === msg.id);
                                            const isStale = actualLastUserIndex > currentMsgIndex;

                                            if (isStale) return <div key={part.toolCallId} style={{ padding: "8px", color: "#64748b", fontSize: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>⚠️ Abandoned tool request</div>;
                                            
                                            // Always show delete cards (no indexing check)
                                            if (part.toolName === "deleteCalendarEvent") {
                                                return <DeleteConfirmationCard key={part.toolCallId} part={part} msg={msg} addToolApprovalResponse={addToolApprovalResponse} />;
                                            }

                                            // For other tools, ensure we only show the confirmation UI once per tool name
                                            const firstApprovalIndex = msg.parts.findIndex((p: any) => p.type.startsWith("tool-") && p.state === "approval-requested" && p.toolName === part.toolName);
                                            if (i !== firstApprovalIndex) return null;
                                            if (part.toolName === "createCalendarEvent" || (part.input && (part.input as any).summary && (part.input as any).startTime)) {
                                                return <BookingConfirmationCard key={part.toolCallId} part={part} msg={msg} addToolApprovalResponse={addToolApprovalResponse} sendMessage={sendMessage} agent={agent} />;
                                            }
                                        }
                                        if (part.state === "output-available") {
                                            let summaryText = `✅ ${part.toolName} completed`;
                                            if (part.toolName === "getUserLocation" && part.output?.timezone) summaryText = `📍 Location: ${part.output.timezone}`;
                                            else if (part.toolName === "createCalendarEvent" && part.output?.success) summaryText = `🗓️ Trip added to Google Calendar!`;
                                            else if (part.toolName === "listCalendarEvents") summaryText = `🎉 Event Successfully Found!`;

                                            if (part.toolName === "deleteCalendarEvent" && part.output?.success) {
                                                return <div key={part.toolCallId} style={{ display: "block", padding: "2px 8px", background: "#fef2f2", color: "#991b1b", fontSize: "11px", borderRadius: "10px", border: "1px solid #fee2e2", fontWeight: "600", width: "fit-content" }}>🗑️ Deleted</div>;
                                            }
                                            return (
                                                <div key={part.toolCallId} style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", fontSize: "13px", fontWeight: "600" }}>
                                                    {summaryText}
                                                    {part.output?.debug && <DebugInfo debug={part.output.debug} />}
                                                </div>
                                            );
                                        }
                                        return <div key={part.toolCallId} style={{ fontSize: "12px", color: "#3b82f6", fontStyle: "italic", background: "#eff6ff", padding: "8px", borderRadius: "8px" }}>⚙️ Running: <strong>{part.toolName}</strong>...</div>;
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    ))}
                    {status === "streaming" && (
                        <div style={{ background: "#ffffff", padding: "12px 18px", borderRadius: "18px 18px 18px 4px", alignSelf: "flex-start", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", gap: "5px", alignItems: "center" }}>
                            <div className="typing-dot" style={{ animationDelay: "0ms" }}></div>
                            <div className="typing-dot" style={{ animationDelay: "200ms" }}></div>
                            <div className="typing-dot" style={{ animationDelay: "400ms" }}></div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div style={{ padding: "20px", borderTop: "1px solid #f1f5f9" }}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
                            if (!input.value.trim()) return;
                            sendMessage({ text: input.value });
                            input.value = "";
                        }}
                        style={{ display: "flex", gap: "10px" }}
                    >
                        <input 
                            name="message" 
                            disabled={status === "streaming"} 
                            placeholder={status === "streaming" ? "Thinking..." : "Book coffee with Ben tomorrow..."} 
                            style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "14px", backgroundColor: "#f8fafc", transition: "border-color 0.2s" }} 
                        />
                        <button type="submit" disabled={status === "streaming"} style={{ padding: "12px", background: status === "streaming" ? "#9ca3af" : "#3b82f6", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </button>
                    </form>
                    <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button onClick={clearHistory} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", fontWeight: "600", padding: 0 }}>Reset Conversation</button>
                        <div style={{ fontSize: "10px", color: "#cbd5e1", fontWeight: "bold" }}>Powered by Cloudflare Agents</div>
                    </div>
                </div>
            </div>

            {/* Splitter Bar */}
            <div 
                onMouseDown={handleMouseDown}
                style={{ 
                    width: "8px", 
                    cursor: "col-resize", 
                    backgroundColor: isDragging ? "#3b82f6" : "transparent",
                    transition: "background-color 0.2s",
                    zIndex: 20,
                    margin: "0 -4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <div style={{ width: "2px", height: "40px", backgroundColor: "#e2e8f0", borderRadius: "1px" }} />
            </div>

            {/* Main Content: Google Calendar Dashboard */}
            <div style={{ flex: 1, minWidth: "300px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
                {/* Overlay to prevent iframe from capturing mouse events during resize */}
                {isDragging && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: "transparent" }} />}
                
                <iframe 
                    key={calendarNonce} 
                    src={`https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(user.email)}&ctz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}&mode=WEEK&wkst=1&bgcolor=%23ffffff&showPrint=0&showTabs=0&showCalendars=0`} 
                    style={{ border: "none", width: "100%", height: "100%", opacity: 1, transition: "opacity 0.5s ease" }}
                    title="Google Calendar"
                />
            </div>
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