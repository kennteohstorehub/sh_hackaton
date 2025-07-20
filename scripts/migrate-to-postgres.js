#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

// Initialize Prisma Client
const prisma = new PrismaClient();

// Import MongoDB models
const Merchant = require('../server/models/Merchant');
const Queue = require('../server/models/Queue');

async function migrateData() {
  try {
    console.log('Starting MongoDB to PostgreSQL migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Clear existing PostgreSQL data (optional - comment out if you want to preserve)
    console.log('Clearing existing PostgreSQL data...');
    await prisma.queueEntryFeedback.deleteMany();
    await prisma.queueEntry.deleteMany();
    await prisma.queueAnalytics.deleteMany();
    await prisma.queue.deleteMany();
    await prisma.notificationTemplate.deleteMany();
    await prisma.merchantSettings.deleteMany();
    await prisma.merchantSubscription.deleteMany();
    await prisma.merchantIntegrations.deleteMany();
    await prisma.serviceType.deleteMany();
    await prisma.businessHours.deleteMany();
    await prisma.merchantAddress.deleteMany();
    await prisma.merchant.deleteMany();

    // Migrate Merchants
    console.log('\nMigrating Merchants...');
    const merchants = await Merchant.find();
    const merchantIdMap = new Map(); // Map MongoDB _id to PostgreSQL id

    for (const merchant of merchants) {
      console.log(`Migrating merchant: ${merchant.businessName}`);
      
      // Create the merchant
      const newMerchant = await prisma.merchant.create({
        data: {
          businessName: merchant.businessName,
          email: merchant.email,
          password: merchant.password, // Already hashed
          phone: merchant.phone,
          businessType: merchant.businessType,
          timezone: merchant.timezone || 'UTC',
          isActive: merchant.isActive,
          lastLogin: merchant.lastLogin,
          emailVerified: merchant.emailVerified,
          emailVerificationToken: merchant.emailVerificationToken,
          passwordResetToken: merchant.passwordResetToken,
          passwordResetExpires: merchant.passwordResetExpires,
          createdAt: merchant.createdAt,
          updatedAt: merchant.updatedAt,
        },
      });

      // Store the ID mapping
      merchantIdMap.set(merchant._id.toString(), newMerchant.id);

      // Create address
      if (merchant.address) {
        await prisma.merchantAddress.create({
          data: {
            merchantId: newMerchant.id,
            street: merchant.address.street,
            city: merchant.address.city,
            state: merchant.address.state,
            zipCode: merchant.address.zipCode,
            country: merchant.address.country,
          },
        });
      }

      // Create business hours
      if (merchant.businessHours) {
        const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const day of daysOfWeek) {
          if (merchant.businessHours[day]) {
            await prisma.businessHours.create({
              data: {
                merchantId: newMerchant.id,
                dayOfWeek: day,
                start: merchant.businessHours[day].start,
                end: merchant.businessHours[day].end,
                closed: merchant.businessHours[day].closed || false,
              },
            });
          }
        }
      }

      // Create service types
      if (merchant.serviceTypes && merchant.serviceTypes.length > 0) {
        for (const serviceType of merchant.serviceTypes) {
          await prisma.serviceType.create({
            data: {
              merchantId: newMerchant.id,
              name: serviceType.name,
              estimatedDuration: serviceType.estimatedDuration,
              description: serviceType.description,
              isActive: serviceType.isActive !== undefined ? serviceType.isActive : true,
            },
          });
        }
      }

      // Create integrations
      if (merchant.integrations) {
        await prisma.merchantIntegrations.create({
          data: {
            merchantId: newMerchant.id,
            whatsappEnabled: merchant.integrations.whatsapp?.enabled || false,
            whatsappPhoneNumber: merchant.integrations.whatsapp?.phoneNumber,
            whatsappSessionData: merchant.integrations.whatsapp?.sessionData,
            whatsappLastConnected: merchant.integrations.whatsapp?.lastConnected,
            messengerEnabled: merchant.integrations.messenger?.enabled || false,
            messengerPageId: merchant.integrations.messenger?.pageId,
            messengerAccessToken: merchant.integrations.messenger?.accessToken,
            messengerLastConnected: merchant.integrations.messenger?.lastConnected,
          },
        });
      }

      // Create settings
      if (merchant.settings) {
        const settings = await prisma.merchantSettings.create({
          data: {
            merchantId: newMerchant.id,
            seatingCapacity: merchant.settings.capacity?.seatingCapacity || 50,
            avgMealDuration: merchant.settings.capacity?.avgMealDuration || 45,
            maxQueueSize: merchant.settings.queue?.maxQueueSize || 50,
            autoPauseThreshold: merchant.settings.queue?.autoPauseThreshold || 0.9,
            noShowTimeout: merchant.settings.queue?.noShowTimeout || 15,
            gracePeriod: merchant.settings.queue?.gracePeriod || 5,
            joinCutoffTime: merchant.settings.queue?.joinCutoffTime || 30,
            advanceBookingHours: merchant.settings.queue?.advanceBookingHours || 0,
            partySizeRegularMin: merchant.settings.queue?.partySize?.regular?.min || 1,
            partySizeRegularMax: merchant.settings.queue?.partySize?.regular?.max || 8,
            partySizePeakMin: merchant.settings.queue?.partySize?.peak?.min || 1,
            partySizePeakMax: merchant.settings.queue?.partySize?.peak?.max || 4,
            firstNotification: merchant.settings.notifications?.timing?.firstNotification || 10,
            finalNotification: merchant.settings.notifications?.timing?.finalNotification || 0,
            adjustForPeakHours: merchant.settings.notifications?.timing?.adjustForPeakHours !== false,
            sendNoShowWarning: merchant.settings.notifications?.timing?.sendNoShowWarning !== false,
            confirmTableAcceptance: merchant.settings.notifications?.timing?.confirmTableAcceptance !== false,
            peakHours: merchant.settings.operations?.peakHours || null,
            peakMultiplier: merchant.settings.operations?.peakMultiplier || 1.5,
            priorityEnabled: merchant.settings.operations?.priority?.enabled || false,
            prioritySlots: merchant.settings.operations?.priority?.slots || 2,
            prioritySkipRegular: merchant.settings.operations?.priority?.skipRegular || false,
            priorityNotifyFirst: merchant.settings.operations?.priority?.notifyFirst || false,
            priorityLongerGrace: merchant.settings.operations?.priority?.longerGrace || false,
          },
        });

        // Create notification templates
        if (merchant.settings.notifications?.templates) {
          const templates = merchant.settings.notifications.templates;
          for (const [type, template] of Object.entries(templates)) {
            if (template) {
              await prisma.notificationTemplate.create({
                data: {
                  settingsId: settings.id,
                  type,
                  template,
                },
              });
            }
          }
        }
      }

      // Create subscription
      if (merchant.subscription) {
        await prisma.merchantSubscription.create({
          data: {
            merchantId: newMerchant.id,
            plan: merchant.subscription.plan || 'free',
            startDate: merchant.subscription.startDate || new Date(),
            endDate: merchant.subscription.endDate,
            isActive: merchant.subscription.isActive !== false,
            maxQueues: merchant.subscription.features?.maxQueues || 1,
            maxCustomersPerQueue: merchant.subscription.features?.maxCustomersPerQueue || 50,
            aiFeatures: merchant.subscription.features?.aiFeatures || false,
            analytics: merchant.subscription.features?.analytics || false,
            customBranding: merchant.subscription.features?.customBranding || false,
          },
        });
      }
    }

    // Migrate Queues
    console.log('\nMigrating Queues...');
    const queues = await Queue.find();
    
    for (const queue of queues) {
      const merchantId = merchantIdMap.get(queue.merchantId.toString());
      if (!merchantId) {
        console.warn(`Skipping queue ${queue.name} - merchant not found`);
        continue;
      }

      console.log(`Migrating queue: ${queue.name}`);

      // Get service types for this merchant
      const serviceTypes = await prisma.serviceType.findMany({
        where: { merchantId },
      });
      const serviceTypeMap = new Map(serviceTypes.map(st => [st.name, st.id]));

      // Create the queue
      const newQueue = await prisma.queue.create({
        data: {
          merchantId,
          name: queue.name,
          description: queue.description,
          isActive: queue.isActive,
          maxCapacity: queue.maxCapacity || 100,
          averageServiceTime: queue.averageServiceTime || 15,
          currentServing: queue.currentServing || 0,
          autoNotifications: queue.settings?.autoNotifications !== false,
          notificationInterval: queue.settings?.notificationInterval || 5,
          allowCancellation: queue.settings?.allowCancellation !== false,
          requireConfirmation: queue.settings?.requireConfirmation !== false,
          businessHoursStart: queue.settings?.businessHours?.start || '09:00',
          businessHoursEnd: queue.settings?.businessHours?.end || '17:00',
          businessHoursTimezone: queue.settings?.businessHours?.timezone || 'UTC',
          createdAt: queue.createdAt,
          updatedAt: queue.updatedAt,
        },
      });

      // Migrate queue entries
      if (queue.entries && queue.entries.length > 0) {
        for (const entry of queue.entries) {
          const queueEntry = await prisma.queueEntry.create({
            data: {
              queueId: newQueue.id,
              customerId: entry.customerId,
              customerName: entry.customerName,
              customerPhone: entry.customerPhone,
              platform: entry.platform || 'web',
              position: entry.position,
              estimatedWaitTime: entry.estimatedWaitTime,
              status: entry.status || 'waiting',
              priority: entry.priority || 'normal',
              serviceTypeId: serviceTypeMap.get(entry.serviceType) || null,
              partySize: entry.partySize || 1,
              notes: entry.notes,
              specialRequests: entry.specialRequests,
              joinedAt: entry.joinedAt || new Date(),
              calledAt: entry.calledAt,
              servedAt: entry.servedAt,
              completedAt: entry.completedAt,
              requeuedAt: entry.requeuedAt,
              lastNotified: entry.lastNotified,
              notificationCount: entry.notificationCount || 0,
              sentimentScore: entry.sentimentScore,
            },
          });

          // Create feedback if exists
          if (entry.feedback) {
            await prisma.queueEntryFeedback.create({
              data: {
                entryId: queueEntry.id,
                rating: entry.feedback.rating,
                comment: entry.feedback.comment,
                submittedAt: entry.feedback.submittedAt || new Date(),
              },
            });
          }
        }
      }

      // Create analytics
      if (queue.analytics) {
        await prisma.queueAnalytics.create({
          data: {
            queueId: newQueue.id,
            totalServed: queue.analytics.totalServed || 0,
            averageWaitTime: queue.analytics.averageWaitTime,
            averageServiceTime: queue.analytics.averageServiceTime,
            customerSatisfaction: queue.analytics.customerSatisfaction,
            noShowRate: queue.analytics.noShowRate,
            lastUpdated: queue.analytics.lastUpdated || new Date(),
          },
        });
      }
    }

    console.log('\nMigration completed successfully!');
    console.log(`Migrated ${merchants.length} merchants and ${queues.length} queues`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

// Run migration
migrateData();