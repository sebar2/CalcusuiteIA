import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Layers,
  ShieldAlert,
  Percent,
  Warehouse,
  X,
} from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  MeliReadyProductItem,
  MeliCategoryPrediction,
  MeliPublishItemResponse,
} from '../../types';

interface MeliPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProduct?: MeliReadyProductItem | null;
  onPublished?: (item: MeliPublishItemResponse) => void;
}

export const MeliPublishModal: React.FC<MeliPublishModalProps> = ({
  isOpen,
  onClose,
  preselectedProduct,
  onPublished,
}) => {
  const [products, setProducts] = useState<MeliReadyProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MeliReadyProductItem | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  // Formulario de publicación
  const [title, setTitle] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [price, setPrice] = useState<string>('1200');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [quantity, setQuantity] = useState<string>('10');
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [listingType, setListingType] = useState<'gold_special' | 'gold_pro' | 'bronze'>('gold_special');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Predicciones de categoría
  const [predictions, setPredictions] = useState<MeliCategoryPrediction[]>([]);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);

  // Estados de acción
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishedItem, setPublishedItem] = useState<MeliPublishItemResponse | null>(null);

  // Cargar productos del inventario al abrir
  useEffect(() => {
    if (!isOpen) {
      setPublishedItem(null);
      setErrorMsg(null);
      return;
    }

    setIsLoadingProducts(true);
    apiService
      .getMeliReadyProducts()
      .then((items) => {
        setProducts(items);
        if (preselectedProduct) {
          handleSelectProduct(preselectedProduct);
        } else if (items.length > 0) {
          handleSelectProduct(items[0]);
        }
      })
      .catch((err) => {
        console.warn('Error cargando productos listos para MeLi:', err);
      })
      .finally(() => {
        setIsLoadingProducts(false);
      });
  }, [isOpen, preselectedProduct]);

  const handleSelectProduct = (p: MeliReadyProductItem) => {
    setSelectedProduct(p);
    const safeTitle = (p.nombre || '').slice(0, 60);
    setTitle(safeTitle);
    setPrice(String(p.precio_lista || 1200));
    setQuantity(String(Math.max(1, p.deposito_central || 5)));
    setImageUrl(p.image_url || '');
    setDescription(
      `Producto oficial: ${p.nombre}. SKU: ${p.sku}. Stock verificado en Depósito Central de Calcu con entrega inmediata o envío por Mercado Envíos.`
    );
    setPredictions([]);
    setCategoryId('');
    setCategoryName('');
    setPublishedItem(null);
    setErrorMsg(null);

    // Auto-predecir categoría con el título
    if (safeTitle.length >= 3) {
      triggerCategoryPrediction(safeTitle);
    }
  };

  const triggerCategoryPrediction = async (textToPredict: string) => {
    if (!textToPredict || textToPredict.trim().length < 3) return;
    setIsPredicting(true);
    try {
      const preds = await apiService.predictMeliCategory(textToPredict.trim());
      setPredictions(preds);
      if (preds.length > 0) {
        setCategoryId(preds[0].category_id);
        setCategoryName(preds[0].category_name || preds[0].domain_name || preds[0].category_id);
      }
    } catch (err) {
      console.warn('No se pudo predecir categoría de MeLi:', err);
    } finally {
      setIsPredicting(false);
    }
  };

  // Detección de infracciones anti-penalización en vivo
  const checkForContactViolations = (text: string): string | null => {
    const t = text.toLowerCase();
    if (/(\+?598|09[1-9])[\s.-]?\d{3}[\s.-]?\d{3}/.test(t) || /\b09[1-9]\d{6}\b/.test(t)) {
      return 'Se detectó un número telefónico uruguayo. MeLi penaliza y suspende publicaciones con datos de contacto en título o descripción.';
    }
    if (/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/.test(t)) {
      return 'Se detectó una dirección de correo electrónico no permitida por Mercado Libre.';
    }
    if (/https?:\/\/|www\./.test(t)) {
      return 'Se detectó un enlace web o URL externa prohibida en publicaciones de Mercado Libre.';
    }
    return null;
  };

  const titleViolation = checkForContactViolations(title);
  const descViolation = checkForContactViolations(description);
  const activeViolation = titleViolation || descViolation;

  // Cálculo de comisiones y margen estimado
  const numPrice = parseFloat(price) || 0;
  const commissionRate = listingType === 'gold_pro' ? 0.18 : listingType === 'gold_special' ? 0.14 : 0.0;
  const estimatedCommission = numPrice * commissionRate;
  const estimatedNet = numPrice - estimatedCommission;
  const unitCost = selectedProduct?.costo_base || 0;
  const estimatedMarginPct =
    numPrice > 0 ? (((estimatedNet - unitCost) / numPrice) * 100).toFixed(1) : '0';

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('El título es requerido.');
      return;
    }
    if (title.length > 60) {
      setErrorMsg('El título no puede exceder los 60 caracteres (política estricta de MeLi).');
      return;
    }
    if (!categoryId.trim()) {
      setErrorMsg('Debe seleccionar o predecir una categoría oficial de Mercado Libre.');
      return;
    }
    if (activeViolation) {
      setErrorMsg(activeViolation);
      return;
    }

    setIsPublishing(true);
    try {
      const res = await apiService.publishMeliItem({
        product_id: selectedProduct?.id,
        sku: selectedProduct?.sku,
        title: title.trim(),
        category_id: categoryId.trim(),
        price: numPrice,
        currency_id: currency,
        available_quantity: parseInt(quantity, 10) || 1,
        condition,
        listing_type_id: listingType,
        image_url: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
      });

      setPublishedItem(res);
      if (onPublished) {
        onPublished(res);
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || 'Error al publicar artículo en Mercado Libre Uruguay.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-6">
        {/* Cabecera del Modal */}
        <div className="p-5 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-indigo-500/10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFE600] text-[#2D3277] flex items-center justify-center font-bold shadow-md shadow-amber-500/10">
              <ShoppingBag size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Publicar en Mercado Libre Uruguay (MLU)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFE600] text-[#2D3277]">
                  Oficial MeLi
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sincronización 1-clic desde el inventario central hacia Mercado Libre con linter anti-penalización.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notificación de éxito post-publicación */}
        {publishedItem ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                ¡Artículo Publicado Exitosamente en Mercado Libre!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                La publicación se encuentra activa y vinculada al Depósito Central de Calcu. Las preguntas y ventas ingresarán en tiempo real al Pipeline Comercial.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">ID de Publicación:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {publishedItem.item_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Título:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[250px]">
                  {publishedItem.title}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Precio &amp; Stock:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {currency} ${publishedItem.price} · {publishedItem.available_quantity} un.
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {publishedItem.permalink && (
                <a
                  href={publishedItem.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-md transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>Ver Publicación en Mercado Libre</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setPublishedItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                Publicar Otro Artículo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePublishSubmit} className="p-6 space-y-5 text-xs">
            {/* Alerta de Infracción Anti-Penalización en Vivo */}
            {activeViolation && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <ShieldAlert size={18} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <span className="font-bold block">Infracción Detectada por Linter MeLi</span>
                  <p className="mt-0.5">{activeViolation}</p>
                </div>
              </div>
            )}

            {/* Error General */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al procesar publicación</span>
                  <p className="mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Selector de Producto de Inventario Interno */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package size={14} className="text-indigo-500" />
                  <span>Seleccionar Producto de Inventario Calcu</span>
                </span>
                {isLoadingProducts && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Cargando catálogo...
                  </span>
                )}
              </label>

              <select
                value={selectedProduct?.sku || ''}
                onChange={(e) => {
                  const found = products.find((p) => p.sku === e.target.value);
                  if (found) handleSelectProduct(found);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-400 outline-hidden"
              >
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    [{p.sku}] {p.nombre} — Stock Depósito Central: {p.deposito_central} un. — ${p.precio_lista}
                  </option>
                ))}
              </select>
            </div>

            {/* Fila Título MeLi con Contador de Caracteres (0/60) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Título de la Publicación en Mercado Libre *
                </label>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    title.length > 60
                      ? 'text-rose-600 dark:text-rose-400'
                      : title.length >= 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {title.length} / 60 caracteres
                </span>
              </div>
              <input
                type="text"
                maxLength={70}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Panel LED 60x60 48W Blanco Frío Alta Eficiencia"
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-medium outline-hidden ${
                  title.length > 60
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-400'
                }`}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Consejo SEO MeLi: Incluye producto, modelo y característica principal. Evita signos de exclamación o palabras como &ldquo;OFERTA&rdquo;.
              </p>
            </div>

            {/* Categoría Oficial con Domain Discovery */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers size={14} className="text-amber-500" />
                  <span>Categoría Oficial de Mercado Libre Uruguay *</span>
                </label>
                <button
                  type="button"
                  disabled={isPredicting || !title.trim()}
                  onClick={() => triggerCategoryPrediction(title)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  <Sparkles size={12} className={isPredicting ? 'animate-spin' : ''} />
                  <span>{isPredicting ? 'Prediciendo...' : 'Predecir con IA'}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="ej. MLU1055"
                  className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono font-bold text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Nombre de Categoría (ej. Paneles LED)"
                  className="w-2/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white"
                />
              </div>

              {predictions.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Sugerencias IA:</span>
                  {predictions.map((pred) => (
                    <button
                      key={pred.category_id}
                      type="button"
                      onClick={() => {
                        setCategoryId(pred.category_id);
                        setCategoryName(pred.category_name || pred.domain_name || pred.category_id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                        categoryId === pred.category_id
                          ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 text-amber-900 dark:text-amber-200'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {pred.category_name || pred.domain_name} ({pred.category_id})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Precio, Moneda, Stock & Tipo de Publicación */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              {/* Precio */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Precio de Venta *
                </label>
                <div className="flex">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="bg-white dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-xl px-2 py-2 font-bold text-slate-700 dark:text-slate-200"
                  >
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl px-3 py-2 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Stock en MeLi *</span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    Dep. Central: {selectedProduct?.deposito_central || 0}
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white"
                />
              </div>

              {/* Condición */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Condición
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value="new">Nuevo (Garantía Oficial)</option>
                  <option value="used">Reacondicionado / Usado</option>
                </select>
              </div>

              {/* Tipo de Publicación */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exposición
                </label>
                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value="gold_special">Clásica (Comisión ~14%)</option>
                  <option value="gold_pro">Premium (Cuotas sin interés ~18%)</option>
                  <option value="bronze">Gratuita (Baja visibilidad)</option>
                </select>
              </div>
            </div>

            {/* Tarjeta de Rentabilidad Simulada */}
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Percent size={15} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Comisión Estimada MeLi: <b className="text-rose-600">{currency} ${estimatedCommission.toFixed(2)}</b> ({commissionRate * 100}%)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Neto a Cobrar: <b className="text-emerald-600 font-bold">{currency} ${estimatedNet.toFixed(2)}</b>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                  Margen Neto Est.: {estimatedMarginPct}%
                </span>
              </div>
            </div>

            {/* URL de Imagen y Descripción */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL de Imagen Principal (Fondo blanco recomendado)
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
                {imageUrl && (
                  <div className="mt-2 w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white flex items-center justify-center">
                    <img src={imageUrl} alt="Preview" className="object-contain w-full h-full" />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Oficial (/description)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles técnicos, garantía, compatibilidad..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Aviso de Gobernanza de Stock Central vs 3PL */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Warehouse size={14} className="shrink-0 text-slate-400" />
              <span>
                <b>Aislamiento de Inventario:</b> Las ventas en Mercado Libre descuentan únicamente existencias de <code>deposito_central</code>. Los depósitos aduaneros y depósitos logísticos 3PL de terceros permanecen protegidos e inmutables.
              </span>
            </div>

            {/* Botón de Publicación Oficial */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPublishing || !!activeViolation || !title.trim() || !categoryId.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Publicando en Mercado Libre...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={16} />
                    <span>Publicar en Mercado Libre en 1 Clic</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
