"use client";

import React, { useState, useEffect } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, MoreHorizontal, Eye, Bot, User, RefreshCw, ChevronLeft, Clock, Search, Filter } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  MessageSquare, 
  Phone, 
  Globe, 
  Send
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Agent {
  id: string;
  name: string;
}

interface ActivityTabProps {
  agent: Agent;
}

interface Message {
  id: string;
  agentId: string;
  channel: string;
  sessionId: string | null;
  userId: string | null;
  role: string;
  content: string;
  responseTimeMs: number | null;
  timestamp: Date;
  user: {
    id: string;
    email: string;
  } | null;
}

interface SessionGroup {
  sessionId: string;
  channel: string;
  lastActivity: Date;
  messageCount: number;
  messages: Message[];
  conversationId: string;
  status?: string;
  priority?: string;
  title?: string | null;
  summary?: string | null;
  tags?: string[];
  user?: {
    id: string;
    email: string;
  } | null;
}

interface ActivityStats {
  totalSessions: number;
  totalMessages: number;
  channelBreakdown: Record<string, { sessions: number; messages: number }>;
}

interface ActivityData {
  data: SessionGroup[] | Message[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: ActivityStats;
}

const channelIcons = {
  WEB: Globe,
  WHATSAPP: Phone,
  TELEGRAM: Send,
  API: MessageSquare,
};

const channelColors = {
  WEB: "bg-blue-100 text-blue-800",
  WHATSAPP: "bg-green-100 text-green-800", 
  TELEGRAM: "bg-sky-100 text-sky-800",
  API: "bg-purple-100 text-purple-800",
};

export function ActivityTab({ agent }: ActivityTabProps) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionGroup | null>(null);
  const [selectedSessionMessages, setSelectedSessionMessages] = useState<Message[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  
  // Filters
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");

  const sessions = data?.data as SessionGroup[] || [];

  // Column definitions for the sessions table
  const columns: ColumnDef<SessionGroup>[] = [
    {
      accessorKey: "sessionId",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Session ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const sessionId = row.getValue("sessionId") as string;
        return (
          <div className="font-mono text-sm">
            {sessionId.length > 16 ? `${sessionId.substring(0, 16)}...` : sessionId}
          </div>
        );
      },
    },
    {
      accessorKey: "channel",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Channel
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const channel = row.getValue("channel") as string;
        const Icon = channelIcons[channel as keyof typeof channelIcons] || MessageSquare;
        return (
          <Badge className={channelColors[channel as keyof typeof channelColors]}>
            <Icon className="h-3 w-3 mr-1" />
            {channel}
          </Badge>
        );
      },
    },
    {
      accessorKey: "messageCount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Messages
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <div className="text-center">{row.getValue("messageCount")}</div>;
      },
    },
    {
      accessorKey: "lastActivity",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Activity
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = row.getValue("lastActivity") as Date;
        return (
          <div className="text-sm">
            <div>{formatDistanceToNow(new Date(date), { addSuffix: true })}</div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(date), 'MMM d, HH:mm')}
            </div>
          </div>
        );
      },
    },
    {
      id: "lastMessage",
      header: "Last Message",
      cell: ({ row }) => {
        const session = row.original;
        const lastMessage = session.messages?.[0];
        if (!lastMessage) return <div className="text-muted-foreground text-sm">No messages</div>;
        
        return (
          <div className="max-w-xs">
            <div className="text-xs text-muted-foreground mb-1">
              {lastMessage.role === 'USER' ? 'User' : agent.name}:
            </div>
            <div className="text-sm truncate">
              {lastMessage.content}
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const session = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleSessionClick(session)}>
                <Eye className="mr-2 h-4 w-4" />
                View Conversation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigator.clipboard.writeText(session.sessionId)}
              >
                Copy Session ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: sessions,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: "100", // Get more data for table
        offset: "0",
      });
      
      if (channelFilter !== "all") {
        params.append("channel", channelFilter);
      }

      const response = await fetch(`/api/agent/${agent.id}/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch activity data');
      
      const result: ActivityData = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionMessages = async (sessionId: string) => {
    try {
      setLoadingSession(true);
      // Find the conversation ID from the selected session
      const selectedConversation = sessions.find(s => s.sessionId === sessionId);
      if (!selectedConversation?.conversationId) {
        throw new Error('Conversation not found');
      }

      const params = new URLSearchParams({
        conversationId: selectedConversation.conversationId,
        limit: "100",
      });

      const response = await fetch(`/api/agent/${agent.id}/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch session messages');
      
      const result: ActivityData = await response.json();
      setSelectedSessionMessages(result.data as Message[]);
    } catch (error) {
      console.error('Error fetching session messages:', error);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [agent.id, channelFilter]);

  const handleSessionClick = async (session: SessionGroup) => {
    setSelectedSession(session);
    await fetchSessionMessages(session.sessionId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading activity...</span>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedSession(null);
              setSelectedSessionMessages([]);
            }}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>
          
          <div className="flex items-center gap-2">
            <Badge className={channelColors[selectedSession.channel as keyof typeof channelColors]}>
              {React.createElement(channelIcons[selectedSession.channel as keyof typeof channelIcons], { className: "h-3 w-3 mr-1" })}
              {selectedSession.channel}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Session: {selectedSession.sessionId}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Conversation Details</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{format(new Date(selectedSession.lastActivity), 'PPp')}</span>
              </div>
            </CardTitle>
            <CardDescription>
              {selectedSession.messageCount} messages • Last active {formatDistanceToNow(new Date(selectedSession.lastActivity), { addSuffix: true })}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {loadingSession ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span className="ml-2">Loading messages...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedSessionMessages
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'USER' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.role === 'USER' ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Bot className="h-3 w-3" />
                          )}
                          <span className="text-xs font-medium">
                            {message.role === 'USER' ? 'User' : agent.name}
                          </span>
                          <span className="text-xs opacity-75">
                            {format(new Date(message.timestamp), 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.responseTimeMs && (
                          <div className="text-xs opacity-75 mt-1">
                            Response time: {message.responseTimeMs}ms
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {data?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{data.stats.totalSessions}</p>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{data.stats.totalMessages}</p>
                  <p className="text-sm text-muted-foreground">Total Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {Object.entries(data.stats.channelBreakdown).map(([channel, stats]) => (
            <Card key={channel}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {React.createElement(channelIcons[channel as keyof typeof channelIcons] || MessageSquare, { 
                    className: "h-5 w-5 text-muted-foreground" 
                  })}
                  <div>
                    <p className="text-2xl font-bold">{stats.sessions}</p>
                    <p className="text-sm text-muted-foreground">{channel} Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chat Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Chat Sessions
          </CardTitle>
          <CardDescription>
            View and manage all chat sessions for this agent
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Table Controls */}
          <div className="flex items-center gap-4 py-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions, messages, or session IDs..."
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="WEB">Web</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="TELEGRAM">Telegram</SelectItem>
                <SelectItem value="API">API</SelectItem>
              </SelectContent>
            </Select>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Columns <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSessionClick(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No sessions found</p>
                        <p className="text-sm text-muted-foreground">
                          Start chatting to see activity here
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Table Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} session(s) selected.
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 