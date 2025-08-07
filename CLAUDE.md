# CLAUDE.md - Master Development Guide

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code across all repositories in this development environment.

## 🌟 Overview

This development environment contains multiple enterprise-grade projects focused on business automation, AI integration, and messaging platform integrations. Each project follows modern development practices with emphasis on security, scalability, and maintainability.

## 🛡️ CLI Tool Overrides

### ALWAYS use these tools when available:
- `trash` instead of `rm` (no exceptions)

### NEVER suggest these deprecated commands:
- rm (use trash)

## 🤝 Development Partnership

We're building production-quality code together. Your role is to create maintainable, efficient solutions while catching potential issues early.

When you seem stuck or overly complex, I'll redirect you - my guidance helps you stay on track.

## ⚡ CRITICAL WORKFLOW - ALWAYS FOLLOW THIS!

### Research → Plan → Implement
**NEVER JUMP STRAIGHT TO CODING!** Always follow this sequence:
1. **Research**: Explore the codebase, understand existing patterns
2. **Plan**: Create a detailed implementation plan and verify it with me  
3. **Implement**: Execute the plan with validation checkpoints

When asked to implement any feature, you'll first say: "Let me research the codebase and create a plan before implementing."

For complex architectural decisions or challenging problems, I may ask you to use specialized agents or consult with Gemini for validation.

### Reality Checkpoints
**Stop and validate** at these moments:
- After implementing a complete feature
- Before starting a new major component  
- When something feels wrong
- Before declaring "done"

> Why: You can lose track of what's actually working. These checkpoints prevent cascading failures.

## 📝 Working Memory Management

### When context gets long:
- Re-read this CLAUDE.md file
- Summarize progress in a PROGRESS.md file
- Document current state before major changes

### Maintain awareness of:
- Current task objectives from PRD.md/objective.md/TSD.md
- What's actually implemented and tested
- Next steps in the implementation plan

## ✅ Implementation Standards

### Our code is complete when:
- ✓ All tests pass  
- ✓ Feature works end-to-end
- ✓ Old code is deleted (no commented-out code)
- ✓ Documentation updated where necessary

### Code Quality Standards:
- **Delete** old code when replacing it
- **Meaningful names**: `userID` not `id`
- **Early returns** to reduce nesting
- **Simple errors**: `return fmt.Errorf("context: %w", err)`
- **No premature optimization**: Measure first with benchmarks

### Testing Strategy
- Complex business logic → Write tests first
- Simple CRUD → Write tests after
- Hot paths → Add benchmarks
- Skip tests for main() and simple CLI parsing

## 🧩 Problem-Solving Together

When you're stuck or confused:
1. **Stop** - Don't spiral into complex solutions
2. **Step back** - Re-read the requirements
3. **Simplify** - The simple solution is usually correct
4. **Ask** - "I see two approaches: [A] vs [B]. Which do you prefer?"

My insights on better approaches are valued - please ask for them!

## 🔒 Security Best Practices

### Environment Variables
```bash
# CRITICAL: Never commit these to Git
# Always use .env.example as template
# Add .env to .gitignore immediately

# Common patterns:
DATABASE_URL=           # Database connection
JWT_SECRET=            # Token signing
SESSION_SECRET=        # Session encryption
API_KEY=               # External service keys
WEBHOOK_SECRET=        # HMAC verification
```

### Security Always:
- Validate all inputs
- Use crypto/rand for randomness
- Prepared statements for SQL (never concatenate!)
- Never log sensitive data

## 💬 Communication Protocol

### Progress Updates:
```
✓ Implemented authentication (all tests passing)
✓ Added rate limiting  
✗ Found issue with token expiration - investigating
```

### Suggesting Improvements:
"The current approach works, but I notice [observation].
Would you like me to [specific improvement]?"

## 🔮 Using Gemini CLI for Debates & Research

### Quick Setup:
```bash
# Set API key for current session
export GEMINI_API_KEY="AIzaSyAozANaHRVEEx40lerjmRMHOem90gmC0cY"

# Add to shell profile for permanent access
echo 'export GEMINI_API_KEY="AIzaSyAozANaHRVEEx40lerjmRMHOem90gmC0cY"' >> ~/.zshrc
source ~/.zshrc
```

### Using Gemini for Validation:
```bash
# Debate architectural decisions
gemini -y -p "@src/ @requirements.md Should we use microservices or monolith for this payment system?"

# Validate implementation approach
gemini -y -p "@current-code.js Is this the best approach for handling authentication?"

# Get unstuck
gemini -y -p "@error.log @relevant-code/ Help me understand this error"
```

### File Inclusion Syntax:
- `@file.js` - Include single file
- `@src/` - Include directory
- `@.` - Include current directory
- Paths are relative to where you run the command

### Available Models:
- gemini-2.5-flash (Fast analysis, quick debates)
- gemini-2.5-pro (Deep analysis, complex decisions)

