import React from "react";
import { Upload, FileText, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface KnowledgeBaseItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  processingStatus: string;
  errorMessage?: string;
  createdAt: string;
}

interface KnowledgeTabProps {
  knowledgeBase: KnowledgeBaseItem[];
  uploadError: string;
  uploadStatus: string;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteDocument: (id: string) => void;
  formatFileSize: (bytes: number) => string;
}

export const KnowledgeTab: React.FC<KnowledgeTabProps> = ({
  knowledgeBase,
  uploadError,
  uploadStatus,
  handleFileUpload,
  handleDeleteDocument,
  formatFileSize,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>Upload documents to enhance your agent&apos;s knowledge</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drag and drop files here, or click to browse</p>
              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button variant="outline" asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Supported formats: PDF, TXT, MD (Max 10MB each)
              </p>
              {uploadStatus !== "idle" && (
                <div className="mt-4">
                  {uploadStatus === "uploading" && (
                    <div className="flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Uploading and processing...
                    </div>
                  )}
                  {uploadStatus === "success" && (
                    <div className="text-green-600">✓ File uploaded successfully</div>
                  )}
                  {uploadStatus === "error" && (
                    <div className="text-red-600">✗ {uploadError}</div>
                  )}
                </div>
              )}
            </div>

            {knowledgeBase.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Uploaded Documents</h4>
                  {knowledgeBase.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)} • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                          </p> 
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={doc.processingStatus === "COMPLETED" ? "secondary" : "outline"}>
                          {doc.processingStatus.toLowerCase()}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {doc.errorMessage && (
                        <div className="mt-2 text-sm text-red-600">Error: {doc.errorMessage}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 