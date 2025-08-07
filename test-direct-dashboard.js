// Test script to directly access dashboard and check HTML structure
const http = require('http');

const options = {
  hostname: 'admin.lvh.me',
  port: 3000,
  path: '/backoffice/dashboard',
  method: 'GET',
  headers: {
    'Cookie': 'qms_session=s%3AXxZKQoQTU5bfhiJStHj6Xr1pD2aQ0xkX.CaJQCL5YGJxJKLKlajhQ1lPQJJ3HQKNzVOCJuTvlFc0' // Use the existing session
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    // Check for key layout elements
    const hasLayout = data.includes('admin-layout');
    const hasSidebar = data.includes('sidebar');
    const hasTopBar = data.includes('top-bar');
    const hasStatsCard = data.includes('stats-card');
    
    console.log('\nHTML Analysis:');
    console.log('- Has admin-layout:', hasLayout);
    console.log('- Has sidebar:', hasSidebar);
    console.log('- Has top-bar:', hasTopBar);
    console.log('- Has stats-card:', hasStatsCard);
    
    // Check first 500 chars
    console.log('\nFirst 500 characters of HTML:');
    console.log(data.substring(0, 500));
    
    // Save to file for inspection
    require('fs').writeFileSync('dashboard-output.html', data);
    console.log('\nFull HTML saved to dashboard-output.html');
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();