const mongoose = require('mongoose');
const Queue = require('../server/models/Queue');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const DEMO_MERCHANT_ID = '507f1f77bcf86cd799439011';

// Generate realistic demo data for the past 30 days
async function createAnalyticsData() {
    try {
        console.log('🎯 Creating analytics demo data...');

        // Clear existing demo data for this merchant
        await Queue.deleteMany({ merchantId: DEMO_MERCHANT_ID });
        console.log('✅ Cleared existing demo data');

        // Create a main queue for the restaurant
        const demoEntries = [];
        const now = new Date();
        
        // Generate data for the past 30 days
        for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
            const date = new Date(now);
            date.setDate(date.getDate() - dayOffset);
            
            // Skip Sundays (closed day)
            if (date.getDay() === 0) continue;
            
            // Determine business hours based on day
            let openHour, closeHour;
            if (date.getDay() === 5) { // Friday
                openHour = 9;
                closeHour = 21; // 9 PM
            } else if (date.getDay() === 6) { // Saturday
                openHour = 10;
                closeHour = 21; // 9 PM
            } else { // Monday-Thursday
                openHour = 9;
                closeHour = 18; // 6 PM
            }
            
            // Generate varying number of customers based on day type
            let baseCustomers;
            if (date.getDay() === 5 || date.getDay() === 6) { // Weekend
                baseCustomers = Math.floor(Math.random() * 25) + 35; // 35-60 customers
            } else { // Weekday
                baseCustomers = Math.floor(Math.random() * 20) + 20; // 20-40 customers
            }
            
            // Add some randomness for special days
            if (dayOffset === 7 || dayOffset === 14) { // Simulate busy days
                baseCustomers = Math.floor(baseCustomers * 1.5);
            }
            
            // Generate customers throughout the day
            for (let i = 0; i < baseCustomers; i++) {
                // Random arrival time during business hours
                const arrivalHour = Math.floor(Math.random() * (closeHour - openHour)) + openHour;
                const arrivalMinute = Math.floor(Math.random() * 60);
                
                const joinedAt = new Date(date);
                joinedAt.setHours(arrivalHour, arrivalMinute, 0, 0);
                
                // Random service time (5-25 minutes)
                const serviceTime = Math.floor(Math.random() * 20) + 5;
                const waitTime = Math.random() * 15 + 2; // 2-17 min wait
                const servedAt = new Date(joinedAt.getTime() + waitTime * 60000);
                const completedAt = new Date(servedAt.getTime() + serviceTime * 60000);
                
                // Random party size (1-6 people, weighted toward smaller groups)
                const partySize = Math.random() < 0.6 ? 
                    (Math.random() < 0.7 ? 2 : 1) : // 60% chance of 1-2 people
                    Math.floor(Math.random() * 4) + 3; // 40% chance of 3-6 people
                
                // Generate realistic names
                const firstNames = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa', 'Chris', 'Anna', 'Tom', 'Kate', 'Alex', 'Maria', 'Sam', 'Nina', 'Ben', 'Zoe'];
                const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Garcia', 'Martinez', 'Robinson'];
                const customerName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
                
                // Generate phone number
                const phoneNumber = `+1${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 9000) + 1000}`;
                
                const entry = {
                    customerId: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    customerName: customerName,
                    customerPhone: phoneNumber,
                    platform: ['whatsapp', 'web', 'messenger'][Math.floor(Math.random() * 3)],
                    position: i + 1,
                    estimatedWaitTime: Math.floor(waitTime),
                    status: 'completed',
                    serviceType: 'dining',
                    partySize: partySize,
                    joinedAt: joinedAt,
                    servedAt: servedAt,
                    completedAt: completedAt,
                    notificationCount: Math.floor(Math.random() * 3),
                    sentimentScore: Math.min(1, Math.max(-1, (Math.random() * 1.6) - 0.3)), // -0.3 to 1.0, mostly positive
                    specialRequests: Math.random() < 0.3 ? 
                        ['High chair needed', 'Wheelchair accessible', 'Birthday celebration', 'Anniversary dinner', 'Business meeting'][Math.floor(Math.random() * 5)] : 
                        '',
                    notes: Math.random() < 0.2 ? 'Regular customer' : ''
                };
                
                demoEntries.push(entry);
            }
            
            // Add some cancelled/no-show entries (5-10% of total)
            const cancelledCount = Math.floor(baseCustomers * (Math.random() * 0.05 + 0.05));
            for (let i = 0; i < cancelledCount; i++) {
                const arrivalHour = Math.floor(Math.random() * (closeHour - openHour)) + openHour;
                const arrivalMinute = Math.floor(Math.random() * 60);
                
                const joinedAt = new Date(date);
                joinedAt.setHours(arrivalHour, arrivalMinute, 0, 0);
                
                const firstNames = ['Robert', 'Jennifer', 'William', 'Linda', 'James', 'Patricia', 'Charles', 'Barbara', 'Joseph', 'Susan'];
                const lastNames = ['Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Clark'];
                const customerName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
                
                const phoneNumber = `+1${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 9000) + 1000}`;
                
                const entry = {
                    customerId: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    customerName: customerName,
                    customerPhone: phoneNumber,
                    platform: ['whatsapp', 'web', 'messenger'][Math.floor(Math.random() * 3)],
                    position: baseCustomers + i + 1,
                    estimatedWaitTime: Math.floor(Math.random() * 40) + 15,
                    status: Math.random() < 0.7 ? 'cancelled' : 'no-show',
                    serviceType: 'dining',
                    partySize: Math.floor(Math.random() * 4) + 1,
                    joinedAt: joinedAt,
                    notificationCount: Math.floor(Math.random() * 2),
                    sentimentScore: Math.min(1, Math.max(-1, (Math.random() * 1.2) - 0.8)), // More negative for cancelled
                    notes: 'Cancelled due to wait time'
                };
                
                demoEntries.push(entry);
            }
        }
        
        // Create the main queue with all entries
        const mainQueue = new Queue({
            merchantId: DEMO_MERCHANT_ID,
            name: 'Main Dining Queue',
            description: 'Primary restaurant dining queue',
            isActive: true,
            maxCapacity: 100,
            averageServiceTime: 15,
            currentServing: 0,
            entries: demoEntries,
            settings: {
                autoNotifications: true,
                notificationInterval: 5,
                allowCancellation: true,
                requireConfirmation: true,
                businessHours: {
                    start: '09:00',
                    end: '18:00',
                    timezone: 'UTC'
                }
            },
            analytics: {
                totalServed: demoEntries.filter(e => e.status === 'completed').length,
                averageWaitTime: 12,
                averageServiceTime: 15,
                customerSatisfaction: 85,
                noShowRate: 5,
                lastUpdated: new Date()
            }
        });
        
        await mainQueue.save();
        
        console.log(`✅ Created queue with ${demoEntries.length} demo entries`);
        console.log('📊 Analytics data breakdown:');
        
        // Show breakdown by status
        const statusCounts = demoEntries.reduce((acc, entry) => {
            acc[entry.status] = (acc[entry.status] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} entries`);
        });
        
        // Show date range
        const dates = demoEntries.map(e => e.joinedAt).sort();
        console.log(`📅 Date range: ${dates[0].toDateString()} to ${dates[dates.length-1].toDateString()}`);
        
        // Calculate some quick stats
        const completedEntries = demoEntries.filter(e => e.status === 'completed');
        const avgWaitTime = completedEntries.reduce((sum, e) => {
            return sum + (e.servedAt - e.joinedAt) / (1000 * 60); // minutes
        }, 0) / completedEntries.length;
        
        const avgServiceTime = completedEntries.reduce((sum, e) => {
            return sum + (e.completedAt - e.servedAt) / (1000 * 60); // minutes
        }, 0) / completedEntries.length;
        
        const totalCustomers = demoEntries.reduce((sum, e) => sum + e.partySize, 0);
        
        console.log('📈 Quick Statistics:');
        console.log(`   Average wait time: ${avgWaitTime.toFixed(1)} minutes`);
        console.log(`   Average service time: ${avgServiceTime.toFixed(1)} minutes`);
        console.log(`   Total customers served: ${totalCustomers} people`);
        console.log(`   Average party size: ${(totalCustomers / demoEntries.length).toFixed(1)} people`);
        
        // Platform breakdown
        const platformCounts = demoEntries.reduce((acc, entry) => {
            acc[entry.platform] = (acc[entry.platform] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📱 Platform breakdown:');
        Object.entries(platformCounts).forEach(([platform, count]) => {
            console.log(`   ${platform}: ${count} entries (${(count/demoEntries.length*100).toFixed(1)}%)`);
        });
        
        console.log('\n🎉 Demo analytics data created successfully!');
        console.log('🔗 Visit http://localhost:3000/dashboard/analytics to see the data visualization');
        
    } catch (error) {
        console.error('❌ Error creating analytics data:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the script
createAnalyticsData(); 