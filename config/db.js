const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const connStr = process.env.MONGODB_URI;

  try {
    if (connStr && connStr !== 'mongodb://localhost:27017/campussync' && connStr !== 'mongodb://127.0.0.1:27017/campussync') {
      console.log(`Connecting to specified MongoDB instance...`);
      const conn = await mongoose.connect(connStr);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    }

    // Try connecting to standard local URI first
    console.log(`Attempting connection to local MongoDB (127.0.0.1:27017)...`);
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/campussync', {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`MongoDB Local Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Local MongoDB service not reachable directly: ${error.message}`);
    
    // In development mode, fallback to mongodb-memory-server if available
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log(`Initializing MongoDB Memory Server for local development...`);
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create();
        const mongoUri = mongoMemoryServer.getUri();
        
        const conn = await mongoose.connect(mongoUri);
        console.log(`MongoDB Memory Server Connected: ${conn.connection.host}`);
        return;
      } catch (memErr) {
        console.error(`Failed to start MongoMemoryServer: ${memErr.message}`);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
