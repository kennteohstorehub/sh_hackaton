#!/usr/bin/env node

/**
 * Check and create BackOffice users for testing
 */

const prisma = require('./server/utils/prisma');
const bcrypt = require('bcryptjs');

async function checkBackOfficeUsers() {
    console.log('🔍 Checking BackOffice users...');
    
    try {
        // Check if BackOfficeUser table exists and get users
        const users = await prisma.backOfficeUser.findMany({
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                createdAt: true,
                lastLogin: true
            }
        });
        
        console.log(`📊 Found ${users.length} BackOffice users:`);
        users.forEach(user => {
            console.log(`   - ${user.email} (${user.fullName}) - ${user.isActive ? 'Active' : 'Inactive'}`);
            console.log(`     Created: ${user.createdAt.toISOString()}`);
            console.log(`     Last Login: ${user.lastLogin ? user.lastLogin.toISOString() : 'Never'}`);
        });
        
        if (users.length === 0) {
            console.log('\n📝 No BackOffice users found. Creating test user...');
            await createTestUser();
        } else {
            console.log('\n✅ BackOffice users exist. Testing authentication should work.');
        }
        
    } catch (error) {
        console.error('❌ Error checking BackOffice users:', error.message);
        
        if (error.message.includes('Unknown arg `select`') || error.message.includes('Table') || error.message.includes('does not exist')) {
            console.log('\n🔧 BackOfficeUser table might not exist. Creating it...');
            await createBackOfficeUserTable();
        }
    } finally {
        await prisma.$disconnect();
    }
}

async function createTestUser() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const user = await prisma.backOfficeUser.create({
            data: {
                email: 'admin@storehubqms.com',
                fullName: 'System Administrator',
                password: hashedPassword,
                isActive: true,
                role: 'ADMIN',
                permissions: ['SUPER_ADMIN', 'TENANT_MANAGEMENT', 'USER_MANAGEMENT', 'SYSTEM_SETTINGS']
            }
        });
        
        console.log('✅ Test BackOffice user created:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: admin123`);
        console.log(`   Name: ${user.fullName}`);
        
        // Also create a second user for testing
        const user2 = await prisma.backOfficeUser.create({
            data: {
                email: 'testadmin@example.com',
                fullName: 'Test Admin',
                password: await bcrypt.hash('password123', 10),
                isActive: true,
                role: 'ADMIN',
                permissions: ['TENANT_MANAGEMENT', 'USER_MANAGEMENT']
            }
        });
        
        console.log('✅ Second test user created:');
        console.log(`   Email: ${user2.email}`);
        console.log(`   Password: password123`);
        
        return [user, user2];
        
    } catch (error) {
        console.error('❌ Error creating test user:', error.message);
        throw error;
    }
}

async function createBackOfficeUserTable() {
    try {
        // Check if we need to create the table via Prisma migration
        console.log('🔧 Checking database schema...');
        
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%backoffice%' OR table_name LIKE '%BackOffice%'
        `;
        
        console.log('📋 BackOffice related tables:', tables);
        
        // Try to create the user manually if table doesn't exist
        if (tables.length === 0) {
            console.log('📝 Creating BackOfficeUser table manually...');
            
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "BackOfficeUser" (
                    "id" SERIAL PRIMARY KEY,
                    "email" VARCHAR(255) UNIQUE NOT NULL,
                    "fullName" VARCHAR(255) NOT NULL,
                    "password" VARCHAR(255) NOT NULL,
                    "isActive" BOOLEAN DEFAULT true,
                    "role" VARCHAR(50) DEFAULT 'ADMIN',
                    "permissions" TEXT[],
                    "lastLogin" TIMESTAMP,
                    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            console.log('✅ BackOfficeUser table created');
            
            // Now create test users
            await createTestUser();
        }
        
    } catch (error) {
        console.error('❌ Error creating BackOfficeUser table:', error.message);
        throw error;
    }
}

// Run the check
if (require.main === module) {
    checkBackOfficeUsers().catch(console.error);
}

module.exports = { checkBackOfficeUsers, createTestUser };