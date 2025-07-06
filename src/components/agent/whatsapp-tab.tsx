/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageCircle, 
  Phone, 
  Webhook, 
  Copy, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Send,
  RefreshCw
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Agent {
  id: string;
  name: string;
  whatsappNumber?: string;
  isActive: boolean;
}

interface WhatsAppTabProps {
  agent: Agent;
}

interface WhatsAppMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  timestamp: string;
}

interface WhatsAppConversation {
  sessionId: string;
  phone: string;
  messageCount: number;
  lastMessageAt: string;
  messages: WhatsAppMessage[];
}

export function WhatsAppTab({ agent }: WhatsAppTabProps) {
  const [config, setConfig] = useState({
    whatsappNumber: agent.whatsappNumber || '',
    isActive: agent.isActive || false,
  });
  const [testMessage, setTestMessage] = useState({
    phoneNumber: '',
    message: 'Hello! This is a test message from your AI assistant.',
  });
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string; messageId?: string } | null>(null);

  useEffect(() => {
    checkTwilioStatus();
    if (agent.whatsappNumber) {
      fetchConversationHistory();
    }
  }, [agent.id, agent.whatsappNumber]);

  const checkTwilioStatus = async () => {
    setConnectionStatus('checking');
    try {
      // Check if Twilio is configured by trying to access environment
      const response = await fetch('/api/whatsapp/status', {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.configured ? 'connected' : 'disconnected');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Error checking Twilio status:', error);
      setConnectionStatus('error');
    }
  };

  const fetchConversationHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/whatsapp/history?agentId=${agent.id}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
         } catch (err) {
       console.error('Error fetching conversation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/agent/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agent.name,
          whatsappNumber: config.whatsappNumber,
          isActive: config.isActive,
        }),
      });
      
      if (response.ok) {
        // Update the agent object
        Object.assign(agent, { 
          whatsappNumber: config.whatsappNumber,
          isActive: config.isActive 
        });
        
        if (config.whatsappNumber) {
          await fetchConversationHistory();
        }
             } else {
         throw new Error('Failed to save configuration');
       }
     } catch (err) {
       console.error('Error saving WhatsApp config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testMessage.phoneNumber || !testMessage.message) {
      setTestResult({ success: false, error: 'Please fill in both phone number and message' });
      return;
    }

    setIsSending(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          phoneNumber: testMessage.phoneNumber,
          message: testMessage.message,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTestResult({ 
          success: true, 
          messageId: data.messageId,
        });
        // Refresh conversation history
        setTimeout(() => fetchConversationHistory(), 1000);
      } else {
        setTestResult({ 
          success: false, 
          error: data.error || 'Failed to send message' 
        });
      }
    } catch {
      setTestResult({ 
        success: false, 
        error: 'Network error occurred' 
      });
    } finally {
      setIsSending(false);
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/whatsapp/webhook/${agent.id}`;
    navigator.clipboard.writeText(webhookUrl);
  };

  const generateVerifyToken = () => {
    return `supportgenius_${agent.id.slice(0, 8)}`;
  };

  const getStatusColor = (status: typeof connectionStatus) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'checking': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: typeof connectionStatus) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'checking': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: typeof connectionStatus) => {
    switch (status) {
      case 'connected': return 'Twilio Connected';
      case 'checking': return 'Checking...';
      case 'error': return 'Twilio Error';
      default: return 'Twilio Not Configured';
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    return phone.replace('whatsapp:', '').replace('+', '');
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp Integration (Twilio)
              </CardTitle>
              <CardDescription>
                Connect your WhatsApp Business via Twilio to enable AI-powered customer support
              </CardDescription>
            </div>
            <div className={`flex items-center gap-2 ${getStatusColor(connectionStatus)}`}>
              {getStatusIcon(connectionStatus)}
              <span className="font-medium">{getStatusText(connectionStatus)}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Agent Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Agent WhatsApp Configuration
          </CardTitle>
          <CardDescription>
            Configure this agent&apos;s WhatsApp number and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">WhatsApp Business Number</Label>
            <Input
              id="whatsappNumber"
              placeholder="+1234567890"
              value={config.whatsappNumber}
              onChange={(e) => setConfig(prev => ({ ...prev, whatsappNumber: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              The WhatsApp Business number associated with your Twilio account
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={config.isActive}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Enable WhatsApp for this agent</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button variant="outline" onClick={checkTwilioStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Twilio Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure Twilio webhooks for incoming WhatsApp messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook/${agent.id}`}
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL to your Twilio WhatsApp sandbox or phone number webhook configuration
            </p>
          </div>

          <div className="space-y-2">
            <Label>Verify Token</Label>
            <Input
              value={generateVerifyToken()}
              readOnly
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use this token for webhook verification (automatically generated from agent ID)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test WhatsApp Message
          </CardTitle>
          <CardDescription>
            Send a test message to verify your WhatsApp integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="testPhoneNumber">Test Phone Number</Label>
              <Input
                id="testPhoneNumber"
                placeholder="+1234567890"
                value={testMessage.phoneNumber}
                onChange={(e) => setTestMessage(prev => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={handleSendTestMessage} 
                disabled={isSending || !config.whatsappNumber}
                className="w-full"
              >
                {isSending ? 'Sending...' : 'Send Test Message'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="testMessage">Test Message</Label>
            <Textarea
              id="testMessage"
              placeholder="Type your test message here..."
              value={testMessage.message}
              onChange={(e) => setTestMessage(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
            />
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg border ${
              testResult.success 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {testResult.success ? 'Message sent successfully!' : 'Failed to send message'}
                </span>
              </div>
              {testResult.messageId && (
                <p className="text-sm mt-1">Message ID: {testResult.messageId}</p>
              )}
              {testResult.error && (
                <p className="text-sm mt-1">{testResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation History */}
      {/* <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                WhatsApp Conversations
              </CardTitle>
              <CardDescription>
                Recent WhatsApp conversations for this agent
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchConversationHistory} disabled={isLoadingHistory}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                             <p>No WhatsApp conversations yet</p>
               <p className="text-sm">Test messages will appear here</p>
            </div>
          ) : (
                         <div className="space-y-4">
               {conversations.map((conversation) => (
                <div key={conversation.sessionId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">+{formatPhoneNumber(conversation.phone)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {conversation.messageCount} messages • {new Date(conversation.lastMessageAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {conversation.messages.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {conversation.messages.slice(0, 3).map((message, msgIndex) => (
                        <div key={msgIndex} className={`text-sm p-2 rounded ${
                          message.role === 'USER' 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-xs">
                              {message.role === 'USER' ? 'User' : 'Assistant'}
                            </span>
                            <span className="text-xs opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-1">{message.content}</p>
                        </div>
                      ))}
                      {conversation.messages.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{conversation.messages.length - 3} more messages
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card> */}

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Twilio WhatsApp Setup Guide</CardTitle>
          <CardDescription>
            Follow these steps to set up WhatsApp with Twilio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <h4 className="font-medium">Set up Twilio Account</h4>
                <p className="text-sm text-muted-foreground">
                  Create a Twilio account and get your Account SID, Auth Token, and WhatsApp number
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <h4 className="font-medium">Configure Environment Variables</h4>
                <p className="text-sm text-muted-foreground">
                  Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM to your environment
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <h4 className="font-medium">Configure Webhook</h4>
                <p className="text-sm text-muted-foreground">
                  Set the webhook URL in your Twilio WhatsApp configuration to receive messages
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <h4 className="font-medium">Test Integration</h4>
                <p className="text-sm text-muted-foreground">
                  Use the test message feature above to verify everything is working correctly
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}