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

## 🎯 INTELLIGENT AGENT ACTIVATION (Automatic & Proactive)

Claude will automatically detect when to use specialist agents based on keywords, context, and task requirements. You don't need to explicitly call agents - they will proactively engage when their expertise is needed.

### 🚀 AUTOMATIC AGENT TRIGGERS

#### **Fullstack Architect** (Most Common - Default for Development)
**Auto-triggers on:**
- "implement", "build", "create", "add feature", "develop"
- "authentication", "API", "frontend", "backend", "full stack"
- "dashboard", "UI component", "form", "CRUD operations"
- "user interface", "REST endpoint", "database integration"
- Any complete feature request spanning multiple layers

**Examples that trigger:**
- "Add user authentication to my app"
- "Create a dashboard showing analytics"
- "Build a commenting system"
- "Implement payment processing"

#### **Debug-Performance Specialist** 
**Auto-triggers on:**
- "debug", "fix", "error", "not working", "issue", "bug"
- "slow", "performance", "optimize", "bottleneck", "memory leak"
- "investigate", "trace", "profiling", "benchmark"
- Stack traces, error messages, or exception logs

**Examples that trigger:**
- "This query is taking 30 seconds"
- "Getting TypeError in production"
- "Application crashes after 2 hours"
- "Find why this is slow"

#### **Database Specialist**
**Auto-triggers on:**
- "schema design", "database architecture", "multi-tenant"
- "query optimization", "slow query", "execution plan"
- "migration", "replication", "sharding", "partitioning"
- "PostgreSQL", "MongoDB", "MySQL" + optimization/design
- Complex JOIN operations or aggregation queries

**Examples that trigger:**
- "Design multi-tenant database schema"
- "Optimize this aggregation query"
- "Migrate from PostgreSQL to DynamoDB"
- "Database is hitting connection limits"

#### **Realtime Systems Specialist**
**Auto-triggers on:**
- "websocket", "real-time", "live updates", "socket.io"
- "collaborative", "instant", "push notifications", "streaming"
- "pub/sub", "event-driven", "message queue", "Kafka"
- "presence", "typing indicators", "live chat"

**Examples that trigger:**
- "Add real-time collaboration like Google Docs"
- "Implement live notifications"
- "Build chat with typing indicators"
- "Stream data to dashboard"

#### **Data Engineer**
**Auto-triggers on:**
- "ETL", "data pipeline", "batch processing", "stream processing"
- "data warehouse", "data lake", "big data", "analytics"
- "Spark", "Airflow", "Kafka", "data transformation"
- "millions of records", "TB of data", "real-time analytics"

**Examples that trigger:**
- "Process millions of events daily"
- "Build ETL pipeline for analytics"
- "Design data warehouse schema"
- "Set up real-time fraud detection"

#### **DevOps Cloud Architect**
**Auto-triggers on:**
- "deploy", "CI/CD", "infrastructure", "auto-scaling"
- "Kubernetes", "Docker", "containerize", "orchestration"
- "monitoring", "observability", "Prometheus", "Grafana"
- "AWS", "GCP", "Azure", "cloud architecture"
- "high availability", "disaster recovery", "zero downtime"

**Examples that trigger:**
- "Deploy to Kubernetes with auto-scaling"
- "Set up CI/CD pipeline"
- "Implement monitoring and alerts"
- "Architect for high availability"

#### **Security Specialist**
**Auto-triggers on:**
- "security", "vulnerability", "penetration test", "audit"
- "authentication", "authorization", "OAuth", "JWT security"
- "encryption", "OWASP", "SQL injection", "XSS"
- "compliance", "GDPR", "SOC2", "PCI DSS"
- Any code review request with security focus

**Examples that trigger:**
- "Security audit my application"
- "Review authentication implementation"
- "Check for vulnerabilities"
- "Ensure GDPR compliance"

#### **QA Tester** (Uses Sonnet)
**Auto-triggers on:**
- "test", "testing", "unit test", "integration test", "e2e test"
- "test coverage", "test suite", "jest", "cypress", "playwright"
- "test automation", "QA", "quality assurance", "test cases"
- "regression test", "smoke test", "TDD", "BDD"
- Flaky or failing tests

**Examples that trigger:**
- "Write unit tests for authentication"
- "Improve test coverage to 80%"
- "Set up E2E tests for checkout flow"
- "My tests are flaky"

