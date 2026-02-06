import * as React from "react";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface FileUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  className?: string;
  maxSizeMB?: number;
}

export function FileUpload({
  file,
  onChange,
  accept = "*",
  className,
  maxSizeMB = MAX_FILE_SIZE_MB,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const validateAndSetFile = (selectedFile: File | null) => {
    setError(null);
    if (selectedFile && selectedFile.size > maxBytes) {
      setError(`Файл слишком большой. Максимум ${maxSizeMB} МБ`);
      toast.error(`Файл слишком большой. Максимальный размер: ${maxSizeMB} МБ`);
      return;
    }
    onChange(selectedFile);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
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
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  };

  return (
    <div className="space-y-2">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all duration-200",
          "hover:border-primary/50 hover:bg-accent/30",
          isDragging ? "border-primary bg-accent/50" : "border-border",
          error ? "border-destructive" : "",
          className
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              onClick={handleRemove}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-3 bg-accent rounded-full">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Перетащите файл сюда</p>
              <p className="text-xs text-muted-foreground">
                или нажмите для выбора (макс. {maxSizeMB} МБ)
              </p>
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
