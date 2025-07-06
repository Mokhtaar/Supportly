import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, RefreshCw, Eye, EyeOff, Globe, Shield, Code, Palette, MessageSquare, ExternalLink } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  tone: string;
  instructions: string;
  isActive: boolean;
  createdAt: string;
  widgetKey?: string;
  allowedDomains?: string[];
  chatWidgetConfig?: {
    primary_color?: string;
    initial_greeting?: string;
    position?: string;
  };
}

interface WidgetTabProps {
  agent: Agent;
  onUpdate?: () => void;
}

export const WidgetTab: React.FC<WidgetTabProps> = ({ agent, onUpdate }) => {
  const [config, setConfig] = useState({
    primary_color: '#3B82F6',
    initial_greeting: 'Hi! How can I help you today?',
    position: 'bottom-right',
    ...agent.chatWidgetConfig,
  });
  const [allowedDomains, setAllowedDomains] = useState<string[]>(agent.allowedDomains || []);
  const [newDomain, setNewDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWidgetKey, setShowWidgetKey] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 
                     (typeof window !== 'undefined' ? window.location.origin : '');

  const embedCode = `<script src="${apiBaseUrl}/api/widget.js?key=${agent.widgetKey || 'WIDGET_KEY_NOT_SET'}"></script>`;

  const testUrl = `${apiBaseUrl}/api/widget.js?key=${agent.widgetKey || 'WIDGET_KEY_NOT_SET'}`;

  useEffect(() => {
    if (agent.chatWidgetConfig) {
      setConfig({
        primary_color: '#3B82F6',
        initial_greeting: 'Hi! How can I help you today?',
        position: 'bottom-right',
        ...agent.chatWidgetConfig,
      });
    }
    if (agent.allowedDomains) {
      setAllowedDomains(agent.allowedDomains);
    }
  }, [agent]);

  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agent/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agent.name,
          tone: agent.tone,
          instructions: agent.instructions,
          chatWidgetConfig: config,
          allowedDomains: allowedDomains,
        }),
      });

      if (response.ok) {
        setCopySuccess('Configuration saved successfully!');
        setTimeout(() => setCopySuccess(''), 2000);
        onUpdate?.();
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving widget config:', error);
      setCopySuccess('Error saving configuration');
      setTimeout(() => setCopySuccess(''), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure you want to regenerate the widget key? This will invalidate all existing embedded widgets.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/agent/${agent.id}/regenerate-widget-key`, {
        method: 'POST',
      });

      if (response.ok) {
        setCopySuccess('Widget key regenerated successfully!');
        setTimeout(() => setCopySuccess(''), 2000);
        onUpdate?.();
      } else {
        throw new Error('Failed to regenerate widget key');
      }
    } catch (error) {
      console.error('Error regenerating widget key:', error);
      setCopySuccess('Error regenerating widget key');
      setTimeout(() => setCopySuccess(''), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(`${type} copied to clipboard!`);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopySuccess('Failed to copy to clipboard');
      setTimeout(() => setCopySuccess(''), 2000);
    }
  };

  const addDomain = () => {
    if (newDomain && !allowedDomains.includes(newDomain)) {
      setAllowedDomains([...allowedDomains, newDomain]);
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter(d => d !== domain));
  };

  const previewWidget = () => {
    window.open(testUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Embeddable Chat Widget</h2>
          <p className="text-gray-600">Configure and embed your AI assistant on any website</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={agent.isActive ? "default" : "secondary"}>
            {agent.isActive ? "Active" : "Inactive"}
          </Badge>
          {copySuccess && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              {copySuccess}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="embed" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Embed Code
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Widget Appearance
              </CardTitle>
              <CardDescription>Customize how your chat widget looks and behaves</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={config.primary_color}
                      onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={config.primary_color}
                      onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Widget Position</Label>
                  <select
                    id="position"
                    value={config.position}
                    onChange={(e) => setConfig({ ...config, position: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial_greeting">Initial Greeting Message</Label>
                <Textarea
                  id="initial_greeting"
                  value={config.initial_greeting}
                  onChange={(e) => setConfig({ ...config, initial_greeting: e.target.value })}
                  placeholder="Hi! How can I help you today?"
                  className="min-h-[80px]"
                />
                <p className="text-sm text-gray-500">
                  This message will be displayed when users first open the chat widget.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Control where your widget can be embedded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Widget Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={showWidgetKey ? "text" : "password"}
                    value={agent.widgetKey || 'Not generated'}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWidgetKey(!showWidgetKey)}
                  >
                    {showWidgetKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(agent.widgetKey || '', 'Widget key')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRegenerateKey}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Keep this key secret. Regenerating will invalidate all existing widgets.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Allowed Domains</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="example.com or *.example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <Button onClick={addDomain} disabled={!newDomain}>
                    Add
                  </Button>
                </div>
                
                {allowedDomains.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Current allowed domains:</p>
                    <div className="flex flex-wrap gap-2">
                      {allowedDomains.map((domain, index) => (
                        <Badge key={index} variant="outline" className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {domain}
                          <button
                            onClick={() => removeDomain(domain)}
                            className="ml-1 text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-gray-500">
                  Leave empty to allow all domains. Use *.domain.com for subdomains.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Security Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Embed Code
              </CardTitle>
              <CardDescription>Copy this code to embed the widget on your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>HTML Embed Code</Label>
                <div className="relative">
                  <Textarea
                    value={embedCode}
                    readOnly
                    className="font-mono text-sm min-h-[100px] pr-12"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(embedCode, 'Embed code')}
                    className="absolute top-2 right-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Add this script tag to your website&apos;s HTML, preferably before the closing &lt;/body&gt; tag.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Direct Widget URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={testUrl}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(testUrl, 'Widget URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previewWidget}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!agent.isActive && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ Your agent is currently inactive. The widget will not respond to messages until you activate the agent.
                  </p>
                </div>
              )}

              {!agent.widgetKey && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">
                    ❌ Widget key not generated. Please save your configuration first.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Widget Preview
              </CardTitle>
              <CardDescription>See how your widget will look on your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-6 bg-gray-100 rounded-lg min-h-[300px] relative">
                  <p className="text-gray-600 mb-4">Website Content Preview</p>
                  <div className="space-y-2 text-gray-500 text-sm">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                  </div>
                  
                  {/* Widget Preview */}
                  <div 
                    className="fixed z-50"
                    style={{
                      [config.position.includes('bottom') ? 'bottom' : 'top']: '32px',
                      [config.position.includes('right') ? 'right' : 'left']: '32px'
                    }}
                  >
                    <button
                      className="flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg text-2xl"
                      style={{ backgroundColor: config.primary_color }}
                    >
                      💬
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Configuration</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li><strong>Color:</strong> {config.primary_color}</li>
                      <li><strong>Position:</strong> {config.position}</li>
                      <li><strong>Greeting:</strong> {config.initial_greeting}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Security</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li><strong>Domains:</strong> {allowedDomains.length || 'All allowed'}</li>
                      <li><strong>Agent:</strong> {agent.isActive ? 'Active' : 'Inactive'}</li>
                      <li><strong>Key:</strong> {agent.widgetKey ? 'Generated' : 'Not set'}</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={previewWidget} className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Test Page
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => copyToClipboard(embedCode, 'Embed code')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Embed Code
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 