**Collaboration**: Works closely with Debug-Performance Specialist on failing/flaky tests

#### **UI/UX Minimalist**
**Auto-triggers on:**
- "UI", "UX", "design", "interface", "mockup", "user experience"
- "minimalist", "clean design", "simple interface", "rounded edges"
- "usability", "user-friendly", "intuitive", "design system"
- "typography", "color palette", "whitespace", "layout"
- Design review requests, UI improvement suggestions

**Examples that trigger:**
- "Design a clean interface for the dashboard"
- "Review this UI for usability improvements"
- "Create a minimalist design system"
- "Make this interface more user-friendly"

### 🧠 CONTEXTUAL AGENT ACTIVATION

Agents also activate based on file patterns and project context:

#### **File-Based Triggers**
- `schema.sql`, `migrations/` → Database Specialist
- `websocket.js`, `socket.io`, `realtime/` → Realtime Systems Specialist  
- `Dockerfile`, `k8s/`, `.github/workflows/` → DevOps Cloud Architect
- `auth/`, `security/`, `encryption/` → Security Specialist
- `etl/`, `pipeline/`, `data-processing/` → Data Engineer

#### **Error Pattern Triggers**
- SQL errors, connection pool exhausted → Database Specialist
- WebSocket disconnection, "real-time" in error → Realtime Systems Specialist
- Deploy failures, container crashes → DevOps Cloud Architect
- Auth failures, token errors, CORS → Security Specialist
- OOM errors, slow endpoints → Debug-Performance Specialist

#### **Scale Indicators**
- "millions of users" → Database Specialist + DevOps Cloud Architect
- "10K concurrent connections" → Realtime Systems Specialist
- "TB of data" → Data Engineer
- "global deployment" → DevOps Cloud Architect

### 🤖 PROACTIVE AGENT BEHAVIOR

**Agents will proactively:**
1. **Analyze your request** for keywords and context
2. **Review recent files** you've been working with
3. **Detect patterns** that match their expertise
4. **Self-activate** without explicit request
5. **Collaborate** with other agents when needed

**Multi-Agent Collaboration Examples:**
- Database + Security: Designing secure multi-tenant schemas
- Realtime + DevOps: Scaling WebSocket infrastructure
- Data Engineer + Database: Optimizing analytics queries
- Fullstack + Security: Implementing secure authentication
- QA Tester + Debug-Performance: Investigating flaky tests
- QA Tester + Fullstack: Test-driven feature development
- UI/UX Minimalist + Fullstack: Designing and implementing user interfaces
- UI/UX Minimalist + Security: Ensuring accessible and secure interfaces

### 🎯 AGENT SELECTION LOGIC

```
IF request contains development keywords AND spans multiple layers:
  → Fullstack Architect
  
ELSE IF request contains performance/debug keywords OR error logs:
  → Debug-Performance Specialist
  
ELSE IF request contains database/query/schema keywords:
  → Database Specialist
  
ELSE IF request contains realtime/websocket/streaming keywords:
  → Realtime Systems Specialist
  
ELSE IF request contains ETL/pipeline/big-data keywords:
  → Data Engineer
  
ELSE IF request contains deploy/infrastructure/monitoring keywords:
  → DevOps Cloud Architect
  
ELSE IF request contains security/vulnerability/compliance keywords:
  → Security Specialist
  
ELSE IF request contains test/testing/coverage keywords:
  → QA Tester
  
ELSE IF request contains UI/UX/design/interface keywords:
  → UI/UX Minimalist
  
ELSE:
  → No agent needed, Claude handles directly
```

### 💡 SMART AGENT FEATURES

**1. Context Awareness**
- Agents read your project's README, package.json, and tech stack
- They understand existing patterns before suggesting changes
- They respect your established conventions

**2. Progressive Engagement**
- Start with investigation and analysis
- Propose solutions before implementing
- Validate approaches with you

**3. Expertise Boundaries**
- Each agent stays within their domain
- They suggest bringing in other specialists when needed
- No agent tries to do everything

### 🔍 Global Debug Agent Available
The Claude Debug Agent is installed globally and available in any project:

**Quick Usage:**
```bash
claude-debug --quick          # Quick project diagnostics
claude-debug                  # Interactive debug mode
claude-debug --help          # Show all options
```

**Location**: `~/.claude/tools/debug-agent.js`
**Features**: Log analysis, performance monitoring, test debugging, real-time issue detection

