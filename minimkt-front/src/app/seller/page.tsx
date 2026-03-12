"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { fetchCurrentUser, getStoredUser } from "@/lib/session";
import { AuthUser } from "@/types/auth";
import { Product } from "@/types/product";

type Category = {
  id: string;
  name: string;
};

type SortOption = "recent" | "price_asc" | "price_desc" | "stock_asc";

type SellerDashboard = {
  summary: {
    paid_orders: number;
    total_orders: number;
    sold_items: number;
    revenue_cents: number;
    pending_cents: number;
    today_sales_cents: number;
    month_sales_cents: number;
    low_stock_count: number;
  };
  recent_sales: Array<{
    order_id: string;
    status: string;
    created_at: string;
    items_count: number;
    seller_total_cents: number;
  }>;
  top_products: Array<{
    id: string;
    title: string;
    sold_units: number;
    revenue_cents: number;
  }>;
  sales_by_day: Array<{
    day: string;
    revenue_cents: number;
  }>;
  low_stock_products: Array<{
    id: string;
    title: string;
    stock: number;
  }>;
};

type ProductPayload = {
  title: string;
  description: string;
  price: number;
  stock: number;
  category_id: string;
  status: "active" | "inactive";
  images: Array<{ url: string; is_primary: boolean }>;
};

