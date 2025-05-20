import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { clientRoutes } from './routes/clientRoutes';
import cors from 'cors';
import { mainRoutes } from './routes/mainRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { providerRoutes } from './routes/providerRoutes';
import path from 'path';
import { configureStaticFileServing } from './middlewares/fileHandler';
import http from 'http';
import { setupSocketServer } from './server/socketServer';
import os from 'os';
const app = express();
export const prisma = new PrismaClient();

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(cors({
  origin:  '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase payload size limit for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure static file serving for uploads
configureStaticFileServing(app);

// Serve HTML test pages
app.get('/provider-booking', (req, res) => {
  res.sendFile(path.join(__dirname, 'providerBooking.html'));
});

app.get('/client-address', (req, res) => {
  res.sendFile(path.join(__dirname, 'clientaddress.html'));
});

app.get('/client-booking', (req, res) => {
  res.sendFile(path.join(__dirname, 'clientBooking.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/provider-fillup', (req, res) => {
  res.sendFile(path.join(__dirname, 'indexprovider.html'));
});

app.get('/provider-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'providerRegister.html'));
});
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});
app.get('/fetchfunctions', (req, res) => {
  res.sendFile(path.join(__dirname, 'fetchfunctions.html'));
});
// Routes
app.use('/api/provider', providerRoutes);
app.use('/api/client', clientRoutes);
app.use('/api', mainRoutes);
app.use('/api/admin', adminRoutes);
app.get('/', (req: Request, res: Response) => {
  res.send('API is running!');
});

const PORT: number = 5500;
const HOST: string = '0.0.0.0';
// Function to get all local IP addresses
function getAllLocalIpAddresses(): string[] {
  const addresses: string[] = [];
  const networks = os.networkInterfaces();
  
  for (const name of Object.keys(networks)) {
    for (const net of networks[name] || []) {
      // Only get IPv4 addresses and skip internal ones
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses.length ? addresses : ['localhost'];
}
// Setup Socket.IO server
setupSocketServer(server);

// Start the server
server.listen(PORT, (): void => {
  const localIPs = getAllLocalIpAddresses();
  console.log(`🚀 Server is running at:`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network addresses:`);
  localIPs.forEach((ip, index) => {
    console.log(`   ${index + 1}. http://${ip}:${PORT}`);
  });
  console.log(`🔌 WebSocket server is running on the same port`);
});