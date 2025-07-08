import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useChatStore } from '@/store/chatStore';
import ChatInterface from '@/components/ChatInterface';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const { apiKey, settings, initialize } = useChatStore();

  useEffect(() => {
    // Initialize the app and wait for it to complete
    const initializeApp = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-muted-foreground">Loading OpenRouter Alternative...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>OpenRouter Alternative - AI Chat Interface</title>
        <meta 
          name="description" 
          content="A complete OpenRouter-style chat interface with streaming capabilities, model selection, and conversation management." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://openrouter-alternative.vercel.app/" />
        <meta property="og:title" content="OpenRouter Alternative - AI Chat Interface" />
        <meta 
          property="og:description" 
          content="A complete OpenRouter-style chat interface with streaming capabilities, model selection, and conversation management." 
        />
        <meta property="og:image" content="/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://openrouter-alternative.vercel.app/" />
        <meta property="twitter:title" content="OpenRouter Alternative - AI Chat Interface" />
        <meta 
          property="twitter:description" 
          content="A complete OpenRouter-style chat interface with streaming capabilities, model selection, and conversation management." 
        />
        <meta property="twitter:image" content="/og-image.png" />

        {/* Theme color */}
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark light" />

        {/* Preload fonts */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/jetbrains-mono-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>

      <main className="min-h-screen bg-background">
        <ChatInterface />
      </main>
    </>
  );
}
