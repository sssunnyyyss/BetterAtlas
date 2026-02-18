import { useState } from "react";

interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile filter toggle button — Emory navy */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 bg-primary-600 text-white rounded-full shadow-lg p-3 min-w-[48px] min-h-[48px] flex items-center justify-center hover:bg-primary-700 transition-colors"
        aria-label="Open filters"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-200 ease-in-out overflow-y-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-primary-50">
          <h2 className="text-sm font-semibold text-primary-600" style={{ fontFamily: "var(--ba-font-display)" }}>Filters</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 rounded-md text-primary-400 hover:text-primary-600 hover:bg-primary-50 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label="Close filters"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-primary-50 p-4 hidden lg:block overflow-y-auto">
        {children}
      </aside>
    </>
  );
}
