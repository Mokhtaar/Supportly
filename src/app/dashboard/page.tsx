/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, Bot, Settings, MessageCircle, PlayCircle, FileText, Activity, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Agent {
  id: string;
  name: string;
  tone: string;
  instructions: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    knowledgeBase: number;
    chatHistory: number;
  };
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingClient, setCheckingClient] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      checkClientStatus();
    }
  }, [user]);

  const checkClientStatus = async () => {
    try {
      const response = await fetch('/api/onboarding');
      const data = await response.json();
      
      if (!data.hasCompany) {
        router.push('/onboarding');
        return;
      }
      
      setCheckingClient(false);
      fetchAgents();
    } catch (error) {
      console.error('Error checking client status:', error);
      setCheckingClient(false);
      fetchAgents();
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agent');
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      } else {
        console.error('Failed to fetch agents');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "inactive":
        return "bg-gray-500";
      case "training":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "training":
        return "outline";
      default:
        return "secondary";
    }
  };

  const addNewAgent = () => {
    router.push("/dashboard/agent/new");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const openAgent = (agentId: string) => {
    router.push(`/dashboard/agent/${agentId}`);
  };

  if (loading || isLoading || checkingClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
                <p className="text-sm text-gray-500">Manage and monitor your AI agents</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={addNewAgent}>
                <Plus className="h-4 w-4 mr-2" />
                New Agent
              </Button>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{user.email}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No agents yet</h2>
            <p className="text-gray-500 mb-6">Get started by creating your first AI agent</p>
            <Button onClick={addNewAgent} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.isActive ? "active" : "inactive")}`} />
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openAgent(agent.id)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAgent(agent.id)}>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Test in Playground
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          Delete Agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(agent.isActive ? "active" : "inactive")}>
                      {agent.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {agent.tone}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent onClick={() => openAgent(agent.id)}>
                  <CardDescription className="mb-4 text-sm text-gray-600 overflow-hidden" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {agent.instructions || "No instructions configured"}
                  </CardDescription>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="h-4 w-4" />
                        <span>Knowledge Base</span>
                      </div>
                      <span className="font-medium">{agent._count.knowledgeBase} documents</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <MessageCircle className="h-4 w-4" />
                        <span>Conversations</span>
                      </div>
                      <span className="font-medium">{agent._count.chatHistory}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Activity className="h-4 w-4" />
                        <span>Created</span>
                      </div>
                      <span className="font-medium">{new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => openAgent(agent.id)}
                    >
                      Open Agent
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
} 