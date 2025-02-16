import { Kafka } from "kafkajs";
import { Server } from "socket.io";

let io;
let consumer;
let isConsumerConnected = false;

export default function handler(req, res) {
    if (!res.socket.server.io) {
        console.log("✅ Initializing WebSocket server...");
        io = new Server(res.socket.server, {
            path: "/api/socket.io",
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                allowedHeaders: ["Content-Type"],
                credentials: true
            },
            transports: ["websocket"], // Force WebSocket
        });

        res.socket.server.io = io;

        io.on("connection", async (socket) => {
            console.log("🔗 Client connected via WebSocket");

            socket.on("setBrokers", async (brokers) => {
                console.log(`🔄 Reconnecting consumer with brokers: ${brokers}`);

                try {
                    if (consumer && isConsumerConnected) {
                        await consumer.disconnect();
                    }

                    const kafka = new Kafka({
                        clientId: `test-listener-${Date.now()}`,
                        brokers: brokers.split(","),
                    });

                    consumer = kafka.consumer({ groupId: `test-group-${Date.now()}` });

                    socket.emit("connectingConsumer", "🔗 Connecting Kafka Consumer");
                    await consumer.connect();
                    await consumer.subscribe({ topic: "test-topic", fromBeginning: false });

                    await consumer.run({
                        eachMessage: async ({ message }) => {
                            console.log(`📩 Received: ${message.value.toString()}`);
                            socket.emit("newMessage", message.value.toString());
                        },
                    });

                    isConsumerConnected = true;
                    socket.emit("consumerReady", "✅ Consumer connected successfully");
                } catch (error) {
                    console.error("❌ Consumer error:", error.message);
                    socket.emit("consumerError", error.message);
                }
            });

            socket.on("disconnect", () => {
                console.log("❌ Client disconnected");
            });
        });

        console.log("✅ WebSocket server initialized");
    }

    res.end();
}
