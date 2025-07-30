#!/usr/bin/env node

const prisma = require('./server/utils/prisma');
const bcrypt = require('bcryptjs');

async function createFreshMerchant() {
    try {
        console.log('🏪 Creating fresh merchant account...\n');
        
        // Create merchant
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        const merchant = await prisma.merchant.create({
            data: {
                businessName: 'StoreHub Restaurant',
                email: 'admin@storehub.com',
                password: hashedPassword,
                phone: '+60123456789',
                businessType: 'restaurant',
                timezone: 'Asia/Kuala_Lumpur',
                isActive: true,
                emailVerified: true
            }
        });
        
        console.log('✅ Merchant created:');
        console.log(`   Name: ${merchant.businessName}`);
        console.log(`   Email: ${merchant.email}`);
        console.log(`   Password: password123`);
        console.log(`   ID: ${merchant.id}\n`);
        
        // Create default queue
        const queue = await prisma.queue.create({
            data: {
                merchantId: merchant.id,
                name: 'Main Queue',
                description: 'Default queue for walk-in customers',
                isActive: true,
                acceptingCustomers: true,
                maxCapacity: 50,
                averageServiceTime: 15,
                autoNotifications: false,
                notificationInterval: 10,
                allowCancellation: true,
                requireConfirmation: false,
                businessHoursStart: '09:00',
                businessHoursEnd: '22:00',
                businessHoursTimezone: 'Asia/Kuala_Lumpur'
            }
        });
        
        console.log('✅ Queue created:');
        console.log(`   Name: ${queue.name}`);
        console.log(`   ID: ${queue.id}`);
        console.log(`   Status: ${queue.acceptingCustomers ? 'Accepting customers' : 'Not accepting'}\n`);
        
        // Create queue analytics
        await prisma.queueAnalytics.create({
            data: {
                queueId: queue.id,
                totalServed: 0,
                averageWaitTime: 0,
                averageServiceTime: 15,
                customerSatisfaction: 0,
                noShowRate: 0
            }
        });
        
        console.log('📊 Analytics initialized\n');
        
        console.log('🎉 Setup complete! You can now:');
        console.log('   1. Login at http://localhost:3838/login');
        console.log('   2. Email: admin@storehub.com');
        console.log('   3. Password: password123\n');
        
        console.log('📱 Customer queue link:');
        console.log(`   http://localhost:3838/queue/${merchant.id}\n`);
        
    } catch (error) {
        console.error('❌ Error creating merchant:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createFreshMerchant();