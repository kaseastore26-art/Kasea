import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Heart, Menu, X, Shield, LogIn, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CartDrawer } from "./CartDrawer";
import { BrandLogo } from "./BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { useFavoritesStore } from "@/lib/favorites";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/fundas", label: "Fundas" },
  { to: "/accesorios", label: "Accesorios" },
  { to: "/mas-vendido", label: "Lo más vendido" },
  { to: "/contacto", label: "Contacto" },
];


const DESKTOP_NAV = NAV.slice(0, 8);

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const favCount = useFavoritesStore((s) => s.items.length);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    navigate({ to: "/tienda", search: { q: q.trim() || undefined } });
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    if (to !== "/" && pathname === to) {
      e.preventDefault();
      setOpen(false);
      navigate({ to: "/" });
    }
  };

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (active) setIsAdmin(!!data);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 20) {
        setHideOnScroll(false);
      } else if (currentScrollY > lastScrollY + 4) {
        setHideOnScroll(true);
      } else if (currentScrollY < lastScrollY - 4) {
        setHideOnScroll(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-border/60 bg-background/88 backdrop-blur-xl transition-transform duration-300 ${
        hideOnScroll ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="container-luxe relative flex min-h-[6rem] items-center justify-between gap-4 py-3 md:min-h-[6.5rem] md:py-4">
        <div className="flex items-center gap-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-label="Abrir menú">
            {open ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
          </Button>
        </div>

        {/* Logo: mobile centered absolute, desktop left */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:translate-x-0 md:translate-y-0 md:order-first md:flex-shrink-0">
          <BrandLogo
            priority
            className="pointer-events-auto inline-flex items-center justify-center animate-float"
            imageClassName="h-[5.5rem] w-auto max-w-[15rem] object-contain sm:h-[6.75rem] sm:max-w-[16rem] md:h-24 md:max-w-[14rem] lg:h-28 lg:max-w-[16rem]"
          />
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-x-4 md:flex lg:gap-x-6 whitespace-nowrap">
          {DESKTOP_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={(e) => handleNavClick(e, item.to)}
              className="text-[11px] font-medium tracking-[0.14em] text-foreground/72 uppercase transition-colors hover:text-foreground lg:text-[12px] lg:tracking-[0.18em]"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: true }}
            >
              {item.label}
            </Link>
          ))}
        </nav>




        <div className="flex flex-1 items-center justify-end gap-1 md:gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="hidden gap-1.5 rounded-full md:inline-flex">
              <Link to="/admin"><Shield className="h-4 w-4" strokeWidth={1.5} />Admin</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-full hover:bg-secondary sm:inline-flex"
            aria-label="Buscar"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </Button>
          <Button asChild variant="ghost" size="icon" className="relative hidden rounded-full hover:bg-secondary sm:inline-flex" aria-label="Favoritos">
            <Link to="/favoritos">
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              {favCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] bg-espresso text-ivory">
                  {favCount}
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden rounded-full hover:bg-secondary sm:inline-flex" aria-label="Mis pedidos">
            <Link to="/mis-pedidos"><Package className="h-5 w-5" strokeWidth={1.5} /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden rounded-full hover:bg-secondary sm:inline-flex" aria-label="Iniciar sesión">
            <Link to="/auth"><LogIn className="h-5 w-5" strokeWidth={1.5} /></Link>
          </Button>
          <CartDrawer />
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-border/60 bg-background">
          <form onSubmit={submitSearch} className="container-luxe flex items-center gap-2 py-3">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar fundas…"
              className="h-10 flex-1 border-0 bg-transparent focus-visible:ring-0"
            />
            <Button type="submit" size="sm" className="rounded-md">
              Buscar
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Cerrar búsqueda" onClick={() => setSearchOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {open && (
        <nav className="border-t border-border/60 bg-background md:hidden">
          <div className="container-luxe flex flex-col gap-1 py-4">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={(e) => {
                  handleNavClick(e, item.to);
                  setOpen(false);
                }}
                className="py-3 text-sm font-medium tracking-[0.14em] uppercase"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
              className="flex items-center gap-2 py-3 text-left text-sm font-medium tracking-[0.14em] uppercase"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} /> Buscar
            </button>
            <Link
              to="/favoritos"
              onClick={() => setOpen(false)}
              className="py-3 text-sm font-medium tracking-[0.14em] uppercase"
            >
              Favoritos
            </Link>
            <Link
              to="/mis-pedidos"
              onClick={() => setOpen(false)}
              className="py-3 text-sm font-medium tracking-[0.14em] uppercase"
            >
              Mis pedidos
            </Link>
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="py-3 text-sm font-medium tracking-[0.14em] uppercase"
            >
              Iniciar sesión
            </Link>
            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-2 py-3 text-sm font-medium tracking-[0.14em] uppercase text-primary">
                <Shield className="h-4 w-4" strokeWidth={1.5} /> Admin
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
