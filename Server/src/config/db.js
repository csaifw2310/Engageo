import mongoose from 'mongoose';
import config from './config.js';

const OPTIONS = {
  maxPoolSize: 10,        // max connections in pool
  serverSelectionTimeoutMS: 5000,  // fail fast if no server found
  socketTimeoutMS: 45000,          // close sockets after 45s of inactivity
};

const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () =>
      console.log(`MongoDB connected: ${mongoose.connection.host}`) 
    );
    mongoose.connection.on('error', (err) =>
      console.error(`MongoDB error: ${err.message}`)
    );
    mongoose.connection.on('disconnected', () =>
      console.warn('MongoDB disconnected. Attempting reconnect...')
    );

    await mongoose.connect(config.MONGODB_URI, OPTIONS);
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

// Graceful shutdown — close DB before process exits
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing MongoDB connection...`);
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT')); 
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker/cloud shutdown

export default connectDB;