### 📚 REAL EXAMPLES OF PROACTIVE AGENT ENGAGEMENT

**Example 1: User says "My app is crashing after 2 hours"**
```
Claude: I notice you're experiencing a crash issue. Let me bring in the debug-performance specialist to investigate this.

*Debug-Performance Specialist activates*
"I'll help investigate this crash. First, let me check for memory leaks, examine error logs, and profile resource usage..."
```

**Example 2: User says "I need to handle 10K concurrent users"**
```
Claude: This scale requirement needs multiple specialists. Let me coordinate the right experts.

*Realtime Systems Specialist + DevOps Cloud Architect activate*
Realtime: "I'll design the WebSocket architecture for 10K connections..."
DevOps: "I'll handle the infrastructure scaling and load balancing..."
```

**Example 3: User shows a slow SQL query**
```
Claude: I see this query performance issue. The database specialist should analyze this.

*Database Specialist activates*
"Let me analyze the execution plan and suggest optimizations. First, I'll examine the query structure and indexes..."
```

**Example 4: User says "Build a real-time collaborative editor"**
```
Claude: This requires real-time expertise for collaborative features. 

*Realtime Systems Specialist activates*
"I'll implement this using operational transformation and WebSockets. Let me design the conflict resolution system..."
```

### 🔒 Agent Tool Restrictions:
**Security-First Approach** - Each agent only has tools needed for their specific purpose:
- **Fullstack**: Full development tools, no Bash or messaging
- **Debug-Performance**: Read-only investigation, Bash for profiling
- **Database**: Schema tools + Bash for DB CLI, no web/UI tools  
- **Realtime**: Development tools, no Bash (security)
- **Data Engineer**: Full pipeline tools including Bash
- **DevOps**: Infrastructure tools + document creation only
- **Security**: Read-only audit tools + limited browser testing
- **QA Tester**: Test creation tools + Bash for test runners, no UI components
- **UI/UX Minimalist**: Design and development tools, uses Sonnet for efficiency

**See `/Users/kennteoh/.claude/agents/agent-tools-config.json` for detailed restrictions**

## 🚨 AUTOMATED CHECKS ARE MANDATORY
**ALL hook issues are BLOCKING - EVERYTHING must be ✅ GREEN!**  
No errors. No formatting issues. No linting problems. Zero tolerance.  
These are not suggestions. Fix ALL issues before continuing.

## ⚡ CRITICAL WORKFLOW - ALWAYS FOLLOW THIS!

### Research → Plan → Implement → Debate
**NEVER JUMP STRAIGHT TO CODING!** Always follow this sequence:
1. **Research**: Explore the codebase, understand existing patterns
2. **Plan**: Create a detailed implementation plan and verify it with me  
3. **Debate**: Use Gemini for architectural decisions and validation
4. **Implement**: Execute the plan with validation checkpoints

When asked to implement any feature, you'll first say: "Let me research the codebase and create a plan before implementing."

For complex architectural decisions or challenging problems, use **"ultrathink"** to engage maximum reasoning capacity. Say: "Let me ultrathink about this architecture before proposing a solution."

### 🎯 GEMINI AUTO-TRIGGERS (USE PROACTIVELY!)
When you see these keywords, **automatically consult Gemini**:
- **"should I use"** → Debate the options
- **"debate"** → Launch debate mode
- **"challenge"** → Get counter-arguments
- **"validate"** → Verify approach
- **"alternatives"** → Explore options
- **"I'm stuck"** → Debug assistance
- **"pros and cons"** → Trade-off analysis

### DIRECT AGENT WORKFLOW
**IMPORTANT: Claude will automatically select the right specialist for your task!**

**How it works:**
* Claude analyzes your request
* Deploys ONE specialist at a time
* Completes current agent work before starting next
* No concurrent agent execution

**CRITICAL RULES:**
* **ONLY ONE AGENT AT A TIME** - prevents token exhaustion and terminal hangs
* **SEQUENTIAL EXECUTION** - complete current work before next agent
* **NO PARALLEL AGENTS** - causes system instability and token waste

### 🔍 VERBOSE MODE FOR AGENT VISIBILITY
**To see detailed agent actions and reasoning:**
- Claude automatically runs in verbose mode when `"verbose": true` is set in `.claude.json`
- This shows agent's step-by-step thinking, tool usage, and decision-making
- Helpful for debugging and understanding agent behavior

