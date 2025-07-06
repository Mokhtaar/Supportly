# SupportGenius - Multi-Tenant AI Support Platform

A modern SaaS platform for creating AI-powered customer support agents with multi-tenant architecture.

## Features

- **Multi-Tenant Architecture**: Each company gets their own isolated workspace
- **AI Support Agents**: Create intelligent agents trained on your knowledge base
- **Role-Based Access Control**: Owner, Admin, and Member roles with different permissions
- **Knowledge Base Management**: Upload and process documents for agent training
- **Multiple Communication Channels**: Web chat, WhatsApp, Telegram, and API
- **Subscription Plans**: FREE, STARTER, PROFESSIONAL, and ENTERPRISE tiers

## Getting Started

### 1. Initial Setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 2. User Registration and Company Creation

The application now uses a multi-tenant model where each company (Client) can have multiple users and agents.

**New User Flow:**
1. User signs up at `/auth/signup`
2. User confirms their email
3. User signs in and is redirected to `/onboarding`
4. User creates their company and selects a plan
5. User is redirected to the dashboard

**Company Structure:**
- **Client**: Represents a company/organization
- **Users**: Belong to a client with roles (OWNER, ADMIN, MEMBER)
- **Agents**: Belong to a client, created by users
- **Knowledge Base**: Isolated per client

### 3. Role Permissions

- **OWNER**: Full access, can manage users and billing
- **ADMIN**: Can manage agents and invite users
- **MEMBER**: Can use agents and view analytics

### 4. API Endpoints

All API endpoints are now client-scoped and require proper authentication:

- `GET/POST /api/agent` - List/create agents for your company
- `GET/PUT/DELETE /api/agent/[id]` - Manage specific agent
- `POST /api/onboarding` - Create new company during signup
- `POST /api/knowledge-base/upload` - Upload documents
- `POST /api/chat` - Chat with agents

### 5. Database Schema

The multi-tenant schema includes:
- `clients` - Company information with subscription plans
- `users` - User accounts linked to clients
- `agents` - AI agents owned by clients
- `knowledge_base` - Documents scoped to agents/clients
- `chat_history` - Conversation logs
- `api_keys` - API access tokens

## Development

### Testing the Onboarding Flow

1. Clear your database (if testing): `npx prisma db push --force-reset`
2. Start the application: `npm run dev`
3. Sign up for a new account
4. Complete the onboarding process
5. Create your first AI agent

### Environment Variables

Make sure you have these environment variables set:

```
DATABASE_URL="your-postgres-url"
DIRECT_URL="your-postgres-direct-url"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
OPENAI_API_KEY="your-openai-key"
PINECONE_API_KEY="your-pinecone-key"
PINECONE_ENVIRONMENT="your-pinecone-environment"
PINECONE_INDEX="your-pinecone-index"
```

## Architecture

This is a **multi-tenant SaaS application** with:
- Client isolation at the database level
- Role-based access control
- Subscription-based limits
- Clean separation of concerns

Each client (company) operates in their own isolated workspace while sharing the same application infrastructure.

## 🚀 Features (Phase 1)

- **🤖 AI Agent Configuration**: Customize your AI assistant's name, tone, and behavior
- **📚 Knowledge Base Management**: Upload and process documents (PDF, TXT, CSV) for AI training
- **📱 WhatsApp Integration**: Connect your WhatsApp Business number for customer support
- **💬 Website Chat Widget**: Embeddable chat widget for your website with real-time responses
- **📊 Chat History**: View and manage conversation history across all channels
- **🔒 Secure Authentication**: Supabase-powered user authentication with Google OAuth support
- **👥 Multiple Sign-in Options**: Email/password and Google OAuth authentication

## 🛠 Tech Stack

- **Frontend Framework**: Next.js 15 with React and TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma Client
- **Vector Database**: Pinecone for knowledge base embeddings
- **AI**: OpenAI GPT-3.5 Turbo with Vercel AI SDK
- **Real-time**: Supabase Realtime for chat functionality
- **WhatsApp Integration**: Twilio WhatsApp Business API
- **File Processing**: PDF-parse for document processing
- **Authentication**: Supabase Auth with Google OAuth
- **Deployment**: Vercel-optimized

## 📋 Prerequisites

Before setting up SupportGenius, you'll need accounts and API keys from:

1. **Supabase** - Database and authentication
2. **OpenAI** - AI language model and embeddings
3. **Pinecone** - Vector database for knowledge base
4. **Twilio** - WhatsApp Business API integration
5. **Google Cloud Console** - For Google OAuth (optional but recommended)

## 🔧 Installation & Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd supportgenius
npm install
```

### 2. Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Update `.env` with your actual values:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/supportgenius?schema=public"

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# App Configuration
APP_URL=http://localhost:3000
```

### 3. Database Setup

#### Supabase Setup
1. Create a new Supabase project
2. Get your project URL and anon key from the project settings
3. Update your `DATABASE_URL` to point to your Supabase database

#### Generate and Deploy Database Schema

```bash
# Generate Prisma client
npx prisma generate

# Deploy database schema to Supabase
npx prisma db push
```

### 4. Google OAuth Setup (Recommended)

#### 4.1 Google Cloud Console Configuration

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Set application type to "Web application"
   - Add authorized redirect URIs:
     - `https://your-supabase-project.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback`