const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function cleanupTestCustomers() {
    try {
        // Connect to MongoDB if using Mongoose
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Connected to MongoDB');
            
            // Clean up Mongoose data
            const Queue = require('../server/models/Queue');
            const result = await Queue.updateMany(
                {},
                { 
                    $pull: { 
                        entries: { 
                            customerName: 'Test Customer' 
                        } 
                    } 
                }
            );
            console.log('Cleaned up MongoDB entries:', result.modifiedCount);
        }
        
        // Clean up Prisma data
        const deleted = await prisma.queueEntry.deleteMany({
            where: {
                customerName: 'Test Customer'
            }
        });
        
        console.log('Cleaned up PostgreSQL entries:', deleted.count);
        
        // Update queue positions
        const queues = await prisma.queue.findMany();
        for (const queue of queues) {
            const entries = await prisma.queueEntry.findMany({
                where: {
                    queueId: queue.id,
                    status: { in: ['waiting', 'called'] }
                },
                orderBy: { joinedAt: 'asc' }
            });
            
            // Update positions
            for (let i = 0; i < entries.length; i++) {
                await prisma.queueEntry.update({
                    where: { id: entries[i].id },
                    data: { position: i + 1 }
                });
            }
        }
        
        console.log('Updated queue positions');
        
    } catch (error) {
        console.error('Cleanup error:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        await prisma.$disconnect();
    }
}

cleanupTestCustomers();