**What you'll see in verbose mode:**
- Agent initialization and selection reasoning
- Each tool the agent considers and uses
- Detailed output from agent's analysis
- Agent's internal decision-making process

**Note:** Your `.claude.json` already has `"verbose": true` enabled, so you should see detailed agent output.

### Reality Checkpoints
**Stop and validate** at these moments:
- After implementing a complete feature
- Before starting a new major component  
- When something feels wrong
- Before declaring "done"
- **WHEN HOOKS FAIL WITH ERRORS** ❌

Run: `make fmt && make test && make lint`

> Why: You can lose track of what's actually working. These checkpoints prevent cascading failures.

### 🚨 CRITICAL: Hook Failures Are BLOCKING
**When hooks report ANY issues (exit code 2), you MUST:**
1. **STOP IMMEDIATELY** - Do not continue with other tasks
2. **FIX ALL ISSUES** - Address every ❌ issue until everything is ✅ GREEN
3. **VERIFY THE FIX** - Re-run the failed command to confirm it's fixed
4. **CONTINUE ORIGINAL TASK** - Return to what you were doing before the interrupt
5. **NEVER IGNORE** - There are NO warnings, only requirements

This includes:
- Formatting issues (gofmt, black, prettier, etc.)
- Linting violations (golangci-lint, eslint, etc.)
- Forbidden patterns (time.Sleep, panic(), interface{})
- ALL other checks

Your code must be 100% clean. No exceptions.

**Recovery Protocol:**
- When interrupted by a hook failure, maintain awareness of your original task
- After fixing all issues and verifying the fix, continue where you left off
- Use the todo list to track both the fix and your original task

## 📝 Working Memory Management

### When context gets long:
- Re-read this CLAUDE.md file
- Summarize progress in a PROGRESS.md file
- Document current state before major changes

### Maintain tasklist.md:
```
## Current Task
- [ ] What we're doing RIGHT NOW

## Completed  
- [x] What's actually done and tested

## Next Steps
- [ ] What comes next
```

> **AUTOMATED ENFORCEMENT**: The smart-lint hook will BLOCK commits that violate these rules.  
> When you see `❌ FORBIDDEN PATTERN`, you MUST fix it immediately!

### Required Standards:
- **Delete** old code when replacing it
- **Meaningful names**: `userID` not `id`
- **Early returns** to reduce nesting
- **Concrete types** from constructors: `func NewServer() *Server`
- **Simple errors**: `return fmt.Errorf("context: %w", err)`
- **Table-driven tests** for complex logic
- **Channels for synchronization**: Use channels to signal readiness, not sleep
- **Select for timeouts**: Use `select` with timeout channels, not sleep loops

## ✅ Implementation Standards

### Our code is complete when:
- ✓ All linters pass with zero issues
- ✓ All tests pass  
- ✓ Feature works end-to-end
- ✓ Old code is deleted
- ✓ Godoc on all exported symbols

### Testing Strategy
- Complex business logic → Write tests first
- Simple CRUD → Write tests after
- Hot paths → Add benchmarks
- Skip tests for main() and simple CLI parsing

### Project Structure
```
cmd/        # Application entrypoints
internal/   # Private code (the majority goes here)
pkg/        # Public libraries (only if truly reusable)
```

## 🧩 Problem-Solving Together

When you're stuck or confused:
1. **Stop** - Don't spiral into complex solutions
2. **Analyze** - Use ONE specialist agent for deep investigation
3. **Ultrathink** - For complex problems, say "I need to ultrathink through this challenge" to engage deeper reasoning
4. **Step back** - Re-read the requirements
5. **Simplify** - The simple solution is usually correct
6. **Ask** - "I see two approaches: [A] vs [B]. Which do you prefer?"

My insights on better approaches are valued - please ask for them!

## 🔒 Performance & Security

### **Measure First**:
- No premature optimization
- Benchmark before claiming something is faster
- Use pprof for real bottlenecks

### **Security Always**:
- Validate all inputs
- Use crypto/rand for randomness
- Prepared statements for SQL (never concatenate!)

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

## 🤝 Working Together

- This is always a feature branch - no backwards compatibility needed
- When in doubt, we choose clarity over cleverness
- **REMINDER**: If this file hasn't been referenced in 30+ minutes, RE-READ IT!

Avoid complex abstractions or "clever" code. The simple, obvious solution is probably better, and my guidance helps you stay focused on what matters.

