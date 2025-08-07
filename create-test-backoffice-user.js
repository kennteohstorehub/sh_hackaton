#!/usr/bin/env node

/**
 * Create a test BackOffice user with known credentials
 */

const prisma = require('./server/utils/prisma');
const bcrypt = require('bcryptjs');

async function createTestBackOfficeUser() {
    console.log('🔧 Creating test BackOffice user...\n');
    
    try {
        const testEmail = 'testadmin@example.com';
        const testPassword = 'testpassword123'; // 8+ chars, meets validation
        const testName = 'Test Administrator';
        
        // Check if user already exists
        const existingUser = await prisma.backOfficeUser.findUnique({
            where: { email: testEmail }
        });
        
        if (existingUser) {
            console.log(`📝 User ${testEmail} already exists. Updating password...`);
            
            // Update existing user with new password
            const hashedPassword = await bcrypt.hash(testPassword, 10);
            
            const updatedUser = await prisma.backOfficeUser.update({
                where: { email: testEmail },
                data: {
                    password: hashedPassword,
                    isActive: true,
                    lastLogin: null // Reset last login
                }
            });
            
            console.log('✅ User updated successfully:');
            console.log(`   Email: ${updatedUser.email}`);
            console.log(`   Password: ${testPassword}`);
            console.log(`   Name: ${updatedUser.fullName}`);
            console.log(`   Active: ${updatedUser.isActive}`);
        } else {
            console.log(`📝 Creating new user: ${testEmail}`);
            
            const hashedPassword = await bcrypt.hash(testPassword, 10);
            
            const newUser = await prisma.backOfficeUser.create({
                data: {
                    email: testEmail,
                    fullName: testName,
                    password: hashedPassword,
                    isActive: true
                }
            });
            
            console.log('✅ User created successfully:');
            console.log(`   Email: ${newUser.email}`);
            console.log(`   Password: ${testPassword}`);
            console.log(`   Name: ${newUser.fullName}`);
            console.log(`   Active: ${newUser.isActive}`);
        }
        
        // Also update the other existing users with proper passwords
        console.log('\n🔧 Updating other users with proper passwords...');
        
        const usersToUpdate = [
            { email: 'backoffice@storehubqms.local', password: 'backoffice123456' },
            { email: 'superadmin@storehubqms.local', password: 'superadmin123456' },
            { email: 'admin@storehub.com', password: 'admin123456789' }
        ];
        
        for (const userUpdate of usersToUpdate) {
            try {
                const hashedPassword = await bcrypt.hash(userUpdate.password, 10);
                
                const updated = await prisma.backOfficeUser.updateMany({
                    where: { email: userUpdate.email },
                    data: {
                        password: hashedPassword,
                        isActive: true
                    }
                });
                
                if (updated.count > 0) {
                    console.log(`   ✅ Updated ${userUpdate.email} with password: ${userUpdate.password}`);
                } else {
                    console.log(`   ⚠️ User ${userUpdate.email} not found to update`);
                }
            } catch (error) {
                console.log(`   ❌ Failed to update ${userUpdate.email}: ${error.message}`);
            }
        }
        
        console.log('\n🎉 Test users ready! Try these credentials:');
        console.log('   testadmin@example.com / testpassword123');
        console.log('   backoffice@storehubqms.local / backoffice123456');
        console.log('   superadmin@storehubqms.local / superadmin123456');
        console.log('   admin@storehub.com / admin123456789');
        
    } catch (error) {
        console.error('❌ Error creating test user:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createTestBackOfficeUser();