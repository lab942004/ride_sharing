require('dotenv').config();

const express    = require('express');
const http       = require('http');
const path       = require('path');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');

const { errorHandler, notFound }  = require('./middleware/error.middleware');
const { globalLimiter }           = require('./middleware/rateLimit.middleware');
const authRoutes                  = require('./routes/auth.routes');
const rideRoutes                  = require('./routes/ride.routes');
const requestRoutes               = require('./routes/request.routes');
const chatRoutes                  = require('./routes/chat.routes');
const profileRoutes               = require('./routes/profile.routes');
const adminAuthRoutes             = require('./routes/adminAuth.routes');
const adminRoutes                 = require('./routes/admin.routes');
const publicRoutes                = require('./routes/public.routes');
const geocodeRoutes               = require('./routes/geocode.routes');
const pushRoutes                  = require('./routes/push.routes');
const initSocket                  = require('./sockets/chat.socket');
const { initCleanupJobs }         = require('./jobs/cleanup.job');
const prisma                      = require('./config/db');

// ─── Express + HTTP server ────────────────────────────────────────────────────
const app    = express();

app.set('trust proxy', 1);

const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin     : (process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
    methods    : ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout : 60_000,
  pingInterval: 25_000,
});
initSocket(io);
app.set('io', io); // make io accessible in controllers

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc  : ["'none'"],   // this is a JSON API — no HTML/JS should ever be served from here
      frameAncestors: ["'none'"],
      baseUri     : ["'none'"],
      formAction  : ["'none'"],
    },
  },
}));
app.use(cors({
  origin     : (process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
  credentials: true,
  methods    : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Request logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch { /* ignore */ }

  res.json({
    status   : 'ok',
    timestamp: new Date().toISOString(),
    env      : process.env.NODE_ENV || 'development',
    database : dbStatus,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/rides',    rideRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/chats',    chatRoutes);
app.use('/api/profile',  profileRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/domains',     publicRoutes);
app.use('/api/geocode',     geocodeRoutes);
app.use('/api/push',        pushRoutes);


app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RideShare backend is running',
  });
});

app.head('/', (req, res) => {
  res.sendStatus(200);
});
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ─── 404 + Error handler ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    console.log(`🚀 RideShare backend running on port ${PORT}`);
    console.log(`🌍 Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend    : ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);

    // Start background cron jobs
    initCleanupJobs();
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully…`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('👋 Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled promise rejections (prevents silent crashes)
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

module.exports = { app, server };
