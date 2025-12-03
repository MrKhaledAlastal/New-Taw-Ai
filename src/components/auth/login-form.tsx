'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn } = useAuth();

  const redirectUrl = searchParams.get('redirect') || '/chat';

  useEffect(() => {
    if (isLoggedIn) {
      router.replace(redirectUrl);
    }
  }, [isLoggedIn, router, redirectUrl]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: "Logged in successfully!" });
      // Redirect is handled by useEffect
    } catch (error: any) {
      let description;
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          description = t.invalidCredentials;
          break;
        default:
          description = error.message;
      }
      toast({ variant: 'destructive', title: t.loginFailed, description });
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Logged in successfully!" });
      // Redirect is handled by useEffect
    } catch (error: any) {
      toast({ variant: 'destructive', title: t.loginFailed, description: error.message });
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.email}</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t.password}</FormLabel>
                  <Link
                    href="/reset-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={loading} className="w-full glowing-btn">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.login}
          </Button>
        </form>
      </Form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <Button variant="outline" onClick={handleGoogleSignIn} disabled={loading} className="w-full glowing-btn">
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.75 8.36,4.73 12.19,4.73C15.28,4.73 17.09,6.8 17.09,6.8L19,4.92C19,4.92 16.58,2.08 12.19,2.08C6.54,2.08 2,6.7 2,12C2,17.3 6.54,21.92 12.19,21.92C17.6,21.92 22,18.5 22,12.28C22,11.61 21.35,11.1 21.35,11.1V11.1Z"></path></svg>
        )}
        {t.loginWithGoogle}
      </Button>
    </div>
  );
}