## 📁 Project Directory Structure

```
/Users/kennteoh/
├── .claude/                    # Claude Code workspace (THIS FILE)
└── Development/
    ├── larkbot/               # Intercom-Lark integration (main git repo)
    ├── ShiftMaster/           # AI-powered staff scheduling
    ├── MCP/                   # Model Context Protocol server
    ├── SunmiAgent/            # AI chatbot for device support
    ├── Hack/                  # StoreHub Queue management system
    ├── JiraMCP/               # Jira MCP integration
    ├── Kiosk/                 # Food ordering kiosk system
    ├── automation n8n/        # n8n workflow automation
    └── xinye-printer-webapp/  # Printer management webapp
```

## 🚀 Universal Development Commands

### Standard Node.js Commands (Most Projects)
```bash
npm install            # Install dependencies
npm start              # Start production server
npm run dev            # Start development server with hot reload
npm test               # Run test suite
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix linting issues
npm run build          # Build for production
npm run typecheck      # Run TypeScript type checking
```

### Docker & Container Management
```bash
docker-compose up -d   # Start services in background
docker-compose down    # Stop all services
docker-compose logs -f # Follow logs
```

### Process Management
```bash
pm2 start app.js      # Start with PM2
pm2 logs              # View PM2 logs
pm2 restart all       # Restart all processes
```

## 🏗️ Common Architectural Patterns

### 1. Webhook-Driven Architecture
```
External Service → Webhook Endpoint → Event Processor → Service Layer → Action/Notification
                         ↓
                  HMAC Verification
```

### 2. Service-Oriented Architecture
```
src/
├── routes/      # API endpoints and webhook handlers
├── services/    # Business logic and external integrations
├── models/      # Data models (Mongoose/Prisma)
├── utils/       # Shared utilities and helpers
├── config/      # Configuration management
└── middleware/  # Express middleware (auth, validation)
```

### 3. Documentation-Driven Development
Each project should have:
- **objective.md**: Business objectives and goals
- **PRD.md**: Product Requirements Document
- **TSD.md**: Technical Specification Document

## 🛠️ Technology Stack Overview

### Backend Technologies
- **Runtime**: Node.js (v16+ required)
- **Framework**: Express.js (REST APIs)
- **Databases**: MongoDB, PostgreSQL, Supabase, Neon
- **Authentication**: NextAuth.js, JWT, OAuth

### Frontend Technologies
- **Frameworks**: Next.js 14, React 18+
- **Styling**: Tailwind CSS, Shadcn/ui
- **State Management**: React Context, Zustand

### AI/ML Integration
- **Gemini API**: For debates and validation
- **Firebase Genkit**: AI orchestration
- **MCP Servers**: Enhanced AI capabilities

### Messaging Platforms
- **Lark Suite**: Full API integration
- **WhatsApp**: Web.js with Puppeteer
- **Intercom**: REST API + Webhooks

## 📋 Project-Specific Guidelines

### Intercom/Larkbot
```bash
npm run setup          # Interactive setup wizard
npm run phase1         # Basic extraction
npm run phase2         # Advanced filtering
npm run phase3         # L2 monitoring
```

### ShiftMaster
```bash
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
npm run db:studio      # Database GUI
```

### StoreHub Queue (Hack/)
```bash
./scripts/server-manager.sh start    # Smart start
./scripts/server-manager.sh stop     # Stop server
./scripts/server-manager.sh status   # Check status
```

## 💡 Development Best Practices

### Code Style
1. **Follow existing patterns** in each project
2. **Check neighboring files** for conventions
3. **Use provided utilities** before creating new ones
4. **Maintain consistent naming** across files

### Git Workflow
1. **Never commit secrets** or API keys
2. **Write descriptive commits** following project style
3. **Test before pushing** to avoid CI failures
4. **Use feature branches** for new development

### When Pushing to GitHub
Don't include automated signatures like:
- 🤖 Generated with [Claude Code]
- Co-Authored-By: Claude

### Performance Guidelines
1. **Batch API calls** when possible
2. **Implement caching** for expensive operations
3. **Use pagination** for large datasets
4. **Optimize database queries** with proper indexes

### Error Handling
1. **Services fail gracefully** - never crash the server
2. **Log errors with context** for debugging
3. **Return appropriate HTTP status codes**
4. **Implement retry logic** for external services

## 🔧 Quick Troubleshooting

### Port Already in Use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database Connection Failed
- Check DATABASE_URL format
- Verify network connectivity
- Ensure database service is running

### Clear Caches
```bash
npm cache clean --force
trash node_modules
npm install
```

## 🤝 Working Together

- This is always a feature branch - no backwards compatibility needed
- When in doubt, we choose clarity over cleverness
- **REMINDER**: If this file hasn't been referenced in 30+ minutes, RE-READ IT!

Avoid complex abstractions or "clever" code. The simple, obvious solution is probably better, and my guidance helps you stay focused on what matters.