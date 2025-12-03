export type BranchId = 'scientific' | 'literary' | 'industrial' | 'entrepreneurship';

export const BRANCHES: { id: BranchId; label: { en: string; ar: string } }[] = [
    {
        id: 'scientific',
        label: {
            en: 'Scientific Branch',
            ar: 'الفرع العلمي',
        },
    },
    {
        id: 'literary',
        label: {
            en: 'Literary Branch',
            ar: 'الفرع الأدبي',
        },
    },
    {
        id: 'industrial',
        label: {
            en: 'Industrial Branch',
            ar: 'الفرع الصناعي',
        },
    },
    {
        id: 'entrepreneurship',
        label: {
            en: 'Entrepreneurship Branch',
            ar: 'فرع ريادة الأعمال',
        },
    },
];
