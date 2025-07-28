// Test utility functions

function generateRandomPhone() {
  const prefix = '+6019';
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return prefix + number;
}

function generateRandomName() {
  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return `${firstName} ${lastName}`;
}

function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test_${timestamp}_${random}@example.com`;
}

async function loginAsMerchant(page, email = 'demo@storehub.com', password = 'demo1234') {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

async function joinQueue(page, merchantId, customerData = {}) {
  const defaultData = {
    name: generateRandomName(),
    phone: generateRandomPhone(),
    partySize: '2',
    specialRequests: 'Test customer'
  };
  
  const data = { ...defaultData, ...customerData };
  
  await page.goto(`/queue/join/${merchantId}`);
  await page.fill('input[name="name"]', data.name);
  await page.fill('input[name="phone"]', data.phone);
  await page.fill('input[name="partySize"]', data.partySize);
  
  if (data.specialRequests) {
    await page.fill('textarea[name="specialRequests"]', data.specialRequests);
  }
  
  await page.click('button[type="submit"]');
  await page.waitForSelector('.queue-number', { timeout: 10000 });
  
  return {
    ...data,
    queueNumber: await page.locator('.queue-number').textContent(),
    position: await page.locator('.position').textContent(),
    verificationCode: await page.locator('.verification-code').textContent()
  };
}

async function waitForWebSocketMessage(page, messageType, timeout = 5000) {
  return await page.waitForFunction(
    ({ type, timeout }) => {
      return new Promise((resolve) => {
        const messages = window.wsMessages || [];
        const found = messages.find(msg => {
          try {
            const data = JSON.parse(msg.data);
            return data.type === type;
          } catch {
            return false;
          }
        });
        
        if (found) {
          resolve(found);
        } else {
          const checkInterval = setInterval(() => {
            const messages = window.wsMessages || [];
            const found = messages.find(msg => {
              try {
                const data = JSON.parse(msg.data);
                return data.type === type;
              } catch {
                return false;
              }
            });
            
            if (found) {
              clearInterval(checkInterval);
              resolve(found);
            }
          }, 100);
          
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
          }, timeout);
        }
      });
    },
    { type: messageType, timeout },
    { timeout }
  );
}

module.exports = {
  generateRandomPhone,
  generateRandomName,
  generateRandomEmail,
  loginAsMerchant,
  joinQueue,
  waitForWebSocketMessage
};