// Comprehensive validation error debugging
const fetch = require('node-fetch');

// Test data that should work
const testCases = [
    {
        name: "Basic valid data",
        data: {
            name: "Test User",
            phone: "+60123456789",
            partySize: 2,
            specialRequests: ""
        }
    },
    {
        name: "Local phone format",
        data: {
            name: "Test User",
            phone: "0123456789",
            partySize: 2,
            specialRequests: ""
        }
    },
    {
        name: "Integer party size",
        data: {
            name: "Test User",
            phone: "+60123456789",
            partySize: "2", // String that should be parsed
            specialRequests: ""
        }
    },
    {
        name: "All required fields only",
        data: {
            name: "Test User",
            phone: "+60123456789",
            partySize: 2
        }
    }
];

async function testEndpoint(queueId) {
    console.log('\n=== Testing /api/customer/join/' + queueId + ' ===\n');
    
    for (const testCase of testCases) {
        console.log(`\nTest: ${testCase.name}`);
        console.log('Data:', JSON.stringify(testCase.data, null, 2));
        
        try {
            const response = await fetch(`http://localhost:3838/api/customer/join/${queueId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testCase.data)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                console.log('❌ FAILED:', response.status);
                console.log('Error:', JSON.stringify(result, null, 2));
                
                // If validation error, show details
                if (result.details) {
                    console.log('\nValidation details:');
                    result.details.forEach(detail => {
                        console.log(`  - Field: ${detail.path || detail.param}`);
                        console.log(`    Message: ${detail.msg}`);
                        console.log(`    Value: ${detail.value}`);
                    });
                }
            } else {
                console.log('✅ SUCCESS');
                console.log('Queue position:', result.position);
            }
        } catch (error) {
            console.log('❌ REQUEST ERROR:', error.message);
        }
    }
}

// Get actual queue ID from database
async function getActiveQueueId() {
    const prisma = require('./server/utils/prisma');
    
    try {
        // Get queue for the merchant being used
        const queue = await prisma.queue.findFirst({
            where: {
                merchantId: '3ecceb82-fb33-42c8-9d84-19eb69417e16',
                isActive: true
            }
        });
        
        if (queue) {
            console.log('Found active queue:', queue.name, 'ID:', queue.id);
            return queue.id;
        } else {
            console.log('No active queue found for merchant');
            return null;
        }
    } catch (error) {
        console.error('Database error:', error);
        return null;
    } finally {
        await prisma.$disconnect();
    }
}

// Also test what the actual validation expects
async function inspectValidation() {
    console.log('\n=== Inspecting validation rules ===\n');
    
    // Check what express-validator expects
    const { body } = require('express-validator');
    
    // Simulate the validation rules
    const validationRules = [
        body('name').trim().isLength({ min: 1, max: 100 }),
        body('phone').isMobilePhone(),
        body('partySize').optional().isInt({ min: 1, max: 20 }),
        body('specialRequests').optional().isLength({ max: 500 })
    ];
    
    console.log('Validation rules:');
    console.log('- name: required, 1-100 characters');
    console.log('- phone: must pass isMobilePhone() check');
    console.log('- partySize: optional, integer 1-20');
    console.log('- specialRequests: optional, max 500 chars');
    
    // Test phone validation specifically
    const validator = require('validator');
    const phoneTests = [
        '+60123456789',
        '60123456789',
        '0123456789',
        '+1234567890',
        '123456789'
    ];
    
    console.log('\nPhone validation tests:');
    phoneTests.forEach(phone => {
        const isValid = validator.isMobilePhone(phone);
        const isValidWithLocale = validator.isMobilePhone(phone, 'any');
        console.log(`  ${phone}: ${isValid ? '✅' : '❌'} (any locale: ${isValidWithLocale ? '✅' : '❌'})`);
    });
}

// Run all tests
async function runDebug() {
    await inspectValidation();
    
    const queueId = await getActiveQueueId();
    if (queueId) {
        await testEndpoint(queueId);
    } else {
        console.log('\nCannot test endpoint without valid queue ID');
    }
}

runDebug();