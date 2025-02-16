import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { Card, CardContent } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import "bootstrap/dist/css/bootstrap.min.css";

export default function KafkaTestApp() {
    const [message, setMessage] = useState("");
    const [receivedMessages, setReceivedMessages] = useState([]);
    const [logs, setLogs] = useState("");
    const [brokers, setBrokers] = useState("kafka:9092");
    const [socket, setSocket] = useState(null);
    const [authType, setAuthType] = useState("none");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [wsConnected, setWsConnected] = useState(false);

    const logMessage = (msg) => {
        setLogs((prev) => prev + msg + "\n");
    };

    const sendMessage = async () => {
        try {
            const response = await fetch("/api/kafka", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "send", message, brokers, authType, username, password }),
            });
            const data = await response.json();
            logMessage(data.success ? `📤 Sent: ${message}` : `❌ Error: ${data.error}`);
        } catch (error) {
            logMessage(`❌ Error sending: ${error.message}`);
        }
    };

    const saveSettings = () => {
        if (socket) {
            socket.emit("setBrokers", { brokers, authType, username, password });
            logMessage(`🔄 Updated settings: Brokers - ${brokers}, Auth - ${authType}`);
        }
    };

    const saveBrokers = () => {
        if (socket) {
            socket.emit("setBrokers", brokers);
            logMessage(`🔄 Updated brokers to: ${brokers}`);
        }
    };

    useEffect(() => {

        const newSocket = io({
            path: "/api/socket.io",  // Ensure WebSocket connects to correct API path
            transports: ["websocket"], // Enforce WebSocket over polling
        });

        setSocket(newSocket);

        logMessage(`📩 Initializing Web Socket`);

        newSocket.on("connect", () => {
            console.log("✅ WebSocket connected!");
            setWsConnected(true);
        });

        newSocket.on("newMessage", (msg) => {
            setReceivedMessages((prev) => [...prev, msg]);
            logMessage(`📩 Received: ${msg}`);
        });

        newSocket.on("consumerReady", (msg) => {
            logMessage(`✅ ${msg}`);
        });

        newSocket.on("consumerError", (err) => {
            logMessage(`❌ Consumer error: ${err}`);
        });

        newSocket.on("disconnect", () => {
            console.log("❌ WebSocket disconnected");
            setWsConnected(false);
        });

        return () => {
            logMessage(`📩 Disconnecting socket`);
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        // Ensure the WebSocket API route initializes
        fetch("/api/kafka-consumer").then(() => {
            console.log("✅ WebSocket API route triggered");

            const newSocket = io({
                path: "/api/socket.io",
                transports: ["websocket"],
            });

            newSocket.on("connect", () => {
                console.log("✅ WebSocket connected!");
            });

            newSocket.on("newMessage", (msg) => {
                setReceivedMessages((prev) => [...prev, msg]);
                logMessage(`📩 Received: ${msg}`);
            });

            newSocket.on("consumerReady", (msg) => {
                logMessage(`${msg}`);
            });

            newSocket.on("connectingConsumer", (msg) => {
                logMessage(`${msg}`);
            });

            newSocket.on("consumerError", (err) => {
                logMessage(`❌ Consumer error: ${err}`);
            });

            newSocket.on("disconnect", () => {
                console.log("❌ WebSocket disconnected");
            });

            setSocket(newSocket);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);


    return (
        <div className="container mt-4">
            <div className="row mb-3">
                <div className="col-12">
                    <Card>
                        <CardContent className="p-4 d-flex flex-column gap-2">
                            <h5>⚙️ Settings</h5>
                            <Input
                                type="text"
                                placeholder="Kafka Brokers (comma-separated)"
                                value={brokers}
                                onChange={(e) => setBrokers(e.target.value)}
                            />
                            <select className="form-control" value={authType} onChange={(e) => setAuthType(e.target.value)}>
                                <option value="none">None</option>
                                <option value="sasl_plaintext">SASL/PLAIN</option>
                            </select>
                            {authType === "sasl_plaintext" && (
                                <>
                                    <Input
                                        type="text"
                                        placeholder="Username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                    <Input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </>
                            )}
                            <Button onClick={saveSettings} className="btn btn-success">Save</Button>
                            <p className="text-muted">{wsConnected ? "✅ Connected" : "❌ Not Connected"}</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="row">
                <div className="col-md-6">
                    <Card>
                        <CardContent className="p-4 d-flex flex-column gap-2">
                            <Input
                                type="text"
                                placeholder="Enter message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                            <Button onClick={sendMessage} className="btn btn-primary">Send Message</Button>
                        </CardContent>
                    </Card>
                </div>
                <div className="col-md-6">
                    <Card>
                        <CardContent className="p-4 d-flex flex-column gap-2">
                            <h5>📥 Received Messages</h5>
                            <ul className="list-group">
                                {receivedMessages.map((msg, idx) => (
                                    <li key={idx} className="list-group-item">{msg}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="row mt-3">
                <div className="col-12">
                    <Card>
                        <CardContent className="p-4">
                            <h5>📝 Logs</h5>
                            <textarea className="form-control" rows="5" readOnly value={logs}></textarea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