const EMPTY_DASHBOARD: SellerDashboard = {
  summary: {
    paid_orders: 0,
    total_orders: 0,
    sold_items: 0,
    revenue_cents: 0,
    pending_cents: 0,
    today_sales_cents: 0,
    month_sales_cents: 0,
    low_stock_count: 0,
  },
  recent_sales: [],
  top_products: [],
  sales_by_day: [],
  low_stock_products: [],
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parsePriceToCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function formatShortDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function SellerCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="glass-panel p-4">
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton mt-3 h-8 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

function ProductSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="glass-panel p-4">
          <div className="skeleton mb-3 h-36 w-full rounded-lg" />
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton mt-2 h-4 w-full rounded" />
          <div className="skeleton mt-2 h-4 w-5/6 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function SellerPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dashboard, setDashboard] = useState<SellerDashboard>(EMPTY_DASHBOARD);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceReais, setPriceReais] = useState("");
  const [stock, setStock] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const canRenderPanel = useMemo(() => user?.role === "seller" || user?.role === "admin", [user]);

  const loadSellerData = useCallback(async (showGeneralError = true) => {
    const [productsResult, categoriesResult, dashboardResult] = await Promise.allSettled([
      apiFetch("/products/my") as Promise<Product[]>,
      apiFetch("/products/categories") as Promise<Category[]>,
      apiFetch("/orders/seller/dashboard") as Promise<SellerDashboard>,
    ]);

    let hadError = false;

    if (productsResult.status === "fulfilled") {
      setProducts(productsResult.value);
    } else {
      hadError = true;
    }

    if (categoriesResult.status === "fulfilled") {
      setCategories(categoriesResult.value);
      if (categoriesResult.value.length > 0) {
        setCategoryId((prev) => prev || categoriesResult.value[0].id);
      }
    } else {
      hadError = true;
    }

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value || EMPTY_DASHBOARD);
    } else {
      hadError = true;
      setDashboard(EMPTY_DASHBOARD);
    }

    if (hadError && showGeneralError) {
      setError("Nao foi possivel atualizar todos os dados do painel.");
    } else {
      setError(null);
    }
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPriceReais("");
    setStock("0");
    setStatus("active");
    setImageUrls([]);
    setError(null);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const localUser = getStoredUser();
        const currentUser = localUser || (await fetchCurrentUser());

        if (!currentUser) {
          router.replace("/login");
          return;
        }

        if (currentUser.role !== "seller" && currentUser.role !== "admin") {
          router.replace("/");
          return;
        }

        if (!mounted) return;

        setUser(currentUser);
        setAuthLoading(false);

        setLoadingData(true);
        await loadSellerData(true);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar painel seller");
      } finally {
        if (mounted) {
          setAuthLoading(false);
          setLoadingData(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [router, loadSellerData]);

  useEffect(() => {
    if (!canRenderPanel) return;

    const intervalId = window.setInterval(() => {
      void loadSellerData(false);
    }, 15000);

    const handleFocus = () => {
      void loadSellerData(false);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [canRenderPanel, loadSellerData]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setError(null);
    setUploading(true);
    const toastId = toast.loading("Enviando imagem...");

    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("image", file);

        const response = (await apiFetch("/products/upload-image", {
          method: "POST",
          body: formData,
        })) as { url: string };

        uploadedUrls.push(response.url);
      }

      setImageUrls((prev) => [...prev, ...uploadedUrls]);
      toast.success("Imagem enviada", { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar imagem";
      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setTitle(product.title);
    setDescription(product.description);
    setPriceReais((product.price / 100).toFixed(2));
    setStock(String(product.stock));
    setCategoryId(product.category_id || "");
    setStatus(product.status === "inactive" ? "inactive" : "active");

    const currentImages = product.images?.map((image) => image.url) || (product.image_url ? [product.image_url] : []);
    setImageUrls(currentImages);
  }

  async function submitProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim()) {
      setError("Titulo e descricao sao obrigatorios");
      return;
    }

    if (!categoryId) {
      setError("Selecione uma categoria");
      return;
    }

    const price = parsePriceToCents(priceReais);
    if (price === null) {
      setError("Preco invalido");
      return;
    }

    const stockNumber = Number(stock);
    if (Number.isNaN(stockNumber) || stockNumber < 0 || !Number.isInteger(stockNumber)) {
      setError("Estoque deve ser inteiro e nao negativo");
      return;
    }

    const payload: ProductPayload = {
      title: title.trim(),
      description: description.trim(),
      price,
      stock: stockNumber,
      category_id: categoryId,
      status,
      images: imageUrls.map((url, index) => ({ url, is_primary: index === 0 })),
    };

    const editingProduct = editingId ? products.find((item) => item.id === editingId) : null;
    const stockChanged = editingProduct ? Number(editingProduct.stock) !== stockNumber : false;

    setSaving(true);

    try {
      if (editingId) {
        await apiFetch(`/products/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        if (stockChanged) {
          toast.success("Estoque atualizado");
        } else {
          toast.success("Produto atualizado com sucesso");
        }
      } else {
        await apiFetch("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toast.success("Produto cadastrado com sucesso");
      }

      resetForm();
      setLoadingData(true);
      await loadSellerData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar produto";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
      setLoadingData(false);
    }
  }

  async function removeProductConfirmed() {
    if (!deleteTarget) return;

    try {
      await apiFetch(`/products/${deleteTarget.id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((product) => product.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      toast.success("Produto excluido");
      setDeleteTarget(null);
      setLoadingData(true);
      await loadSellerData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao remover produto";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingData(false);
    }
  }

  async function createCategoryHandler() {
    const name = newCategoryName.trim();
    if (!name) return;

    setCreatingCategory(true);

    try {
      const created = (await apiFetch("/products/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      })) as Category;

      setCategories((prev) => {
        const exists = prev.some((item) => item.id === created.id);
        if (exists) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setCategoryId(created.id);
      setShowCategoryModal(false);
      setNewCategoryName("");
      toast.success("Categoria criada com sucesso");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar categoria";
      setError(message);
      toast.error(message);
    } finally {
      setCreatingCategory(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const list = products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.title.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch);

      const matchesCategory = filterCategory === "all" || product.category_id === filterCategory;
      const matchesLowStock = !filterLowStock || Number(product.stock) < 5;

      return matchesSearch && matchesCategory && matchesLowStock;
    });

    const sorted = [...list];

    if (sortBy === "price_asc") sorted.sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "stock_asc") sorted.sort((a, b) => a.stock - b.stock);

    return sorted;
  }, [products, searchTerm, filterCategory, filterLowStock, sortBy]);

  const salesByDayChart = useMemo(
    () =>
      dashboard.sales_by_day.map((item) => ({
        day: formatShortDate(item.day),
        receita: Number(item.revenue_cents) || 0,
      })),
    [dashboard.sales_by_day]
  );

  const topProductsChart = useMemo(
    () =>
      dashboard.top_products.map((item) => ({
        nome: item.title.length > 18 ? `${item.title.slice(0, 18)}...` : item.title,
        vendas: Number(item.revenue_cents) || 0,
      })),
    [dashboard.top_products]
  );

  if (authLoading) {
    return <p className="text-sm text-neutral-300">Validando acesso ao painel seller...</p>;
  }

  if (!canRenderPanel) {
    return null;
  }

  return (
    <section className="space-y-8">
      <header className="glass-panel p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Seller Control Center</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Gestao de produtos e vendas</h1>
        <p className="mt-2 text-sm text-neutral-300">Controle catalogo, estoque, categorias e acompanhe o desempenho em tempo real.</p>
      </header>

      {loadingData ? (
        <SellerCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="glass-panel p-4">
            <p className="text-xs text-neutral-400">Vendas hoje</p>
            <p className="mt-2 text-2xl font-bold">{formatMoney(dashboard.summary.today_sales_cents)}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-xs text-neutral-400">Vendas no mes</p>
            <p className="mt-2 text-2xl font-bold">{formatMoney(dashboard.summary.month_sales_cents)}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-xs text-neutral-400">Pedidos</p>
            <p className="mt-2 text-2xl font-bold">{dashboard.summary.total_orders}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-xs text-neutral-400">Estoque baixo</p>
            <p className="mt-2 text-2xl font-bold">{dashboard.summary.low_stock_count}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-panel p-5">
          <h2 className="text-lg font-semibold">Vendas por dia</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDayChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="#a3a3a3" />
                <YAxis stroke="#a3a3a3" tickFormatter={(value) => `R$ ${Math.round(value / 100)}`} />
                <Tooltip formatter={(value) => formatMoney(Number(value) || 0)} />
                <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-lg font-semibold">Produtos mais vendidos</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="nome" stroke="#a3a3a3" />
                <YAxis stroke="#a3a3a3" tickFormatter={(value) => `R$ ${Math.round(value / 100)}`} />
                <Tooltip formatter={(value) => formatMoney(Number(value) || 0)} />
                <Bar dataKey="vendas" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{editingId ? "Editar produto" : "Novo produto"}</h2>
            <button type="button" className="ui-btn ui-btn-outline" onClick={() => setShowCategoryModal(true)}>
              Nova categoria
            </button>
          </div>

          <form onSubmit={submitProduct} className="mt-4 space-y-4">
            <label className="block text-sm text-neutral-300">
              Nome do produto
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2" />
            </label>

            <label className="block text-sm text-neutral-300">
              Descricao
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2" />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-neutral-300">
                Preco (R$)
                <input value={priceReais} onChange={(e) => setPriceReais(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2" />
              </label>
              <label className="text-sm text-neutral-300">
                Estoque
                <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" min="0" step="1" className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-neutral-300">
                Categoria
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2">
                  <option value="">Selecione</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-neutral-300">
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")} className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2">
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-dashed border-white/25 bg-white/3 p-4 text-center text-sm text-neutral-300" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              void uploadFiles(event.dataTransfer.files);
            }}>
              Arraste imagens para ca ou
              <label className="ml-1 cursor-pointer text-emerald-300 underline">
                selecione arquivos
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
                  void uploadFiles(event.target.files);
                  event.currentTarget.value = "";
                }} />
              </label>
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {imageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Imagem ${index + 1}`} className="media-cover" />
                    <button type="button" onClick={() => setImageUrls((prev) => prev.filter((_, currentIndex) => currentIndex !== index))} className="absolute right-1 top-1 rounded bg-black/70 px-2 py-0.5 text-xs text-red-200">Remover</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving || uploading} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
                {saving ? <span className="btn-spinner" /> : null}
                {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Cadastrar produto"}
              </button>
              {editingId && <button type="button" onClick={resetForm} className="ui-btn ui-btn-outline">Cancelar edicao</button>}
            </div>
          </form>

          {uploading && <p className="mt-3 text-sm text-neutral-300">Enviando imagem...</p>}
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-lg font-semibold">Preview antes de salvar</h2>
          <div className="mt-3 rounded-xl border border-white/10 bg-neutral-950/60 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrls[0] || "https://placehold.co/600x300/0a0a0a/7a7a7a?text=Preview"} alt="Preview do produto" className="media-cover border border-white/10" />
            <h3 className="mt-3 text-base font-semibold">{title || "Nome do produto"}</h3>
            <p className="mt-1 text-sm text-neutral-400">{description || "Descricao do produto."}</p>
            <p className="mt-2 text-sm text-neutral-200">{priceReais ? `R$ ${Number(priceReais).toFixed(2)}` : "R$ 0,00"}</p>
            <p className="text-xs text-neutral-500">Categoria: {categories.find((item) => item.id === categoryId)?.name || "Sem categoria"}</p>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-neutral-300">Estoque baixo</h3>
          {dashboard.low_stock_products.length === 0 ? <p className="mt-2 text-xs text-neutral-400">Nenhum produto com estoque baixo.</p> : (
            <div className="mt-2 space-y-2">
              {dashboard.low_stock_products.map((item) => (
                <div key={item.id} className="rounded-lg border border-red-400/25 bg-red-500/10 p-2 text-sm text-red-200">
                  {item.title} - estoque: {item.stock}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Seus produtos</h2>
          {loadingData && <span className="text-xs text-neutral-400">Atualizando...</span>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nome" className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm" />
          <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm">
            <option value="all">Todas categorias</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm">
            <option value="recent">Mais recentes</option>
            <option value="price_asc">Menor preco</option>
            <option value="price_desc">Maior preco</option>
            <option value="stock_asc">Menor estoque</option>
          </select>
          <button type="button" className={`ui-btn ${filterLowStock ? "ui-btn-primary" : "ui-btn-outline"}`} onClick={() => setFilterLowStock((prev) => !prev)}>Estoque baixo</button>
        </div>

        <div className="mt-4">
          {loadingData ? (
            <ProductSkeletonGrid />
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-6 text-center">
              <p className="text-sm text-neutral-300">Voce ainda nao cadastrou produtos.</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <AnimatePresence>
                {filteredProducts.map((product) => {
                  const preview = product.images?.[0]?.url || product.image_url || null;

                  return (
                    <motion.article
                      key={product.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="glass-panel p-4"
                    >
                      {preview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt={product.title} className="media-cover mb-3" />
                      )}
                      <h3 className="text-base font-semibold">{product.title}</h3>
                      <p className="mt-1 text-sm text-neutral-400">{product.description}</p>
                      <p className="mt-2 text-sm text-neutral-200">{formatMoney(product.price)} | Estoque: {product.stock}</p>
                      <p className="text-xs text-neutral-500">Status: {product.status || "active"}</p>

                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => startEdit(product)} className="ui-btn ui-btn-outline">Editar</button>
                        <button type="button" onClick={() => setDeleteTarget(product)} className="ui-btn ui-btn-danger">Excluir</button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCategoryModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCategoryModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }} className="glass-panel w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-lg font-semibold">Nova categoria</h3>
              <label className="mt-3 block text-sm text-neutral-300">
                Nome da categoria
                <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2" />
              </label>
              <div className="mt-4 flex gap-2">
                <button type="button" className="ui-btn ui-btn-primary inline-flex items-center gap-2" disabled={creatingCategory} onClick={createCategoryHandler}>
                  {creatingCategory ? <span className="btn-spinner" /> : null}
                  {creatingCategory ? "Criando..." : "Criar categoria"}
                </button>
                <button type="button" className="ui-btn ui-btn-outline" onClick={() => setShowCategoryModal(false)}>Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.18 }} className="glass-panel w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white">Confirmar exclusao</h3>
              <p className="mt-2 text-sm text-neutral-300">Tem certeza que deseja excluir este produto?</p>
              <p className="text-sm font-medium text-neutral-100">{deleteTarget.title}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" className="ui-btn ui-btn-outline" onClick={() => setDeleteTarget(null)}>Cancelar</button>
                <button type="button" className="ui-btn ui-btn-danger" onClick={() => void removeProductConfirmed()}>Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
