import { createFileRoute, Outlet, Link, useNavigate, redirect } from "@tanstack/react-router";
import { LogOut, Image, Package, LayoutDashboard, LayoutGrid, Receipt, Settings, UserCog, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  loader: async () => {
    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin) {
      throw redirect({
        to: "/",
        search: {} as never,
      });
    }
    return { isAdmin };
  },
  errorComponent: ({ error }) => (
    <div className="container-luxe py-24 text-center">
      <h1 className="font-display text-3xl">Acceso denegado</h1>
      <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>
      <Link to="/" className="mt-6 inline-block underline">Volver al inicio</Link>
    </div>
  ),
  notFoundComponent: () => <div className="container-luxe py-24 text-center">No encontrado</div>,
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/" });
  }

  return (
    <div className="container-luxe py-8">
      <header className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Panel privado</p>
          <h1 className="font-display text-3xl">Administración</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin"
            activeOptions={{ exact: true }}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <LayoutDashboard className="h-4 w-4" /> Inicio
          </Link>
          <Link
            to="/admin/carrusel"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <Image className="h-4 w-4" /> Carrusel
          </Link>
          <Link
            to="/admin/categorias"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <LayoutGrid className="h-4 w-4" /> Categorías
          </Link>
          <Link
            to="/admin/productos"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <Package className="h-4 w-4" /> Productos
          </Link>
          <Link
          to="/admin/stock-fundas"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
  📱 Stock de fundas
</Link>
          <Link
            to="/admin/pedidos"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <Receipt className="h-4 w-4" /> Pedidos
          </Link>
          <Link
            to="/admin/ajustes"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <Settings className="h-4 w-4" /> Ajustes
          </Link>
          <Link
            to="/admin/contenido"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <Type className="h-4 w-4" /> Textos
          </Link>
          <Link
            to="/admin/cuenta"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <UserCog className="h-4 w-4" /> Mi cuenta
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
