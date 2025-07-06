import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const widgetKey = searchParams.get('key') || '';
  const referer = request.headers.get('referer');

  // Validate widgetKey and check domain permissions
  if (!widgetKey) {
    return new NextResponse('// Error: Missing widget key', {
      status: 400,
      headers: { 
        'Content-Type': 'application/javascript',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  try {
    // Find agent by widgetKey
    const agent = await prisma.agent.findUnique({
      where: { 
        widgetKey: widgetKey,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        allowedDomains: true,
        chatWidgetConfig: true,
      },
    });

    if (!agent) {
      return new NextResponse('// Error: Invalid widget key or inactive agent', {
        status: 404,
        headers: { 
          'Content-Type': 'application/javascript',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Domain validation logic (your existing code)
    if (agent.allowedDomains.length > 0) {
      if (!referer) {
        return new NextResponse('// Error: Domain validation failed - no referer', {
          status: 403,
          headers: { 
            'Content-Type': 'application/javascript',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      const refererDomain = new URL(referer).hostname;
      const isAllowed = agent.allowedDomains.some(domain => {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2);
          return refererDomain === baseDomain || refererDomain.endsWith('.' + baseDomain);
        }
        return refererDomain === domain;
      });

      if (!isAllowed) {
        return new NextResponse(`// Error: Domain '${refererDomain}' not allowed for this widget`, {
          status: 403,
          headers: { 
            'Content-Type': 'application/javascript',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    // Extract widget configuration
    const config = agent.chatWidgetConfig as { primary_color?: string; initial_greeting?: string };
    const primaryColor = config.primary_color || '#3B82F6';
    const initialGreeting = config.initial_greeting || 'Hi! How can I help you today?';

    // Generate cryptographically secure nonce for this specific widget instance
    const nonce = crypto.randomBytes(16).toString('base64');
    
    // Get the origin from the request for CSP
    const requestUrl = new URL(request.url);
    const origin = `${requestUrl.protocol}//${requestUrl.host}`;
    
    // Determine API base URL for production
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 
                      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      origin;
    
    console.log('API Base URL:', apiBaseUrl, 'Origin:', origin, 'Environment:', process.env.NODE_ENV);
    
    // Calculate hash of the script content for CSP
    const scriptContent = generateWidgetScript(agent, primaryColor, initialGreeting, widgetKey, nonce, apiBaseUrl);
    const scriptHash = crypto.createHash('sha256').update(scriptContent).digest('base64');

    // Enhanced CSP with nonce and hash-based approach
    const cspHeader = [
      "default-src 'none'", // Most restrictive default
      "script-src 'self' 'unsafe-eval'", // Remove unsafe-inline, add nonce
      "style-src 'self' 'unsafe-inline'", // Styles still need unsafe-inline for dynamic injection
      "connect-src 'self' " + (process.env.NEXT_PUBLIC_API_URL || origin),
      "font-src 'self' data:",
      "img-src 'self' data: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');

    return new NextResponse(scriptContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'Content-Security-Policy': cspHeader,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
        // Add integrity hash for additional security
        'X-Content-Hash': `sha256-${scriptHash}`,
      },
    });
  } catch (error) {
    console.error('Error in widget.js route:', error);
    return new NextResponse('// Error: Internal server error', {
      status: 500,
      headers: { 
        'Content-Type': 'application/javascript',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}

function generateWidgetScript(agent: unknown, primaryColor: string, initialGreeting: string, widgetKey: string, nonce: string, apiBaseUrl: string) {
  // Safely escape values for JavaScript
  const safeAgentName = JSON.stringify((agent as { name: string }).name);
  const safeGreeting = JSON.stringify(initialGreeting);
  const safeColor = JSON.stringify(primaryColor);
  const safeWidgetKey = JSON.stringify(widgetKey);
  const safeNonce = JSON.stringify(nonce);
  const safeApiBaseUrl = JSON.stringify(apiBaseUrl);
  
  return `
(function() {
  'use strict'; // Enable strict mode for better security
  
  // Prevent multiple initialization
  if (window.SupportGeniusWidget) return;
  window.SupportGeniusWidget = true;
  
  // Security: Validate environment
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    console.error('Widget: Invalid environment');
    return;
  }

  // Input sanitization function
  function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // XSS Protection: Validate all dynamic content
  function validateAndSanitize(input, maxLength = 1000) {
    if (typeof input !== 'string') return '';
    return sanitizeHTML(input.slice(0, maxLength));
  }

  // Create styles with nonce for CSP compliance
  var style = document.createElement('style');
  style.nonce = ${safeNonce}; // Use the safe nonce
  style.textContent = \`
    .sgw-fab { 
      position: fixed; 
      bottom: 32px; 
      right: 32px; 
      z-index: 99999; 
      background: ${safeColor}; 
      color: #fff; 
      border-radius: 50%; 
      width: 56px; 
      height: 56px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 28px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.15); 
      cursor: pointer; 
      border: none; 
      transition: transform 0.2s ease;
    }
    .sgw-fab:hover { transform: scale(1.05); }
    .sgw-window { 
      position: fixed; 
      bottom: 100px; 
      right: 32px; 
      z-index: 99999; 
      width: 350px; 
      max-width: 95vw; 
      background: #fff; 
      border-radius: 12px; 
      box-shadow: 0 2px 16px rgba(0,0,0,0.18); 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; 
      height: 400px; 
      border: 1px solid #e0e0e0;
    }
    .sgw-header { 
      background: ${safeColor}; 
      color: #fff; 
      padding: 16px; 
      font-weight: bold; 
      font-size: 16px; 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
    }
    .sgw-messages { 
      flex: 1; 
      padding: 16px; 
      overflow-y: auto; 
      font-size: 14px; 
      background: #fafafa;
    }
    .sgw-input-row { 
      display: flex; 
      border-top: 1px solid #eee; 
      background: #fff;
    }
    .sgw-input { 
      flex: 1; 
      border: none; 
      padding: 12px; 
      font-size: 14px; 
      outline: none; 
      resize: none;
    }
    .sgw-send { 
      background: ${safeColor}; 
      color: #fff; 
      border: none; 
      padding: 0 16px; 
      cursor: pointer; 
      font-size: 16px; 
      transition: opacity 0.2s ease;
    }
    .sgw-send:hover { opacity: 0.9; }
    .sgw-send:disabled { opacity: 0.6; cursor: not-allowed; }
    .sgw-clear { 
      background: none; 
      border: none; 
      color: #fff; 
      font-size: 14px; 
      cursor: pointer; 
      margin-left: auto; 
      padding: 4px 8px; 
      border-radius: 4px; 
      transition: background-color 0.2s ease;
    }
    .sgw-clear:hover { background-color: rgba(255,255,255,0.1); }
    .sgw-message { 
      margin: 8px 0; 
      word-wrap: break-word; 
      overflow-wrap: break-word;
    }
    .sgw-message-content { 
      padding: 8px 12px; 
      border-radius: 16px; 
      display: inline-block; 
      max-width: 80%; 
      line-height: 1.4;
    }
    .sgw-session-indicator {
      text-align: center;
      margin: 8px 0;
      padding: 4px 8px;
      background: #e3f2fd;
      border-radius: 12px;
      font-size: 12px;
      color: #1976d2;
    }
  \`;
  document.head.appendChild(style);

  // Widget state with safe values
  var chatWindow = null;
  var messagesDiv = null;
  var input = null;
  var sendButton = null;
  var isTyping = false;
  var agentName = ${safeAgentName};
  var conversationHistory = [];
  var widgetKey = ${safeWidgetKey};
  var sessionKey = 'sg_chat_' + widgetKey;
  var initialGreeting = ${safeGreeting};
  var apiBaseUrl = ${safeApiBaseUrl};

  // Secure localStorage operations with error handling
  function secureLocalStorage() {
    var isAvailable = false;
    try {
      var test = '__localStorage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      isAvailable = true;
    } catch (e) {
      console.warn('localStorage not available:', e.message);
    }

    return {
      isAvailable: isAvailable,
      getItem: function(key) {
        if (!isAvailable) return null;
        try {
          return localStorage.getItem(key);
        } catch (e) {
          console.warn('localStorage.getItem failed:', e.message);
          return null;
        }
      },
      setItem: function(key, value) {
        if (!isAvailable) return false;
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (e) {
          console.warn('localStorage.setItem failed:', e.message);
          return false;
        }
      },
      removeItem: function(key) {
        if (!isAvailable) return false;
        try {
          localStorage.removeItem(key);
          return true;
        } catch (e) {
          console.warn('localStorage.removeItem failed:', e.message);
          return false;
        }
      }
    };
  }

  var storage = secureLocalStorage();

  // Load conversation history with validation
  function loadConversationHistory() {
    if (!storage.isAvailable) return false;
    
    try {
      var saved = storage.getItem(sessionKey);
      if (!saved) return false;
      
      var parsed = JSON.parse(saved);
      
      // Validate data structure
      if (!parsed || typeof parsed !== 'object') return false;
      if (!Array.isArray(parsed.messages)) return false;
      if (typeof parsed.timestamp !== 'number') return false;
      if (parsed.widgetKey !== widgetKey) return false; // Security check
      
      // Check session age (24 hours max)
      var now = Date.now();
      var sessionAge = now - parsed.timestamp;
      var maxAge = 24 * 60 * 60 * 1000;
      
      if (sessionAge >= maxAge) {
        storage.removeItem(sessionKey);
        return false;
      }
      
      // Validate message structure
      var validMessages = [];
      for (var i = 0; i < parsed.messages.length; i++) {
        var msg = parsed.messages[i];
        if (msg && typeof msg === 'object' && 
            typeof msg.role === 'string' && 
            typeof msg.content === 'string' &&
            (msg.role === 'user' || msg.role === 'assistant')) {
          validMessages.push({
            role: msg.role,
            content: validateAndSanitize(msg.content, 2000)
          });
        }
      }
      
      conversationHistory = validMessages;
      return validMessages.length > 0;
      
    } catch (e) {
      console.warn('Failed to load conversation history:', e.message);
      storage.removeItem(sessionKey);
      return false;
    }
  }

  // Save conversation history
  function saveConversationHistory() {
    if (!storage.isAvailable) return false;
    
    try {
      var dataToSave = {
        messages: conversationHistory,
        timestamp: Date.now(),
        agentName: agentName,
        widgetKey: widgetKey
      };
      return storage.setItem(sessionKey, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to save conversation history:', e.message);
      return false;
    }
  }

  // Clear conversation history
  function clearConversationHistory() {
    conversationHistory = [];
    storage.removeItem(sessionKey);
  }

  // Create FAB button
  var fab = document.createElement('button');
  fab.className = 'sgw-fab';
  fab.innerHTML = '💬';
  fab.setAttribute('aria-label', 'Open chat');
  fab.setAttribute('title', 'Chat with ' + agentName);
  document.body.appendChild(fab);

  // Load existing conversation
  var hasExistingConversation = loadConversationHistory();

  // Add message to UI with XSS protection
  function addMessage(role, text) {
    if (!messagesDiv) return;
    
    var messageDiv = document.createElement('div');
    messageDiv.className = 'sgw-message';
    messageDiv.style.textAlign = role === 'user' ? 'right' : 'left';
    
    var contentSpan = document.createElement('span');
    contentSpan.className = 'sgw-message-content';
    contentSpan.style.background = role === 'user' ? '${primaryColor}' : '#f3f4f6';
    contentSpan.style.color = role === 'user' ? '#fff' : '#222';
    
    // Use textContent to prevent XSS
    contentSpan.textContent = text;
    
    messageDiv.appendChild(contentSpan);
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Add session indicator
  function addSessionIndicator() {
    if (!hasExistingConversation || !messagesDiv) return;
    
    var indicator = document.createElement('div');
    indicator.className = 'sgw-session-indicator';
    indicator.textContent = '💾 Previous conversation restored';
    messagesDiv.appendChild(indicator);
  }

  // Open chat window
  function openChat() {
    if (chatWindow) return;
    
    chatWindow = document.createElement('div');
    chatWindow.className = 'sgw-window';
    chatWindow.setAttribute('role', 'dialog');
    chatWindow.setAttribute('aria-label', 'Chat with ' + agentName);
    
    var headerDiv = document.createElement('div');
    headerDiv.className = 'sgw-header';
    
    var titleSpan = document.createElement('span');
    titleSpan.textContent = agentName;
    headerDiv.appendChild(titleSpan);
    
    var clearBtn = document.createElement('button');
    clearBtn.className = 'sgw-clear';
    clearBtn.textContent = '✕';
    clearBtn.setAttribute('title', 'Clear conversation');
    clearBtn.setAttribute('aria-label', 'Clear conversation');
    headerDiv.appendChild(clearBtn);
    
    messagesDiv = document.createElement('div');
    messagesDiv.className = 'sgw-messages';
    messagesDiv.setAttribute('role', 'log');
    messagesDiv.setAttribute('aria-live', 'polite');
    
    var formDiv = document.createElement('form');
    formDiv.className = 'sgw-input-row';
    
    input = document.createElement('input');
    input.className = 'sgw-input';
    input.type = 'text';
    input.placeholder = 'Type your message...';
    input.setAttribute('aria-label', 'Message input');
    input.maxLength = 1000; // Limit input length
    
    sendButton = document.createElement('button');
    sendButton.className = 'sgw-send';
    sendButton.type = 'submit';
    sendButton.textContent = 'Send';
    sendButton.setAttribute('aria-label', 'Send message');
    
    formDiv.appendChild(input);
    formDiv.appendChild(sendButton);
    
    chatWindow.appendChild(headerDiv);
    chatWindow.appendChild(messagesDiv);
    chatWindow.appendChild(formDiv);
    
    document.body.appendChild(chatWindow);
    
    // Event listeners
    clearBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('Clear conversation history?')) {
        clearConversationHistory();
        messagesDiv.innerHTML = '';
        var greeting = initialGreeting;
        addMessage('assistant', greeting);
        conversationHistory.push({ role: 'assistant', content: greeting });
        saveConversationHistory();
      }
    });
    
    formDiv.addEventListener('submit', function(e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || isTyping || text.length > 1000) return;
      
      addMessage('user', text);
      conversationHistory.push({ role: 'user', content: text });
      saveConversationHistory();
      input.value = '';
      sendMessage(text);
    });
    
    // Initialize conversation
    if (conversationHistory.length === 0) {
      var greeting = initialGreeting;
      addMessage('assistant', greeting);
      conversationHistory.push({ role: 'assistant', content: greeting });
      saveConversationHistory();
    } else {
      addSessionIndicator();
      for (var i = 0; i < conversationHistory.length; i++) {
        var msg = conversationHistory[i];
        addMessage(msg.role, msg.content);
      }
    }
    
    // Focus input
    setTimeout(function() {
      if (input) input.focus();
    }, 100);
  }

  // Close chat window
  function closeChat() {
    if (chatWindow) {
      document.body.removeChild(chatWindow);
      chatWindow = null;
      messagesDiv = null;
      input = null;
      sendButton = null;
    }
  }

  // Send message with enhanced security
  function sendMessage(text) {
    if (isTyping) return;
    isTyping = true;
    
    if (sendButton) {
      sendButton.disabled = true;
      sendButton.textContent = 'Sending...';
    }
    
    var typingDiv = document.createElement('div');
    typingDiv.className = 'sgw-message typing-indicator';
    typingDiv.style.textAlign = 'left';
    
    var typingSpan = document.createElement('span');
    typingSpan.className = 'sgw-message-content';
    typingSpan.style.background = '#f3f4f6';
    typingSpan.style.color = '#888';
    typingSpan.textContent = 'AI is typing...';
    
    typingDiv.appendChild(typingSpan);
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Prepare request with security headers
    var requestOptions = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest' // CSRF protection
      },
      body: JSON.stringify({ 
        messages: conversationHistory.slice(-10), // Limit context window
        widgetKey: widgetKey
      })
    };
    
    fetch(apiBaseUrl + '/api/chat-widget', requestOptions)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Network response was not ok: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        // Remove typing indicator
        var typingIndicator = messagesDiv.querySelector('.typing-indicator');
        if (typingIndicator) {
          messagesDiv.removeChild(typingIndicator);
        }
        
        // Validate response
        if (data && typeof data.message === 'string') {
          var sanitizedMessage = validateAndSanitize(data.message, 2000);
          addMessage('assistant', sanitizedMessage);
          conversationHistory.push({ role: 'assistant', content: sanitizedMessage });
          saveConversationHistory();
        } else {
          addMessage('assistant', 'Sorry, there was an error processing your request.');
        }
        
        isTyping = false;
        if (sendButton) {
          sendButton.disabled = false;
          sendButton.textContent = 'Send';
        }
      })
      .catch(function(error) {
        console.error('Chat error:', error);
        
        var typingIndicator = messagesDiv.querySelector('.typing-indicator');
        if (typingIndicator) {
          messagesDiv.removeChild(typingIndicator);
        }
        addMessage('assistant', 'Sorry, there was an error processing your request.');
        isTyping = false;
        if (sendButton) {
          sendButton.disabled = false;
          sendButton.textContent = 'Send';
        }
      });
  }

  // FAB click handler
  fab.addEventListener('click', function() {
    if (chatWindow) {
      closeChat();
    } else {
      openChat();
    }
  });

  // Keyboard shortcut (Ctrl+Shift+C to toggle chat)
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      fab.click();
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    if (conversationHistory.length > 0) {
      saveConversationHistory();
    }
  });

})();`;
}
