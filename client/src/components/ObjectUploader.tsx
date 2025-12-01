import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, X, FileImage, FileVideo, File } from "lucide-react";

interface ObjectUploaderProps {
  uploadType: 'logo' | 'creative' | 'document';
  adSetId?: string;
  extension?: string;
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onComplete?: (results: { objectPath: string; uploadURL: string }[]) => void;
  onError?: (error: Error) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  children: ReactNode;
}

export function ObjectUploader({
  uploadType,
  adSetId,
  extension,
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onComplete,
  onError,
  buttonClassName,
  buttonVariant = "default",
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const acceptedTypes = uploadType === 'logo' 
    ? 'image/*,.svg'
    : uploadType === 'creative'
    ? 'image/*,video/*'
    : '*/*';

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de ${Math.round(maxFileSize / 1024 / 1024)}MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    const newFiles = [...selectedFiles, ...validFiles].slice(0, maxNumberOfFiles);
    setSelectedFiles(newFiles);
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FileImage className="h-4 w-4" />;
    if (file.type.startsWith('video/')) return <FileVideo className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setProgress(0);

    const results: { objectPath: string; uploadURL: string }[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const ext = extension || file.name.split('.').pop() || 'jpg';
        
        let endpoint = '/api/objects/upload';
        const body: Record<string, unknown> = { extension: ext };

        if (uploadType === 'logo') {
          endpoint = '/api/objects/upload/logo';
        } else if (uploadType === 'creative') {
          endpoint = '/api/objects/upload/creative';
          body.adSetId = adSetId;
        } else {
          body.type = 'documents';
        }

        const response = await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        await fetch(response.uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });

        results.push({
          objectPath: response.objectPath,
          uploadURL: response.uploadURL,
        });

        setProgress(((i + 1) / selectedFiles.length) * 100);
      }

      onComplete?.(results);
      setShowModal(false);
      setSelectedFiles([]);
      
      toast({
        title: "Upload concluído",
        description: `${results.length} arquivo(s) enviado(s) com sucesso!`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      onError?.(error as Error);
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar o(s) arquivo(s)",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleOpen = () => {
    setSelectedFiles([]);
    setShowModal(true);
  };

  return (
    <div>
      <Button 
        onClick={handleOpen} 
        className={buttonClassName}
        variant={buttonVariant}
        type="button"
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={(open) => !isUploading && setShowModal(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {uploadType === 'logo' && 'Upload de Logo'}
              {uploadType === 'creative' && 'Upload de Criativo'}
              {uploadType === 'document' && 'Upload de Documento'}
            </DialogTitle>
            <DialogDescription>
              {uploadType === 'logo' && 'Selecione uma imagem para usar como logo'}
              {uploadType === 'creative' && 'Selecione imagens ou vídeos para o criativo'}
              {uploadType === 'document' && 'Selecione um documento para enviar'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">
                Clique para selecionar ou arraste arquivos aqui
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Máximo {maxNumberOfFiles} arquivo(s), até {Math.round(maxFileSize / 1024 / 1024)}MB cada
              </p>
            </div>

            <Input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              multiple={maxNumberOfFiles > 1}
            />
            
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-slate-600">
                          {Math.round(file.size / 1024)}KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-center text-slate-600">
                  Enviando... {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setSelectedFiles([]);
              }}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              {isUploading ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
