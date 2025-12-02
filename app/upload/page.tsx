'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { format } from 'date-fns';

interface Artifact {
  id: string;
  filename: string;
  mimeType: string;
  notes: string | null;
  createdAt: string;
}

export default function UploadPage() {
  const { data: session, status } = useSession();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin');
    }
  }, [status]);

  const fetchArtifacts = useCallback(async () => {
    try {
      const response = await fetch('/api/artifacts?limit=20');
      if (response.ok) {
        const data = await response.json();
        setArtifacts(data);
      }
    } catch (error) {
      console.error('Error fetching artifacts:', error);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchArtifacts();
    }
  }, [session, fetchArtifacts]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch('/api/artifacts', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Uploaded ${file.name}` });
        setNotes('');
        fetchArtifacts();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Files</h1>

        {/* Upload Area */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="space-y-4">
              <div className="text-gray-600">
                {isUploading ? (
                  <span>Uploading...</span>
                ) : (
                  <>
                    <span className="font-medium">Drop a file here</span> or{' '}
                    <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                      />
                    </label>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Upload presentations, documents, or any supporting files
              </p>
            </div>
          </div>

          {/* Notes field */}
          <div className="mt-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <input
              type="text"
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context about this file..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-md ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Recent Uploads */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Uploads</h2>

          {artifacts.length === 0 ? (
            <p className="text-gray-500 text-sm">No files uploaded yet.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {artifact.filename}
                    </p>
                    {artifact.notes && (
                      <p className="text-sm text-gray-500 truncate">{artifact.notes}</p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 text-sm text-gray-500">
                    {format(new Date(artifact.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
