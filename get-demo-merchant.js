#!/usr/bin/env node

const prisma = require('./server/utils/prisma');

async function getDemoMerchant() {
    try {
        const merchants = await prisma.merchant.findMany({
            select: {
                id: true,
                businessName: true,
                email: true
            },
            take: 5
        });
        
        console.log('Demo merchants found:');
        merchants.forEach(merchant => {
            console.log(`ID: ${merchant.id}, Business: ${merchant.businessName}, Email: ${merchant.email}`);
        });
        
        if (merchants.length > 0) {
            console.log(`\nUsing merchant ID: ${merchants[0].id}`);
            return merchants[0].id;
        }
        
    } catch (error) {
        console.error('Error fetching demo merchant:', error);
    } finally {
        await prisma.$disconnect();
    }
}

getDemoMerchant();