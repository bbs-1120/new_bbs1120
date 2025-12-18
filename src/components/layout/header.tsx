"use client";

import { formatDate } from "@/lib/utils";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const today = new Date();

  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">本日</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatDate(today)}
          </p>
        </div>
      </div>
    </header>
  );
}

