import mqtt from 'mqtt';

const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

export class MQTTService {
    private client: mqtt.MqttClient | null = null;
    private roomCode: string | null = null;

    connect(onConnect: () => void, onError: (err: Error) => void) {
        if (this.client) return;

        this.client = mqtt.connect(BROKER_URL, {
            keepalive: 60,
            clientId: 'atom_' + Math.random().toString(16).substr(2, 8),
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
        });

        this.client.on('connect', () => {
            console.log("MQTT Connected");
            onConnect();
        });

        this.client.on('error', (err) => {
            console.error("MQTT Error", err);
            onError(err);
        });
    }

    hostRoom(code: string, onPresence: () => void) {
        if (!this.client) return;
        this.roomCode = code;
        const topic = `atom/share/${code}/presence`;
        
        this.client.subscribe(topic, (err) => {
            if (!err) console.log(`Hosting room ${code}, listening for joins...`);
        });

        this.client.on('message', (t) => {
            if (t === topic) {
                onPresence();
            }
        });
    }

    joinRoom(code: string, onWorkspaceReceived: (data: any) => void) {
        if (!this.client) return;
        this.roomCode = code;
        const topicWorkspace = `atom/share/${code}/workspace`;
        const topicPresence = `atom/share/${code}/presence`;

        this.client.subscribe(topicWorkspace, (err) => {
            if (!err) {
                // Announce presence
                this.client?.publish(topicPresence, 'joined');
            }
        });

        this.client.on('message', (topic, message) => {
            if (topic === topicWorkspace) {
                try {
                    const data = JSON.parse(message.toString());
                    onWorkspaceReceived(data);
                } catch (e) {
                    console.error("Failed to parse incoming workspace", e);
                }
            }
        });
    }

    publishWorkspace(workspace: any) {
        if (!this.client || !this.roomCode) return;
        const topic = `atom/share/${this.roomCode}/workspace`;
        // Replacer to avoid circular references if any (usually FileData is clean JSON)
        const payload = JSON.stringify(workspace);
        this.client.publish(topic, payload, { qos: 1, retain: false });
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
    }
}

export const mqttService = new MQTTService();