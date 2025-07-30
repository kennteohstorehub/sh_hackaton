#!/usr/bin/env node

const prisma = require('./server/utils/prisma');

async function checkMerchants() {
    try {
        const merchants = await prisma.merchant.findMany({
            select: {
                id: true,
                businessName: true,
                email: true,
                isActive: true
            }
        });
        
        console.log(`\nFound ${merchants.length} merchants:\n`);
        
        if (merchants.length === 0) {
            console.log('❌ No merchants found! You need to create a merchant account.');
            console.log('\nYou can run: node scripts/create-demo-merchant.js');
        } else {
            merchants.forEach(merchant => {
                console.log(`📍 ${merchant.businessName}`);
                console.log(`   ID: ${merchant.id}`);
                console.log(`   Email: ${merchant.email}`);
                console.log(`   Active: ${merchant.isActive ? '✅' : '❌'}`);
                console.log('');
            });
        }
        
        // Also check for active queues
        const queues = await prisma.queue.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                merchantId: true
            }
        });
        
        console.log(`\nFound ${queues.length} active queues:\n`);
        queues.forEach(queue => {
            console.log(`📋 ${queue.name} (Queue ID: ${queue.id})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMerchants();