"use client";

import { use } from "react";
import { useAuth } from '../../../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Bot, Settings, MessageCircle, PlayCircle, FileText, Activity, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ConfigTab } from "@/components/agent/config-tab";
import { KnowledgeTab } from "@/components/agent/knowledge-tab";
import { WhatsAppTab } from "@/components/agent/whatsapp-tab";
import { PlaygroundTab } from "@/components/agent/playground-tab";
import { ActivityTab } from "@/components/agent/activity-tab";
import { WidgetTab } from "@/components/agent/widget-tab";


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

const tabs = [
  { id: 'config', name: 'Configuration', icon: Settings },
  { id: 'knowledge', name: 'Knowledge Base', icon: FileText },
  { id: 'widget', name: 'Widget', icon: Globe },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
  { id: 'playground', name: 'Playground', icon: PlayCircle },
  { id: 'activity', name: 'Activity', icon: Activity },
];

export default function AgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("config");

  // Config tab state
  const [formData, setFormData] = useState<{
    name: string;
    tone: string;
    instructions: string;
    customTone?: string;
    [key: string]: unknown;
  }>({
    name: "",
    tone: "",
    instructions: "",
    customTone: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    chunkCount: number;
    processingStatus: string;
    errorMessage?: string;
    createdAt: string;
  }[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle");

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && resolvedParams.id) {
      fetchAgent();
    }
  }, [user, resolvedParams.id]);

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        tone: agent.tone,
        instructions: agent.instructions,
        customTone: "",
        primaryColor: "#3B82F6",
        initialGreeting: "Hi! How can I help you today?",
      });
      fetchKnowledgeBase();
    }
  }, [agent]);

  const fetchAgent = async () => {
    try {
      const response = await fetch(`/api/agent/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setAgent(data);
      } else if (response.status === 404) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching agent:', error);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKnowledgeBase = async () => {
    try {
      const response = await fetch(`/api/knowledge-base?agentId=${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBase(data);
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const agentData = {
        name: formData.name,
        tone: formData.tone,
        instructions: formData.instructions,
      };
      const response = await fetch(`/api/agent/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentData),
      });
      if (response.ok) {
        fetchAgent();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadStatus("uploading");
    setUploadError("");
    try {
      const formDataObj = new FormData();
      formDataObj.append("file", file);
      formDataObj.append("agentId", resolvedParams.id);
      const response = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formDataObj,
      });
      if (response.ok) {
        setUploadStatus("success");
        fetchKnowledgeBase();
      } else {
        setUploadStatus("error");
        setUploadError("Upload failed");
      }
    } catch {
      setUploadStatus("error");
      setUploadError("Upload failed");
    } finally {
      setTimeout(() => setUploadStatus("idle"), 3000);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchKnowledgeBase();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

  const goBack = () => {
    router.push('/dashboard');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !agent) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'config':
        return (
          <ConfigTab
            formData={formData}
            setFormData={setFormData}
            isSaving={isSaving}
            handleSave={handleSave}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeTab
            knowledgeBase={knowledgeBase}
            uploadError={uploadError}
            uploadStatus={uploadStatus}
            handleFileUpload={handleFileUpload}
            handleDeleteDocument={handleDeleteDocument}
            formatFileSize={formatFileSize}
          />
        );
      case 'widget':
        return <WidgetTab agent={agent} onUpdate={fetchAgent} />;
      case 'whatsapp':
        return <WhatsAppTab agent={agent} />;
      case 'playground':
        return <PlaygroundTab agent={agent} />;
      case 'activity':
        return <ActivityTab agent={agent} />;
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar className="border-r">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold">{agent.name}</h2>
                <Badge variant={getStatusVariant(agent.isActive ? "active" : "inactive")} className="text-xs">
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <SidebarMenuItem key={tab.id}>
                        <SidebarMenuButton
                          onClick={() => setActiveTab(tab.id)}
                          isActive={activeTab === tab.id}
                          className="flex items-center gap-2 w-full"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{tab.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <Button onClick={goBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dash
            </Button>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col">
          <header className="border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{agent.name}</h1>
                  <span className="text-sm text-gray-500">
                    Created {new Date(agent.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
            </div>
          </header>
          <main className="flex-1 p-6">
            {renderTabContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// TODO: Restore the full agent configuration interface
// The commented code below contains the complete agent edit functionality
// that should be restored once the core issues are resolved

/*
// ... existing commented code ...
*/
