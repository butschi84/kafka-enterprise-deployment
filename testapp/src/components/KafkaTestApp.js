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
    const [tokenEndpointUrl, setTokenEndpointUrl] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [wsConnected, setWsConnected] = useState(false);
    const [ca, setCa] = useState(null);
    const [clientCert, setClientCert] = useState(null);
    const [clientKey, setClientKey] = useState(null);
    const [replicationStats, setReplicationStats] = useState(null);
    const [loadingReplication, setLoadingReplication] = useState(false);
    const [producerActive, setProducerActive] = useState(false);
    const [producerInterval, setProducerInterval] = useState(2000);
    const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(7)}`);

    const logMessage = (msg) => {
        setLogs((prev) => prev + msg + "\n");
    };

    const sendMessage = async () => {
        try {
            const body = {
                action: "send",
                message,
                brokers,
                authType,
                username,
                password,
                tokenEndpointUrl,
                clientId,
                clientSecret
            };

            if (authType === "ssl" || authType === "oauthbearer") {
                let caData = null;
                let clientCertData = null;
                let clientKeyData = null;

                if (ca) {
                    caData = await readFileAsDataURL(ca);
                }
                if (clientCert) {
                    clientCertData = await readFileAsDataURL(clientCert);
                }
                if (clientKey) {
                    clientKeyData = await readFileAsDataURL(clientKey);
                }

                body.ca = caData;
                body.clientCert = clientCertData;
                body.clientKey = clientKeyData;
            }

            const response = await fetch("/api/kafka", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            logMessage(data.success ? `📤 Sent: ${message}` : `❌ Error: ${data.error}`);
        } catch (error) {
            logMessage(`❌ Error sending: ${error.message}`);
        }
    };

    const saveSettings = async () => {
        if (socket) {
            let caData = null;
            let clientCertData = null;
            let clientKeyData = null;

            if (ca) {
                caData = await readFileAsDataURL(ca);
            }
            if (clientCert) {
                clientCertData = await readFileAsDataURL(clientCert);
            }
            if (clientKey) {
                clientKeyData = await readFileAsDataURL(clientKey);
            }

            socket.emit("setBrokers", {
                brokers,
                authType,
                username,
                password,
                ca: caData,
                clientCert: clientCertData,
                clientKey: clientKeyData,
                tokenEndpointUrl,
                clientId,
                clientSecret
            });
            logMessage(`🔄 Updated settings: Brokers - ${brokers}, Auth - ${authType}`);
        }
    };

    // Helper function to read file as data URL
    const readFileAsDataURL = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const saveBrokers = () => {
        if (socket) {
            socket.emit("setBrokers", brokers);
            logMessage(`🔄 Updated brokers to: ${brokers}`);
        }
    };

    const getReplicationStats = async () => {
        setLoadingReplication(true);
        try {
            let caData = null;
            let clientCertData = null;
            let clientKeyData = null;

            if (ca) {
                caData = await readFileAsDataURL(ca);
            }
            if (clientCert) {
                clientCertData = await readFileAsDataURL(clientCert);
            }
            if (clientKey) {
                clientKeyData = await readFileAsDataURL(clientKey);
            }

            const response = await fetch("/api/kafka-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "getTopicMetadata",
                    brokers,
                    authType,
                    username,
                    password,
                    ca: caData,
                    clientCert: clientCertData,
                    clientKey: clientKeyData,
                    tokenEndpointUrl,
                    clientId,
                    clientSecret,
                    topic: "test-topic",
                }),
            });
            const data = await response.json();
            if (response.ok) {
                setReplicationStats(data);
                logMessage(`✅ Replication stats retrieved for topic: ${data.topic}`);
            } else {
                logMessage(`❌ Error getting replication stats: ${data.error}`);
            }
        } catch (error) {
            logMessage(`❌ Error getting replication stats: ${error.message}`);
        } finally {
            setLoadingReplication(false);
        }
    };

    const startProducer = async () => {
        try {
            let caData = null;
            let clientCertData = null;
            let clientKeyData = null;

            if (ca) {
                caData = await readFileAsDataURL(ca);
            }
            if (clientCert) {
                clientCertData = await readFileAsDataURL(clientCert);
            }
            if (clientKey) {
                clientKeyData = await readFileAsDataURL(clientKey);
            }

            const body = {
                action: "start",
                sessionId,
                brokers,
                authType,
                interval: producerInterval,
                username,
                password,
                tokenEndpointUrl,
                clientId,
                clientSecret,
            };

            if (authType === "ssl" || authType === "oauthbearer") {
                body.ca = caData;
                body.clientCert = clientCertData;
                body.clientKey = clientKeyData;
            }

            console.log("▶️ Starting producer with sessionId:", sessionId);
            const response = await fetch("/api/kafka-producer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            console.log("▶️ Start response:", data);
            if (response.ok && data.success) {
                setProducerActive(true);
                logMessage(`✅ Producer started (interval: ${producerInterval}ms, sessionId: ${sessionId})`);
            } else {
                logMessage(`❌ Error starting producer: ${data.error}`);
            }
        } catch (error) {
            logMessage(`❌ Error starting producer: ${error.message}`);
        }
    };

    const stopProducer = async () => {
        try {
            console.log("🛑 Stopping producer with sessionId:", sessionId);
            const response = await fetch("/api/kafka-producer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "stop",
                    sessionId,
                }),
            });
            const data = await response.json();
            console.log("🛑 Stop response:", data);
            if (response.ok && data.success) {
                setProducerActive(false);
                logMessage(`🛑 Producer stopped`);
            } else {
                logMessage(`❌ Error stopping producer: ${data.error || "Unknown error"}`);
            }
        } catch (error) {
            console.error("❌ Stop producer error:", error);
            logMessage(`❌ Error stopping producer: ${error.message}`);
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
                                <option value="ssl">SSL</option>
                                <option value="oauthbearer">OAUTHBEARER</option>
                            </select>
                            {authType === "oauthbearer" && (
                                <>
                                    <label htmlFor="caFile">CA Certificate:</label>
                                    <Input
                                        id="caFile"
                                        type="file"
                                        accept=".pem"
                                        onChange={(e) => setCa(e.target.files[0])}
                                        placeholder="Upload CA Certificate (ca.pem)"
                                    />
                                    <label htmlFor="clientCertFile">Client Certificate:</label>
                                    <Input
                                        id="clientCertFile"
                                        type="file"
                                        accept=".pem"
                                        onChange={(e) => setClientCert(e.target.files[0])}
                                        placeholder="Upload Client Certificate (client.pem)"
                                    />
                                    <label htmlFor="clientKeyFile">Client Key:</label>
                                    <Input
                                        id="clientKeyFile"
                                        type="file"
                                        accept=".key"
                                        onChange={(e) => setClientKey(e.target.files[0])}
                                        placeholder="Upload Client Key (client.key)"
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Token Endpoint URL"
                                        value={tokenEndpointUrl}
                                        onChange={(e) => setTokenEndpointUrl(e.target.value)}
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Client ID"
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                    />
                                    <Input
                                        type="password"
                                        placeholder="Client Secret"
                                        value={clientSecret}
                                        onChange={(e) => setClientSecret(e.target.value)}
                                    />
                                </>
                            )}
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
                            {authType === "ssl" && (
                                <>
                                    <label htmlFor="caFile">CA Certificate:</label>
                                    <Input
                                        id="caFile"
                                        type="file"
                                        accept=".pem"
                                        onChange={(e) => setCa(e.target.files[0])}
                                        placeholder="Upload CA Certificate (ca.pem)"
                                    />
                                    <label htmlFor="clientCertFile">Client Certificate:</label>
                                    <Input
                                        id="clientCertFile"
                                        type="file"
                                        accept=".pem"
                                        onChange={(e) => setClientCert(e.target.files[0])}
                                        placeholder="Upload Client Certificate (client.pem)"
                                    />
                                    <label htmlFor="clientKeyFile">Client Key:</label>
                                    <Input
                                        id="clientKeyFile"
                                        type="file"
                                        accept=".key"
                                        onChange={(e) => setClientKey(e.target.files[0])}
                                        placeholder="Upload Client Key (client.key)"
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
                            <h5>📤 Send Message</h5>
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
                            <h5>🔄 Auto Producer</h5>
                            <p className="text-muted small">Produces random animal names with random keys to distribute across partitions</p>
                            <div className="d-flex gap-2 align-items-center">
                                <label className="small">Interval (ms):</label>
                                <Input
                                    type="number"
                                    value={producerInterval}
                                    onChange={(e) => setProducerInterval(parseInt(e.target.value) || 2000)}
                                    disabled={producerActive}
                                    style={{ width: "100px" }}
                                />
                            </div>
                            {producerActive ? (
                                <Button onClick={stopProducer} className="btn btn-danger">Stop Producer</Button>
                            ) : (
                                <Button onClick={startProducer} className="btn btn-success">Start Producer</Button>
                            )}
                            <p className="text-muted small">
                                {producerActive ? "🟢 Producer is running" : "⚪ Producer is stopped"}
                            </p>
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
                            <h5>📊 Topic Replication Stats</h5>
                            <div className="d-flex gap-2 mb-3">
                                <Button 
                                    onClick={getReplicationStats} 
                                    disabled={loadingReplication}
                                    className="btn-sm btn-primary"
                                >
                                    {loadingReplication ? "Loading..." : "Get Replication Stats (test-topic)"}
                                </Button>
                            </div>
                            
                            {replicationStats && (
                                <div className="mt-3">
                                    <div className="alert alert-info">
                                        <strong>Topic:</strong> {replicationStats.topic}<br/>
                                        <strong>Partitions:</strong> {replicationStats.partitionCount}<br/>
                                        <strong>Replication Factor:</strong> {replicationStats.replicationFactor}<br/>
                                        <strong>Partitions with Full Replication:</strong> {replicationStats.summary.partitionsWithFullReplication} / {replicationStats.summary.totalPartitions}<br/>
                                        <strong>Partitions with All ISR:</strong> {replicationStats.summary.partitionsWithAllISR} / {replicationStats.summary.totalPartitions}<br/>
                                        <strong>Partitions with Offline Replicas:</strong> {replicationStats.summary.partitionsWithOfflineReplicas}<br/>
                                        <strong>ISR Range:</strong> {replicationStats.summary.minISR} - {replicationStats.summary.maxISR} (min - max)
                                    </div>
                                    
                                    <div className="mt-3">
                                        <h6>Partition Details:</h6>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-bordered">
                                                <thead>
                                                    <tr>
                                                        <th>Partition</th>
                                                        <th>Leader</th>
                                                        <th>Replicas</th>
                                                        <th>ISR</th>
                                                        <th>Offline</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {replicationStats.partitions.map((p) => (
                                                        <tr key={p.partitionId} className={
                                                            p.isr.length === p.replicas.length && p.offlineReplicas.length === 0 
                                                                ? "table-success" 
                                                                : "table-warning"
                                                        }>
                                                            <td>{p.partitionId}</td>
                                                            <td>{p.leader}</td>
                                                            <td>{p.replicas.join(", ")}</td>
                                                            <td>{p.isr.join(", ")}</td>
                                                            <td>{p.offlineReplicas.length > 0 ? p.offlineReplicas.join(", ") : "None"}</td>
                                                            <td>
                                                                {p.isr.length === p.replicas.length && p.offlineReplicas.length === 0 ? (
                                                                    <span className="badge bg-success">✓ Healthy</span>
                                                                ) : (
                                                                    <span className="badge bg-warning">⚠ Degraded</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
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
