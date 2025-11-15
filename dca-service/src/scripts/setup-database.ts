/**
 * Database Setup Script
 * Initializes PostgreSQL database and schema for DCA service
 */

import dotenv from 'dotenv';
import { DatabaseService } from '../services/database.service';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log('='.repeat(60));
  console.log('🗄️  DCA Service Database Setup');
  console.log('='.repeat(60));

  try {
    // Step 1: Create database if it doesn't exist
    console.log('\n📦 Step 1: Creating database if not exists...');
    await DatabaseService.createDatabaseIfNotExists();

    // Step 2: Connect to database
    console.log('\n🔌 Step 2: Connecting to database...');
    const db = DatabaseService.getInstance();
    const connected = await db.checkConnection();

    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Step 3: Initialize schema
    console.log('\n📋 Step 3: Initializing database schema...');
    await db.initializeSchema();

    // Step 4: Create users table (if it doesn't exist)
    console.log('\n👥 Step 4: Setting up users table...');
    // This is optional - in production, users table might be in a separate service
    // For now, we'll ensure it exists for foreign key constraints

    console.log('\n='.repeat(60));
    console.log('✅ Database setup completed successfully!');
    console.log('='.repeat(60));

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('\n='.repeat(60));
    console.error('❌ Database setup failed:');
    console.error(error);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run setup
setupDatabase();
