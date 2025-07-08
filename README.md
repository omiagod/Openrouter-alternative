# OpenRouter Alternative - AI Chat Interface

A complete, modern chat interface that replicates OpenRouter's functionality with streaming capabilities, model selection, and conversation management. Built with Next.js, TypeScript, and Tailwind CSS.

## ✨ Features

### 🚀 Core Functionality
- **Real-time streaming responses** using Server-Sent Events
- **Multiple AI model support** (GPT, Claude, Gemini, LLaMA, and more)
- **OpenAI-compatible API** endpoints
- **Conversation management** with auto-save and history
- **Responsive design** for desktop and mobile

### 🎛️ Advanced Controls
- **Parameter controls** (temperature, max tokens, top-p, penalties)
- **Model selection** with categorization and search
- **Theme support** (light, dark, system)
- **Customizable settings** and preferences

### 🔒 Privacy & Security
- **Local storage** - your data stays in your browser
- **API key security** - keys are never sent to our servers
- **No tracking** - completely private conversations

### 💻 Developer Experience
- **TypeScript** for type safety
- **Modern React** with hooks and context
- **Tailwind CSS** for styling
- **ESLint & Prettier** for code quality

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm
- OpenRouter API key ([get one here](https://openrouter.ai/keys))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/omiagod/Openrouter-alternative.git
   cd Openrouter-alternative
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your OpenRouter API key:
   ```env
   OPENROUTER_API_KEY=your_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | No* | - |
| `OPENROUTER_API_URL` | OpenRouter API base URL | No | `https://openrouter.ai/api/v1` |
| `CUSTOM_API_URL` | Custom API endpoint | No | - |
| `DEFAULT_MODEL` | Default model to use | No | `openai/gpt-3.5-turbo` |

*API key can also be entered in the UI

## 📱 Usage

### Getting Started
1. Enter your OpenRouter API key when prompted
2. Select a model from the dropdown
3. Start chatting!

### Features Guide

#### 💬 Chat Interface
- Type messages in the input field
- Press Enter to send, Shift+Enter for new lines
- Messages support full Markdown formatting
- Code blocks have syntax highlighting and copy buttons

#### 🎛️ Model Selection
- Browse models by category (GPT, Claude, Gemini, etc.)
- Search for specific models
- View model details (context length, pricing)
- Featured models are highlighted

#### ⚙️ Settings
- **General**: Theme, font size, display options
- **Parameters**: Temperature, max tokens, top-p, penalties
- **Data**: Export/import conversations, clear data

## 🛠️ Development

### Project Structure
```
src/
├── components/          # React components
├── pages/              # Next.js pages & API routes
├── lib/                # Utility functions
├── store/              # State management
├── types/              # TypeScript types
└── styles/             # CSS styles
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai) for the API
- [Next.js](https://nextjs.org) for the framework
- [Tailwind CSS](https://tailwindcss.com) for styling

---

Made with ❤️ for the AI community