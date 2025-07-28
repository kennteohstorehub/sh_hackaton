const Merchant = require('./server/models/Merchant');
const Queue = require('./server/models/Queue');
const mongoose = require('mongoose');
const config = require('./server/config');

async function findActiveMerchant() {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.mongodb.uri);
        console.log('Connected to MongoDB');

        // Find an active merchant
        const merchants = await Merchant.find({ isActive: true }).limit(5);
        console.log('\nActive Merchants:');
        merchants.forEach(m => {
            console.log(`- ${m.businessName} (ID: ${m._id || m.id})`);
        });

        // Find active queues
        const queues = await Queue.find({ isActive: true }).limit(5).populate('merchantId');
        console.log('\nActive Queues:');
        queues.forEach(q => {
            console.log(`- ${q.name} for ${q.merchantId?.businessName} (Queue ID: ${q._id}, Merchant ID: ${q.merchantId?._id || q.merchantId?.id})`);
        });

        // Close connection
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

findActiveMerchant();