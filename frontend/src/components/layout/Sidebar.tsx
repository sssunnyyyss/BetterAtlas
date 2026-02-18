interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 p-4 hidden lg:block overflow-y-auto">
      {children}
    </aside>
  );
}
