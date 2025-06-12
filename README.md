# Smart Queue Manager 🚀

An AI-powered queue management system that reduces customer friction and manages expectations during busy peak hours by allowing customers to join and track virtual queues via WhatsApp or Facebook Messenger.

## 🌟 Features

### For Merchants
- **Real-time Dashboard**: Monitor all queues, customer status, and analytics in real-time
- **Multi-Queue Management**: Create and manage multiple service queues
- **AI-Powered Insights**: Get intelligent recommendations for queue optimization
- **WhatsApp & Messenger Integration**: Automated chatbot responses for customers
- **Analytics & Reporting**: Track performance metrics and customer satisfaction
- **Customizable Settings**: Configure business hours, service types, and notifications

### For Customers
- **Easy Queue Joining**: Join queues via WhatsApp, Messenger, or web interface
- **Real-time Updates**: Get live position updates and estimated wait times
- **Smart Notifications**: AI-optimized notification timing based on sentiment analysis
- **Multi-platform Support**: Access from any device or messaging platform
- **Queue Status Tracking**: Check position and wait time anytime

### AI Features
- **Wait Time Prediction**: Machine learning-based wait time estimation
- **Sentiment Analysis**: Analyze customer messages to improve service
- **Dynamic Responses**: Context-aware chatbot conversations
- **Peak Hour Detection**: Automatic adjustment for busy periods
- **Queue Optimization**: AI-driven recommendations for better efficiency

## 🏗️ Architecture

### Backend (Node.js)
- **Express.js** server with EJS templating
- **MongoDB** for data persistence
- **Socket.IO** for real-time updates
- **WhatsApp Web.js** for WhatsApp integration
- **Natural.js** for AI/ML features

### Frontend (Server-Side Rendered)
- **EJS** templating engine
- **Responsive design** with modern UI/UX
- **Real-time updates** via WebSocket
- **Mobile-first** approach

### Integrations
- **WhatsApp Business API**
- **Facebook Messenger Platform**
- **AI/ML Services** for predictions and analysis

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- WhatsApp account for business integration

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kennteohstorehub/sh_hackaton.git
   cd sh_hackaton
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:3001
   - API: http://localhost:3001/api

## 📋 Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smart-queue-manager

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./whatsapp-session

# Facebook Messenger Configuration
FB_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
FB_VERIFY_TOKEN=your-facebook-verify-token
FB_APP_SECRET=your-facebook-app-secret

# AI Services (Optional)
OPENAI_API_KEY=your-openai-api-key
SENTIMENT_API_KEY=your-sentiment-analysis-api-key

# Notification Settings
NOTIFICATION_INTERVAL_MINUTES=5
MAX_QUEUE_SIZE=100
```

## 🎯 Usage

### For Merchants

1. **Register/Login**: Create a merchant account at `/auth/register`
2. **Setup Business**: Configure business hours, service types, and settings
3. **Create Queues**: Set up different service queues for your business
4. **Integrate Messaging**: Connect WhatsApp and/or Facebook Messenger
5. **Monitor Dashboard**: Track real-time queue status and customer activity

### For Customers

#### Via WhatsApp
- Send "join" to join a queue
- Send "status" to check position
- Send "cancel" to leave queue
- Send "help" for available commands

#### Via Web Interface
- Visit `/join/{merchantId}` to access queue joining page
- Select service type and join queue
- Track status via provided link

## 🔧 API Endpoints

### Authentication
- `POST /auth/login` - Merchant login
- `POST /auth/register` - Merchant registration
- `POST /auth/logout` - Logout

### Queue Management
- `GET /api/queue` - Get merchant's queues
- `POST /api/queue` - Create new queue
- `PUT /api/queue/:id` - Update queue
- `DELETE /api/queue/:id` - Delete queue

### Customer Operations
- `POST /api/customer/join` - Join queue
- `GET /api/customer/status/:id` - Get queue status
- `POST /api/customer/cancel` - Cancel queue position

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/patterns` - Queue pattern analysis

## 🤖 AI Features

### Wait Time Prediction
- Uses machine learning to predict accurate wait times
- Considers historical data, time of day, and queue patterns
- Automatically adjusts for peak hours and special events

### Sentiment Analysis
- Analyzes customer messages for emotional tone
- Adjusts notification timing based on customer sentiment
- Provides insights for improving customer experience

### Dynamic Chatbot
- Context-aware responses based on business type
- Personalized messages using customer data
- Multi-language support (configurable)

## 📊 Analytics & Insights

- **Real-time Metrics**: Queue length, wait times, customer satisfaction
- **Historical Analysis**: Trends, peak hours, service efficiency
- **AI Recommendations**: Optimization suggestions based on data patterns
- **Customer Feedback**: Sentiment analysis and satisfaction scores

## 🔒 Security Features

- **Session Management**: Secure session handling with MongoDB store
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation and sanitization
- **CSRF Protection**: Cross-site request forgery protection
- **Helmet.js**: Security headers and protection

## 🛠️ Server Management

Use the provided server management script for easy server control:

```bash
# Check server status
./scripts/server-manager.sh status

# Start server (handles port conflicts automatically)
./scripts/server-manager.sh start

# Stop server
./scripts/server-manager.sh stop

# Restart server
./scripts/server-manager.sh restart

# Clean up old processes (useful for WhatsApp service issues)
./scripts/server-manager.sh cleanup
```

## 🔧 Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

**Quick fixes for common problems:**

- **Port already in use**: `./scripts/server-manager.sh start` (handles automatically)
- **WhatsApp service errors**: `./scripts/server-manager.sh cleanup && ./scripts/server-manager.sh restart`
- **High CPU usage**: `pkill -f "chrome-mac/Chromium" && ./scripts/server-manager.sh restart`
- **Template errors**: Check server logs and verify all variables are passed to templates

## 🚀 Deployment

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start server/index.js --name "smart-queue-manager"
pm2 startup
pm2 save
```

### Using Docker
```bash
# Build image
docker build -t smart-queue-manager .

# Run container
docker run -p 3001:3001 -e MONGODB_URI=mongodb://host.docker.internal:27017/smart-queue-manager smart-queue-manager
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact: [your-email@example.com]

## 🎉 Acknowledgments

- Built for the Store Hub Hackathon
- Inspired by the need to reduce customer wait times and improve service efficiency
- Thanks to all contributors and the open-source community

---

**Made with ❤️ for better customer experiences** 