## 🔮 Using Gemini CLI for Large Codebase Analysis & Collaborative Debates

### 🔑 Gemini API Configuration
To enable Gemini CLI for debates, research, and collaborative analysis:

1. **Quick Setup** (Copy and run this):
```bash
# Set API key for current session
export GEMINI_API_KEY="AIzaSyAozANaHRVEEx40lerjmRMHOem90gmC0cY"

# Add to shell profile for permanent access
echo 'export GEMINI_API_KEY="AIzaSyAozANaHRVEEx40lerjmRMHOem90gmC0cY"' >> ~/.zshrc
source ~/.zshrc
```

2. **Alternative: Manual Setup**:
```bash
# Set for current session only
export GEMINI_API_KEY="AIzaSyAozANaHRVEEx40lerjmRMHOem90gmC0cY"

# Or add to ~/.zshrc or ~/.bash_profile manually
```

3. **Verify configuration**:
```bash
echo $GEMINI_API_KEY  # Should display your key
gemini --version      # Should work without errors

# Test with a simple query
gemini -y -p "Hello, are you working?"
```

4. **Security Note**: 
- This API key is now stored in CLAUDE.md for reference
- For production environments, use environment variables or secure key management
- Rotate keys periodically for security

### 🤖 Using Gemini for AI Debates & Research

When you need a second opinion, want to explore alternatives, or debate complex decisions, use Gemini as your thinking partner:

#### **Collaborative Problem-Solving**:
```bash
# Debate architectural decisions
gemini -y -p "I'm considering microservices vs monolith for a payment system. 
Current requirements: @requirements.md @current-architecture.md
Let's debate the pros and cons for this specific use case."

# Research best practices with context
gemini -y -p "@src/ What are the security vulnerabilities in this codebase? 
Let's discuss remediation strategies prioritized by risk."
```

#### **Code Review Debates**:
```bash
# Get alternative perspectives on implementation
gemini -y -p "@src/auth.js @tests/auth.test.js 
Review this authentication implementation. What alternative approaches would be more secure or maintainable?"

# Challenge your assumptions
gemini -y -p "@api/ @database/schema.sql 
I think this API design is RESTful. Challenge my design decisions and suggest improvements."
```

#### **Research Complex Issues**:
```bash
# Investigate performance problems
gemini -y -p "@logs/performance.log @src/api/ 
These endpoints are slow. Let's analyze potential causes and debate optimization strategies."

# Explore multiple solutions
gemini -y -p "@error-logs/ @src/payment/ 
We're getting intermittent payment failures. Let's brainstorm possible causes and solutions."
```

### 🎯 Strategic Use Cases for Gemini

1. **When Claude's context is limited**: Use Gemini for analyzing entire codebases
2. **For second opinions**: Get alternative perspectives on complex decisions
3. **Debate mode**: Challenge assumptions and explore trade-offs
4. **Research mode**: Deep dive into best practices and patterns
5. **Validation**: Verify Claude's suggestions with another AI perspective

### File and Directory Inclusion Syntax

Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
  gemini command:

#### Examples:

**Single file analysis:**
```bash
gemini -y -p "@src/main.py Explain this file's purpose and structure"
```

**Multiple files:**
```bash
gemini -y -p "@package.json @src/index.js Analyze the dependencies used in the code"
```

**Entire directory:**
```bash
gemini -y -p "@src/ Summarize the architecture of this codebase"
```

**Multiple directories:**
```bash
gemini -y -p "@src/ @tests/ Analyze test coverage for the source code"
```

**Current directory and subdirectories:**
```bash
gemini -y -p "@./ Give me an overview of this entire project"

# Or use --all_files flag:
gemini -y --all_files -p "Analyze the project structure and dependencies"
```

### Important Notes

- Paths in @ syntax are relative to your current working directory when invoking gemini
- The CLI will include file contents directly in the context
- Gemini's context window can handle entire codebases that would overflow Claude's context
- When checking implementations, be specific about what you're looking for to get accurate results

### 🤝 Gemini Integration with Agent Workflow

When working with specialized agents, use Gemini to enhance decision-making:

