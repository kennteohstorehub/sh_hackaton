#!/usr/bin/env node

const prisma = require('./server/utils/prisma');
const bcrypt = require('bcryptjs');

async function restoreDemoMerchant() {
    try {
        console.log('🔄 Restoring demo merchant with AUTH_BYPASS ID...\n');
        
        const DEMO_MERCHANT_ID = '7a99f35e-0f73-4f8e-831c-fde8fc3a5532';
        
        // Check if merchant already exists
        const existing = await prisma.merchant.findUnique({
            where: { id: DEMO_MERCHANT_ID }
        });
        
        if (existing) {
            console.log('✅ Demo merchant already exists');
            return;
        }
        
        // Create merchant with specific ID
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        const merchant = await prisma.merchant.create({
            data: {
                id: DEMO_MERCHANT_ID,
                businessName: 'StoreHub Demo Restaurant',
                email: 'demo@storehub.com',
                password: hashedPassword,
                phone: '+60123456789',
                businessType: 'restaurant',
                timezone: 'Asia/Kuala_Lumpur',
                isActive: true,
                emailVerified: true
            }
        });
        
        console.log('✅ Demo merchant restored:');
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
        console.log(`   ID: ${queue.id}\n`);
        
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
        
        console.log('🎉 Dashboard restored! The AUTH_BYPASS mode will work correctly now.\n');
        console.log('📱 Access:');
        console.log('   Dashboard: http://localhost:3000/dashboard');
        console.log(`   Customer queue: http://localhost:3000/queue/${DEMO_MERCHANT_ID}\n`);
        
    } catch (error) {
        console.error('❌ Error restoring merchant:', error);
    } finally {
        await prisma.$disconnect();
    }
}

restoreDemoMerchant();