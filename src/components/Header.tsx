import { Zap, Bell, Search } from "lucide-react";

const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ch-orange">
            <Zap className="h-5 w-5 text-ch-black fill-ch-black" />
          </div>
          <span className="text-xl font-bold text-ch-white tracking-tight">Click<span className="text-ch-orange">.</span>Hero</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#" className="text-sm font-medium text-foreground">Dashboard</a>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Campanhas</a>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Relatórios</a>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Configurações</a>
        </nav>

        <div className="flex items-center gap-3">
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Search className="h-4 w-4" />
          </button>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-destructive" />
          </button>
          <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
            U
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
