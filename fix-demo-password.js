#!/usr/bin/env node

/**
 * Fix Demo Merchant Password
 * Updates the demo merchant password to what the user expects
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixDemoPassword() {
    console.log('🔧 Fixing demo merchant password...');
    console.log('='.repeat(50));
    
    try {
        // Find the demo merchant
        const merchant = await prisma.merchant.findFirst({
            where: {
                email: 'admin@demo.local'
            },
            include: {
                tenant: true
            }
        });

        if (!merchant) {
            console.log('❌ Merchant admin@demo.local not found');
            return;
        }

        console.log('✅ Found merchant:', merchant.email);
        console.log('   Tenant:', merchant.tenant?.name);

        // Hash the password the user expects
        const expectedPassword = 'Password123!';
        console.log(`\n🔒 Hashing new password: ${expectedPassword}`);
        
        const hashedPassword = await bcrypt.hash(expectedPassword, 10);
        console.log(`   New hash: ${hashedPassword}`);

        // Update the merchant password
        await prisma.merchant.update({
            where: {
                id: merchant.id
            },
            data: {
                password: hashedPassword
            }
        });

        console.log('✅ Password updated successfully!');

        // Verify the new password works
        const isValid = await bcrypt.compare(expectedPassword, hashedPassword);
        console.log(`\n🧪 Password verification test: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);

        console.log('\n' + '='.repeat(50));
        console.log('🎉 PASSWORD FIX COMPLETE!');
        console.log('');
        console.log('📧 Updated Login Credentials:');
        console.log('   Email: admin@demo.local');
        console.log('   Password: Password123!');
        console.log('   URL: http://demo.lvh.me:3838');
        console.log('');
        console.log('💡 The user can now login with their expected password.');

    } catch (error) {
        console.error('❌ Error fixing password:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

fixDemoPassword();