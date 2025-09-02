// Authentication removed
import { Menu, Bell } from "lucide-react";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-card shadow-sm border-b border-border">
      {/* Mobile menu button */}
      <button className="px-4 border-r border-border text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 px-4 flex justify-between sm:px-6 lg:px-8">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        </div>

        <div className="ml-4 flex items-center md:ml-6 space-x-4">
          {/* Notifications */}
          <button className="bg-card p-1 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
            <Bell className="h-5 w-5" />
          </button>

        </div>
      </div>
    </div>
  );
}