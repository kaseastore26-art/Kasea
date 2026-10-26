import { createFileRoute, Link } from "@tanstack/react-router";
import { Image, Package, LayoutGrid, ArrowRight, Receipt, Settings, UserCog, Type, Percent, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndex,
});

const CARDS = [
  {
    to: "/admin/productos" as const,
    icon: Package,
    title: "Productos",
    text: "Crea y edita productos del catálogo: nombre, precio, stock, imagen y estado.",
  },
  {
    to: "/admin/pedidos" as const,
    icon: Receipt,
    title: "Pedidos",
    text: "Consulta pedidos, cambia su estado y revisa los diseños personalizados.",
  },
  {
    to: "/admin/imprimir" as const,
    icon: Printer,
    title: "Fundas para imprimir",
    text: "Descarga las fundas personalizadas ya montadas en su plantilla, listas para Photoshop.",
  },
  {
    to: "/admin/ajustes" as const,
    icon: Settings,
    title: "Ajustes de envío",
    text: "Configura la tarifa de envío y el umbral de envío gratis.",
  },
  {
    to: "/admin/descuentos" as const,
    icon: Percent,
    title: "Códigos de descuento",
    text: "Genera códigos con el % que quieras para tarjetas, regalos o campañas, y mira cuáles se han usado.",
  },
  {
    to: "/admin/contenido" as const,
    icon: Type,
    title: "Textos de la web",
    text: "Edita la barra de anuncio y los textos de la portada (temporadas, campañas).",
  },
  {
    to: "/admin/carrusel" as const,
    icon: Image,
    title: "Carrusel de la home",
    text: "Ordena, sube, reemplaza y edita las imágenes de la galería principal.",
  },
  {
    to: "/admin/categorias" as const,
    icon: LayoutGrid,
    title: "Categorías destacadas",
    text: "Cambia la imagen de la categoría de la home.",
  },
  {
    to: "/admin/cuenta" as const,
    icon: UserCog,
    title: "Mi cuenta",
    text: "Cambia tu correo de acceso o tu contraseña de administrador.",
  },
];

function AdminIndex() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          className="group flex flex-col justify-between rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div>
            <c.icon className="h-8 w-8 text-primary" strokeWidth={1.4} />
            <h2 className="mt-4 font-display text-2xl">{c.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
          </div>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium">
            Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      ))}
    </div>
  );
}
