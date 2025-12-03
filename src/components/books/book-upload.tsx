'use client';

import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Loader2, FileUp, FileCheck2, X, Trash2 } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BRANCHES, type BranchId } from '@/constants/branches';


export default function BookUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const { user, isLoggedIn, isAdmin } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchId, setBranchId] = useState<BranchId>('scientific');

  const allowedTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'text/plain': ['.txt'],
  } as const;

  const fileKey = (file: File) => `${file.name}_${file.size}_${file.lastModified}`;

  const onDrop = (acceptedFiles: File[]) => {
    if (!isLoggedIn) {
      router.push('/login?redirect=/my-books');
      return;
    }

    const validated: File[] = [];
    acceptedFiles.forEach((file) => {
      const isAllowed = Object.keys(allowedTypes).some(type => file.type === type) || file.name.toLowerCase().endsWith('.pdf');
      const alreadyQueued = files.some(existing => fileKey(existing) === fileKey(file));

      if (!isAllowed) {
        toast({
          variant: 'destructive',
          title: 'Unsupported File Type',
          description: 'Please upload PDF, Word, PowerPoint, or text study files.',
        });
        return;
      }

      if (!alreadyQueued) {
        validated.push(file);
      }
    });

    if (validated.length) {
      setFiles(prev => [...prev, ...validated]);
      setDialogOpen(true);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: allowedTypes,
  });

  const uploadSingleFile = (file: File) => {
    if (!user) return Promise.reject(new Error('User not found'));

    return new Promise<void>((resolve, reject) => {
      const key = fileKey(file);
      const storageRef = ref(storage, `textbooks/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [key]: progress }));
        },
        (error) => {
          toast({
            variant: 'destructive',
            title: `Upload failed: ${file.name}`,
            description: error.message,
          });
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          await addDoc(collection(db, 'books'), {
            userId: user.uid,
            fileName: file.name,
            status: 'pending',
            downloadURL,
            storagePath: storageRef.fullPath,
            branch: branchId,
            createdAt: serverTimestamp(),
          });

          setUploadProgress(prev => ({ ...prev, [key]: 100 }));
          resolve();
        }
      );
    });
  };

  const handleUpload = async () => {
    if (!files.length || !user) return;

    setIsUploading(true);

    let successCount = 0;
    for (const file of files) {
      try {
        await uploadSingleFile(file);
        successCount += 1;
      } catch (error) {
        console.error('Upload failed', error);
      }
    }

    setIsUploading(false);
    setFiles([]);
    setUploadProgress({});
    setDialogOpen(false);

    if (successCount) {
      toast({
        title: t.uploadBook,
        description: `${successCount} ${successCount === 1 ? 'file' : 'files'} uploaded successfully`,
      });
    }
  };
  
  const handleTriggerClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
        e.preventDefault();
        router.push('/login?redirect=/my-books');
    }
  };
  
  const totalSelectedSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const triggerElement = (
    <Button onClick={isLoggedIn ? undefined : handleTriggerClick} className="glowing-btn">
      <FileUp className="mr-2 h-4 w-4" />
      {t.uploadBook}
    </Button>
  );


  if (!isLoggedIn) {
    return triggerElement;
  }

  if (!isAdmin) {
    return null;
  }
  
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          {triggerElement}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className='text-primary'>{t.uploadBook}</DialogTitle>
            <DialogDescription>
              {isDragActive
                ? 'Drop the file here...'
                : "Drag 'n' drop PDF, Word, PowerPoint, or text study files here, or click to select"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium text-foreground">
                {lang === 'ar' ? 'اختر الفرع' : 'Choose branch'}
              </label>
              <Select value={branchId} onValueChange={(value) => setBranchId(value as BranchId)}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر الفرع' : 'Select branch'} />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.label[lang as 'en' | 'ar'] ?? branch.label.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <FileUp className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-center text-muted-foreground">
                {isDragActive
                  ? 'Drop the files here...'
                  : 'Supported: PDF, DOCX, DOC, PPTX, PPT, TXT'}
              </p>
              <p className="text-xs text-muted-foreground">يمكنك اختيار أكثر من ملف دفعة واحدة</p>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{files.length} ملف(ات) محددة</span>
                  <span>{(totalSelectedSize / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="max-h-56 space-y-3 overflow-y-auto pe-1">
                  {files.map((selectedFile) => {
                    const key = fileKey(selectedFile);
                    const progress = uploadProgress[key] ?? 0;
                    return (
                      <div key={key} className="rounded-lg border bg-secondary/30 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <FileCheck2 className="h-5 w-5 text-primary" />
                            <div className="text-sm">
                              <p className="font-medium truncate max-w-[180px]">{selectedFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setFiles(prev => prev.filter(f => fileKey(f) !== key))}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {isUploading && (
                          <Progress value={progress} className="h-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => {
              if (isUploading) return;
              setFiles([]);
              setDialogOpen(false);
            }} disabled={isUploading}>
              {t.cancel ?? 'Cancel'}
            </Button>
            <Button type="button" onClick={handleUpload} disabled={!files.length || isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              {isUploading ? t.uploading : t.uploadBook}
            </Button>
          </div>
        </DialogContent>
    </Dialog>
  );
}
