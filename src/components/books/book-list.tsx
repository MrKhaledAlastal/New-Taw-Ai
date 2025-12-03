'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Loader2, Trash2, FileText, CheckCircle2, AlertCircle, UploadCloud } from 'lucide-react';

import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import BookUpload from './book-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BRANCHES, type BranchId } from '@/constants/branches';

interface Book {
  id: string;
  fileName: string;
  status: 'pending' | 'analyzed' | 'error';
  createdAt: any;
  storagePath: string;
  branch?: BranchId;
}

export default function BookList() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<BranchId>(BRANCHES[0].id);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
      collection(db, 'books'),
      where('userId', '==', user.uid),
      where('branch', '==', branchFilter)
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const booksData: Book[] = [];
      querySnapshot.forEach((doc) => {
        booksData.push({ id: doc.id, ...doc.data() } as Book);
      });
      setBooks(booksData.sort((a,b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, branchFilter]);

  const handleDelete = async (book: Book) => {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'books', book.id));
      // Delete from Storage
      const storageRef = ref(storage, book.storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error("Error deleting book:", error);
    }
  };

  const statusIcons = {
    pending: <Loader2 className="mr-2 h-4 w-4 animate-spin text-yellow-500" />,
    analyzed: <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />,
    error: <AlertCircle className="mr-2 h-4 w-4 text-red-500" />,
  };
  
  const statusColors = {
    pending: 'secondary',
    analyzed: 'default',
    error: 'destructive',
  } as const;

  return (
    <Tabs value={branchFilter} onValueChange={(value) => setBranchFilter(value as BranchId)}>
      <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
        {BRANCHES.map(branch => (
          <TabsTrigger
            key={branch.id}
            value={branch.id}
            className="rounded-full border px-4 py-1 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {branch.label['ar']}
          </TabsTrigger>
        ))}
      </TabsList>
      {BRANCHES.map(branch => (
        <TabsContent key={branch.id} value={branch.id} className="mt-4">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center bg-secondary/20 backdrop-blur-lg border border-dashed border-border rounded-lg p-12 flex flex-col items-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <UploadCloud className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">لا توجد كتب مرفوعة لهذا الفرع</h2>
              <p className="mt-2 max-w-md mx-auto text-muted-foreground">
                {t.noBooks} قم برفع كتاب لهذا الفرع لتبدأ باستخدام الذكاء.
              </p>
              <div className="mt-6">
                <BookUpload />
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> {book.fileName}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[book.status]} className="capitalize">
                          {statusIcons[book.status]}
                          {t[`bookStatus_${book.status}` as keyof typeof t] || book.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{book.createdAt?.toDate().toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the book "{book.fileName}" and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(book)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
