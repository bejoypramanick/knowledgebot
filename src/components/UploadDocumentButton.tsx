/**
 * UploadDocumentButton - Reusable upload document button component
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 * 
 * PROPRIETARY SOFTWARE - See LICENSE file for terms and conditions.
 * Commercial use prohibited without explicit written permission.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { KnowledgeBaseManager, DocumentMetadata } from '@/lib/knowledge-base';
import { AWS_CONFIG } from '@/lib/aws-config';
import { useIsMobile } from '@/hooks/use-mobile';

interface UploadDocumentButtonProps {
  onUploadSuccess?: () => void;
  className?: string;
}

const UploadDocumentButton: React.FC<UploadDocumentButtonProps> = ({
  onUploadSuccess,
  className = ""
}) => {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState<Partial<DocumentMetadata>>({
    title: '',
    category: 'general',
    tags: [],
    author: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const knowledgeBaseManager = new KnowledgeBaseManager(AWS_CONFIG.endpoints.apiGateway);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadMetadata(prev => ({
        ...prev,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
        author: prev.author || 'Unknown'
      }));
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      const result = await knowledgeBaseManager.uploadDocument(
        selectedFile,
        uploadMetadata as DocumentMetadata,
        (progress) => setUploadProgress(progress)
      );

      setSuccess(`Document "${uploadMetadata.title}" uploaded successfully!`);
      setSelectedFile(null);
      setUploadMetadata({
        title: '',
        category: 'general',
        tags: [],
        author: ''
      });
      setUploadProgress(0);

      // Call success callback
      onUploadSuccess?.();

      // Close dialog after a short delay
      setTimeout(() => {
        setIsUploadDialogOpen(false);
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseDialog = () => {
    if (!isUploading) {
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadMetadata({
        title: '',
        category: 'general',
        tags: [],
        author: ''
      });
      setError(null);
      setSuccess(null);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsUploadDialogOpen(true)}
          className={`bg-white/10 border-white/20 text-white hover:bg-white/20 ${className}`}
          title="Upload Document"
        >
          <Upload className="h-4 w-4 sm:mr-1" />
          {!isMobile && "Upload"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document to Knowledge Base</DialogTitle>
          <DialogDescription>
            Upload documents to enhance your chatbot's knowledge base
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select Document</Label>
            <div className="flex items-center space-x-2">
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.txt,.doc,.docx,.md"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className="flex-1 cursor-pointer border border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors bg-white"
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-gray-700">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm text-gray-800">Click to select a document</p>
                    <p className="text-xs text-gray-600">PDF, TXT, DOC, DOCX, MD</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Document Metadata */}
          {selectedFile && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title</Label>
                <input
                  id="title"
                  type="text"
                  value={uploadMetadata.title || ''}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter document title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={uploadMetadata.category || 'general'}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isUploading}
                >
                  <option value="general">General</option>
                  <option value="technical">Technical</option>
                  <option value="faq">FAQ</option>
                  <option value="policy">Policy</option>
                  <option value="training">Training</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <input
                  id="author"
                  type="text"
                  value={uploadMetadata.author || ''}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Enter author name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={uploadMetadata.description || ''}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter document description"
                  rows={3}
                  className="text-black bg-white"
                  disabled={isUploading}
                />
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-black">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-md">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading || !uploadMetadata.title}
              className="bg-gradient-primary border-0 shadow-glow"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDocumentButton;