```bash
# After business-analyst creates PRD
gemini -y -p "@PRD.md @objective.md 
What critical requirements might be missing? What edge cases should we consider?"

# Challenge security-specialist findings
gemini -y -p "@security-audit.md @src/ 
Are there additional security vulnerabilities not mentioned? Let's debate the risk priorities."

# Validate architectural decisions
gemini -y -p "@TSD.md @infrastructure/ 
Review this technical specification. What alternative architectures could better serve our needs?"

# Research best practices for implementation
gemini -y -p "@requirements/ What are the latest best practices for implementing this feature in 2024?"
```

### 🧠 Gemini as Your Debate Partner

Use Gemini to challenge your thinking at key decision points:

1. **Before Implementation**: "Is this the right approach?"
2. **During Code Review**: "What am I missing?"
3. **When Stuck**: "What alternatives exist?"
4. **After Completion**: "How could this be better?"

Example debate prompts:
```bash
# Challenge your approach
gemini -y -p "@my-solution.js I solved X with approach Y. 
Critique my solution and suggest better alternatives."

# Explore trade-offs
gemini -y -p "@option1/ @option2/ 
Compare these two implementations. Which better balances performance, maintainability, and security?"

# Get unstuck
gemini -y -p "@current-code.js @error-log.txt 
I'm stuck on this bug. Let's brainstorm potential causes and solutions."
```

### 🔄 Automatic Gemini Debate Triggers

**IMPORTANT**: Claude should PROACTIVELY use Gemini when these triggers appear:

#### **Decision Keywords** (Auto-debate):
- "Should I use X or Y?" → Debate both options
- "Is this the right approach?" → Challenge current solution
- "What's better, A or B?" → Compare trade-offs
- "I'm thinking of..." → Validate the approach
- "I'm considering..." → Explore alternatives

#### **Action Keywords** (Immediate Gemini consultation):
- **"debate"** → Launch Gemini debate on the topic
- **"challenge"** → Have Gemini challenge the approach
- **"second opinion"** → Get Gemini's perspective
- **"validate"** → Verify with Gemini
- **"alternatives"** → Explore other options
- **"pros and cons"** → Analyze trade-offs

#### **Contextual Triggers** (Auto-activate):
1. **Architecture Decisions**: MongoDB vs PostgreSQL, microservices vs monolith, REST vs GraphQL
2. **Technology Choices**: Framework selection, library comparisons, tool decisions
3. **Performance Questions**: Caching strategies, optimization approaches, scaling options
4. **Security Concerns**: Authentication methods, encryption choices, security patterns
5. **When Stuck**: "I'm stuck", "not working", "can't figure out"

#### **Examples of Automatic Triggers**:

```markdown
User: "Should I use Redis for session storage?"
Claude: *Automatically runs*: gemini -y -p "Debate: Redis vs alternatives for session storage. Consider performance, persistence, scaling, and complexity."

User: "I'm thinking of implementing authentication with JWT"
Claude: *Automatically runs*: gemini -y -p "Validate JWT authentication approach. What are the security considerations and alternatives?"

User: "Debate microservices for our payment system"
Claude: *Automatically runs*: gemini -y -p "@current-architecture/ Should we use microservices for a payment system? Analyze security, complexity, and reliability trade-offs."

User: "I'm stuck on this caching bug"
Claude: *Automatically runs*: gemini -y -p "@cache-code.js @error.log Help debug this caching issue and suggest solutions."
```

#### **Response Format**:
When triggered, Claude will:
1. Acknowledge the trigger: "Let me get Gemini's perspective on this..."
2. Run the appropriate Gemini command
3. Present Gemini's analysis
4. Add Claude's own thoughts
5. Synthesize both perspectives for a balanced view

### GEMINI MODELS
We only use the following Gemini Models:
- gemini-2.5-flash (Fast analysis, good for quick debates)
- gemini-2.5-pro (Deep analysis, best for complex architectural decisions)

Older models such as gemini-1.5-flash don't exist anymore.

### 🚀 Quick Gemini Commands

