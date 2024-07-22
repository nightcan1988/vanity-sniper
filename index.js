"use strict";
const tls = require('tls');
const WebSocket = require('ws');
const https = require('https');
const extractJson = require('extract-json-from-string');

const apiUrl = 'https://canary.discord.com/api/v9/';
const guilds = {};
let tlsSocket;
let websocket;
let vanity;
const authorizationToken = '';
const self = '';
const wsLink = 'wss://gateway-us-east1-b.discord.gg';

const channelId = '1265004151104995348'; // Replace with your channel ID

const connectTLS = () => {
    tlsSocket = tls.connect({
        host: 'canary.discord.com',
        port: 443,
        servername: 'canary.discord.com',
        rejectUnauthorized: true,
        ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
    }, onTLSSecureConnect);

    tlsSocket.on('data', onData);
    tlsSocket.on('error', onTLSConnectionError);
    tlsSocket.on('end', onTLSConnectionEnd);
};

const onTLSSecureConnect = () => {
    console.log("TLS connection established");
};

const onTLSConnectionError = (error) => {
    console.error("TLS error:", error);
    reconnectTLS();
};

const onTLSConnectionEnd = () => {
    console.log("TLS connection closed");
    reconnectTLS();
};

const reconnectTLS = () => {
    setTimeout(connectTLS, 1000); // 1000 ms delay before reconnecting
};

const connectWebSocket = () => {
    websocket = new WebSocket(wsLink, {
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Connection': 'Upgrade',
            'Host': 'gateway.discord.gg',
            'Pragma': 'no-cache',
            'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
            'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
            'Sec-WebSocket-Version': '13',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        },
        origin: 'https://discord.com'
    });

    websocket.on('open', onWebSocketOpen);
    websocket.on('message', onMessage);
    websocket.on('close', onWebSocketClose);
    websocket.on('error', onWebSocketError);
};

const onWebSocketOpen = () => {
    console.log("WebSocket connection established");
    sendHeartbeat();
};

const sendHeartbeat = () => {
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ op: 1, d: {} }));
    }
    setTimeout(sendHeartbeat, 5500);
};

const onWebSocketError = (error) => {
    console.error("WebSocket error:", error);
};

const onWebSocketClose = () => {
    console.log("WebSocket connection closed");
    reconnectWebSocket();
};

const reconnectWebSocket = () => {
    setTimeout(connectWebSocket, 1000); // 1000 ms delay before reconnecting
};

const onData = (data) => {
    const ext = extractJson(data.toString());
    const find = ext.find((e) => e.code) || ext.find((e) => e.message);
    if (find) {
        console.log("Extracted JSON:", find);
        sendMessageToChannel(channelId, JSON.stringify(find, null, 2)); // Send extracted JSON to the channel
    }
};

const onMessage = (message) => {
    try {
        const parsedMessage = JSON.parse(message);
        const { d, op, t } = parsedMessage;

        if (t === 'GUILD_UPDATE') {
            GuildUpdate(d);
        } else if (t === 'GUILD_DELETE') {
            GuildDelete(d);
        } else if (t === 'READY') {
            Ready(d);
        }

        if (op === 10) {
            Op10(d, websocket);
        } else if (op === 7) {
            Op7();
        }
    } catch (error) {
        console.error("Error handling WebSocket message:", error);
    }
};

const sendMessageToChannel = async (channelId, message) => {
    const payload = JSON.stringify({ content: message });
    const headers = {
        'Authorization': `Bot ${authorizationToken}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch(`${apiUrl}/channels/${channelId}/messages`, {
            method: 'POST',
            headers,
            body: payload,
        });
        if (!response.ok) {
            console.error(`Failed to send message to channel ${channelId}: ${response.statusText}`);
        } else {
            console.log(`Message sent to channel ${channelId}`);
        }
    } catch (error) {
        console.error(`Error sending message to channel ${channelId}:`, error);
    }
};

const GuildUpdate = async (guild) => {
    const find = guilds[guild.id];
    if (find && find !== guild.vanity_url_code) {
        await handleVanityCode(find);
        vanity = `${find} guild update`;
        console.log(vanity);
    }
};

const GuildDelete = async (guild) => {
    const find = guilds[guild.id];
    if (find) {
        await handleVanityCode(find);
        vanity = `${find} guild delete`;
        console.log(vanity);
    }
};

const handleVanityCode = async (code) => {
    const vanityPayload = JSON.stringify({ code });
    const vanityHeaders = {
        'Authorization': authorizationToken,
        'Content-Type': 'application/json'
    };
    await sendTLSRequest(vanityPayload, vanityHeaders);
    await fasterRequest(`${apiUrl}/guilds/1259827517171175546/vanity-url`, 'PATCH', vanityHeaders, vanityPayload);
};

const sendTLSRequest = async (payload, headers) => {
    const request = `PATCH /api/v9/guilds/1259827517171175546/vanity-url HTTP/1.1\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n${payload}`;
    tlsSocket.write(request);
};

const Ready = (data) => {
    data.guilds.forEach((guild) => {
        if (guild.vanity_url_code) {
            guilds[guild.id] = guild.vanity_url_code;
            console.log(`url > ${guild.vanity_url_code}`);
        }
    });
};

const Op10 = (data, websocket) => {
    websocket.send(JSON.stringify({
        op: 2,
        d: {
            token: self,
            intents: 513,
            properties: {
                os: 'MacOs',
                browser: 'FireFox',
                device: 'desktop',
            },
        },
    }));
    const heartbeatInterval = setInterval(() => {
        websocket.send(JSON.stringify({ op: 1, d: {} }));
    }, data.heartbeat_interval);
};

const Op7 = () => {
    console.log("Op7 received, reconnecting...");
    reconnectWebSocket();
};

const fasterRequest = async (url, method, headers, body) => {
    const agent = new https.Agent({ keepAlive: true });
    try {
        const response = await fetch(url, {
            method,
            headers,
            body,
            agent,
        });
        if (response.ok) {
            console.log("Request successful");
        }
    } catch (error) {
        console.error("Request failed:", error);
    }
};

connectTLS();
connectWebSocket();

// Exit the process every 3 minutes (180000 milliseconds)
setTimeout(() => {
    console.log("Exiting process after 3 minutes");
    process.exit(0);
}, 180000);
