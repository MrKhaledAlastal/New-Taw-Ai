'use client';

import { Logo } from "@/components/icons/logo";
import { useLanguage } from "@/hooks/use-language";

export default function AboutPage() {
    const { t } = useLanguage();

    return (
        <div className="container mx-auto flex flex-col items-center text-center">
            <Logo className="h-20 w-auto text-primary mb-4" />
            <h1 className="text-3xl font-bold text-primary">{t.aboutTitle}</h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
                Tawjihi AI is a modern, bilingual web app designed as a personalized study assistant for high-school (Tawjihi) students. Upload your textbooks, ask questions, and get intelligent answers powered by generative AI.
            </p>
            <div className="mt-8">
                <p className="text-sm text-foreground">{t.aboutCredits}</p>
            </div>
        </div>
    );
}