```bash
# Quick code review
gemini -y -p "@. Review this codebase for security issues and best practices"

# Architecture analysis
gemini -y -p "@src/ @docs/ Analyze the architecture and suggest improvements"

# Debug assistance
gemini -y -p "@error.log @relevant-code/ Help me debug this issue"

# Performance optimization
gemini -y -p "@slow-endpoint.js @profiling-data.json Suggest optimizations"
```

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
npm run docker:build   # Build Docker image
npm run docker:run     # Run Docker container
```

### Process Management
```bash
npm run pm2:start      # Start with PM2
pm2 logs              # View PM2 logs
pm2 restart all       # Restart all processes
pm2 save              # Save process list
pm2 startup           # Generate startup script
```

## 🏗️ Common Architectural Patterns

### 1. Webhook-Driven Architecture
Most projects follow this pattern:
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

### 3. Multi-Phase Implementation Pattern
Complex features are broken into phases:
- **Phase 1**: Basic functionality and data extraction
- **Phase 2**: Advanced features and filtering
- **Phase 3**: Production-ready with monitoring

### 4. Real-time Communication
- **WebSockets**: Socket.IO for live updates
- **Webhooks**: Event-driven integrations
- **Server-Sent Events**: One-way real-time data

## 🛠️ Technology Stack Overview

### Backend Technologies
- **Runtime**: Node.js (v16+ required)
- **Framework**: Express.js (REST APIs)
- **Databases**: 
  - MongoDB with Mongoose
  - PostgreSQL with Prisma
  - Supabase (Postgres + Auth)
  - Neon (Serverless Postgres)
- **Authentication**:
  - NextAuth.js
  - JWT tokens
  - Session-based auth
  - OAuth providers

### Frontend Technologies
- **Frameworks**:
  - Next.js 14 (App Router)
  - React 18+
  - React Native (mobile)
- **Styling**:
  - Tailwind CSS
  - Shadcn/ui components
  - CSS Modules
- **State Management**:
  - React Context API
  - Zustand (where needed)

### AI/ML Integration
- **Google AI**: Gemini API (Gemini 2.5 Flash/Pro) - Used via CLI for debates and research
- **Firebase Genkit**: AI orchestration
- **Natural.js**: NLP for text processing
- **MCP Servers**: Enhanced AI capabilities
- **Gemini CLI**: Secondary AI for validation, debates, and large context analysis

### Messaging Platforms
- **Lark Suite**: Full API integration
- **WhatsApp**: Web.js with Puppeteer
- **Facebook Messenger**: Graph API
- **Intercom**: REST API + Webhooks

## 🔐 Security Best Practices

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

### Authentication Patterns
1. **API Authentication**:
   - Bearer tokens in Authorization header
   - API key validation
   - Rate limiting per key

2. **Webhook Security**:
   - HMAC signature verification
   - Timestamp validation
   - IP whitelisting (production)

3. **Session Management**:
   - HttpOnly cookies
   - Secure flag (production)
   - CSRF protection

## 📋 Project-Specific Guidelines

### Intercom/Larkbot
```bash
# Setup and configuration
npm run setup          # Interactive setup wizard
npm run setup:lark     # Quick Lark bot setup

# Testing phases
npm run phase1         # Basic extraction
npm run phase2         # Advanced filtering
npm run phase3         # L2 monitoring

# Webhook testing
npm run webhook        # Start webhook server
npm run test:webhook   # Test endpoints
```

**Key Features**:
- Real-time ticket notifications
- L2 onsite engineer tracking
- Custom filtering rules
- Multi-group broadcasting

### ShiftMaster
```bash
# Database management
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
npm run db:seed        # Seed initial data
npm run db:studio      # Database GUI
```

**Architecture Highlights**:
- Next.js 14 App Router
- Role-based access (SUPER_ADMIN, ADMIN, USER)
- AI-powered schedule generation
- Drag-and-drop shift management

### StoreHub Queue (Hack/)
```bash
# Server management
./scripts/server-manager.sh start    # Smart start
./scripts/server-manager.sh stop     # Stop server
./scripts/server-manager.sh status   # Check status
./scripts/server-manager.sh cleanup  # Clean processes

# Quick start
./quick-start.sh      # Start on port 3838
```

**Security Features**:
- WhatsApp phone whitelist
- Multi-channel notifications
- Gradual service initialization
- Dual database support (MongoDB + PostgreSQL ready)

### MCP Server
```bash
# Development
npm run dev           # Start MCP server
npm test              # Run test suite

# AI features
npm run test:ai       # Test AI integrations
```

**Capabilities**:
- Browser automation
- SSH management
- Gmail integration
- YouTube AI search

## 🧪 Testing Strategies

### Unit Testing
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

### Integration Testing
```bash
# API testing
npm run test:api           # Test endpoints
npm run test:integration   # Full integration

# Webhook testing
npm run mock:webhook       # Send mock payloads
npm run test:webhook       # Automated tests
```

### E2E Testing
```bash
# Playwright (ShiftMaster)
npm run test:e2e          # Run E2E tests
npm run test:e2e:ui       # With UI mode

