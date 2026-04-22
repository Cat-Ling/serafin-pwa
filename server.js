import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import process from 'node:process';

function startServer(port) {
    const server = createServer(handler);

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${port} is already in use, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', e);
            process.exit(1);
        }
    });

    server.listen(port, () => {
        console.log(`
🚀 Jellyfin Music Player is running!
🔗 Local: http://localhost:${port}
        `);
    });
}

const initialPort = process.env.PORT || 3000;
startServer(Number(initialPort));
