import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ToneOption {
  value: string;
  label: string;
  description: string;
}

const TONE_OPTIONS: ToneOption[] = [
  { value: "Friendly", label: "Friendly", description: "Warm and approachable responses" },
  { value: "Professional", label: "Professional", description: "Formal and business-oriented" },
  { value: "Helpful", label: "Helpful", description: "Solution-focused and supportive" },
  { value: "Enthusiastic", label: "Enthusiastic", description: "Energetic and positive" },
  { value: "Custom", label: "Custom", description: "Define your own tone" },
];

interface FormData {
  name: string;
  tone: string;
  instructions: string;
  customTone?: string;
  [key: string]: unknown;
}

interface ConfigTabProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  isSaving: boolean;
  handleSave: () => void;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
  formData,
  setFormData,
  isSaving,
  handleSave,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Configuration</CardTitle>
          <CardDescription>Configure your agent&apos;s basic settings and personality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter agent name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Agent Tone</Label>
            <Select value={formData.tone} onValueChange={val => setFormData({ ...formData, tone: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent tone" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.tone === "Custom" && (
            <div className="space-y-2">
              <Label htmlFor="customTone">Custom Tone</Label>
              <Input
                id="customTone"
                value={formData.customTone}
                onChange={e => setFormData({ ...formData, customTone: e.target.value })}
                placeholder="Describe your custom tone..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="instructions">System Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={e => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Enter detailed instructions for your agent..."
              className="min-h-[120px]"
            />
            <p className="text-sm text-muted-foreground">
              These instructions will guide how your agent responds to users.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}; 