#!/bin/bash

# Update whatsappBusinessAPI.js
sed -i '' "s/const Queue = require('..\/models\/Queue');/const queueService = require('.\/queueService');\nconst prisma = require('..\/utils\/prisma');/" server/services/whatsappBusinessAPI.js

# Update queueNotificationService.js
sed -i '' "s/const Queue = require('..\/models\/Queue');/const queueService = require('.\/queueService');/" server/services/queueNotificationService.js
sed -i '' "s/const Merchant = require('..\/models\/Merchant');/const merchantService = require('.\/merchantService');/" server/services/queueNotificationService.js

# Update whatsappService.js - replace inline requires
sed -i '' "s/const Queue = require('..\/models\/Queue');/const queueService = require('.\/queueService');/g" server/services/whatsappService.js

# Update whatsappService-improved.js
sed -i '' "s/const Queue = require('..\/models\/Queue');/const queueService = require('.\/queueService');/" server/services/whatsappService-improved.js

# Update customer.js to fix Queue.findById calls
sed -i '' 's/Queue\.findById/queueService.getQueueWithEntries/g' server/routes/customer.js
sed -i '' 's/Queue\.findOne/queueService.findByMerchantAndId/g' server/routes/customer.js
sed -i '' 's/Queue\.find/queueService.findByMerchant/g' server/routes/customer.js

echo "✅ All imports updated!"