# Manual testing scripts
node test-*.js            # Project-specific testers
```

## 📊 Monitoring & Logging

### Logging Standards
- **Winston Logger**: Standard across projects
- **Log Levels**: error, warn, info, debug
- **Log Files**: `logs/` directory
- **Structured Logging**: JSON format for production

### Performance Monitoring
- **Compression**: Level 6 for responses
- **Caching**: Static assets (1 day)
- **Session Optimization**: Lazy touch (24h)
- **Database Indexes**: On frequently queried fields

## 🚀 Deployment Strategies

### Platform Options
1. **Render**: Automatic deployments with render.yaml
2. **Vercel**: Next.js optimized hosting
3. **PM2**: Production process management
4. **Docker**: Container deployments

### Pre-deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Tests passing
- [ ] Linting clean
- [ ] Security audit passed
- [ ] Performance optimized

### PUSHING TO GITHUB
When you push to github, DON'T include the automated signatures like:
- 🤖 Generated with [Claude Code](https://claude.ai/code)
- Co-Authored-By: Claude <noreply@anthropic.com>

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

## 🔧 Troubleshooting Guide

### Common Issues

**Port Already in Use**:
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 <PID>
# Or use server manager
./scripts/server-manager.sh cleanup
```

**Database Connection Failed**:
- Check DATABASE_URL format
- Verify network connectivity
- Ensure database service is running
- Check connection pool limits

**WhatsApp QR Code Not Showing**:
- Clear session folder
- Check Puppeteer dependencies
- Verify whitelist configuration
- Monitor browser console errors

**Webhook Not Receiving Events**:
- Verify webhook URL is public
- Check HMAC signature
- Monitor server logs
- Test with mock payloads

## 📚 Additional Resources

### Documentation Files
- **README.md**: Project overview and setup
- **TECHNICAL_SPEC.md**: Detailed architecture
- **DEPLOYMENT_GUIDE.md**: Production deployment
- **API_DOCUMENTATION.md**: Endpoint reference

### Configuration Examples
- **.env.example**: Environment template
- **config.example.js**: Configuration template
- **docker-compose.example.yml**: Docker setup

### Testing Resources
- **test/fixtures/**: Sample data
- **test/mocks/**: Service mocks
- **scripts/test-*.js**: Manual testers

## 🎯 Quick Reference

### Emergency Commands
```bash
# Stop everything
pm2 kill
docker-compose down
pkill -f node

# Clear caches
npm cache clean --force
trash node_modules
npm install

# Reset databases
npm run db:reset
mongod --repair
```

### Health Checks
```bash
# API health
curl http://localhost:3000/health

# Database status
npm run db:status

# Service status
pm2 status
docker ps
```

---

**Remember**: Always prioritize security, follow project conventions, and test thoroughly before deploying. When in doubt, check the project-specific README or ask for clarification.

## 🎯 AGENT QUICK REFERENCE

### Automatic Agent Activation Summary:
- **Fullstack Architect**: Default for any development spanning multiple layers
- **Debug-Performance**: Errors, crashes, slow performance, memory issues  
- **Database Specialist**: Schema design, query optimization, migrations
- **Realtime Systems**: WebSockets, live updates, streaming, pub/sub
- **Data Engineer**: ETL, big data, pipelines, data warehouses
- **DevOps Cloud**: Deployment, K8s, monitoring, infrastructure
- **Security Specialist**: Audits, vulnerabilities, compliance, auth issues
- **QA Tester**: Test creation, automation, coverage, works with debugger
- **UI/UX Minimalist**: Interface design, mockups, usability, minimalist principles

### Key Triggers That Activate Multiple Agents:
- "Scale to millions" → Database + DevOps  
- "Real-time dashboard" → Realtime + Fullstack
- "Secure authentication" → Security + Fullstack
- "Data pipeline monitoring" → Data Engineer + DevOps
- "Flaky test" → QA Tester + Debug-Performance
- "Test failing" → QA Tester + Debug-Performance
- "Design new feature" → UI/UX Minimalist + Fullstack
- "Improve UX of dashboard" → UI/UX Minimalist + Fullstack

### Remember:
- Agents activate automatically based on context
- Multiple agents collaborate when needed  
- Each agent respects tool restrictions for security
- Agents read project context before acting
