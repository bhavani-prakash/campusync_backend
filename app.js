const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security Middleware - allow cross-origin resource access
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Robust CORS configuration supporting Vercel, Netlify, Render & Localhost
app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    const clientEnv = process.env.CLIENT_URL || '';
    const configuredOrigins = clientEnv.split(',').map(url => url.trim().replace(/\/$/, ''));
    const cleanOrigin = origin.replace(/\/$/, '');

    const isLocalhost = cleanOrigin.includes('localhost') || cleanOrigin.includes('127.0.0.1');
    const isAllowedDomain = cleanOrigin.endsWith('.vercel.app') || 
                            cleanOrigin.endsWith('.netlify.app') || 
                            cleanOrigin.endsWith('.onrender.com');
    const isConfigured = configuredOrigins.some(allowed => allowed === cleanOrigin);

    if (isConfigured || isAllowedDomain || isLocalhost || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
    return callback(new Error(`CORS Policy violation: ${origin} not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL Injection & XSS Sanitization
app.use(require('./middleware/sanitize'));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api', require('./routes/discoverRoutes'));
app.use('/api', require('./routes/matchRoutes'));
app.use('/api', require('./routes/chatRoutes'));
app.use('/api', require('./routes/safetyRoutes'));
app.use('/api', require('./routes/notificationRoutes'));
app.use('/api', require('./routes/adminRoutes'));

// Health Check API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CampusSync Backend API is running smoothly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 Handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    errorCode: 'NOT_FOUND'
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Something went wrong on the server';

  res.status(statusCode).json({
    success: false,
    message: message,
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

module.exports = app;
