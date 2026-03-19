const net = require('net');

console.log("Starting test connection to Pi...");
const client = new net.Socket();

client.connect(5005, '10.250.2.247', () => {
    console.log("Connected directly to Pi!");
    console.log("Sending ping packet...");
    client.write(JSON.stringify({action: "ping"}) + '\n');
});

client.on('data', (data) => {
    console.log("Received data from Pi: " + data);
});

client.on('error', (err) => {
    console.error("Direct connection error: ", err);
});

client.on('close', () => {
    console.log("Direct connection CLOSED by remote server.");
});
