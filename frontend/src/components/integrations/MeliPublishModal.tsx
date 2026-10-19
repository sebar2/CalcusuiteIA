import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Layers,
  Percent,
  Warehouse,
  X,
  UploadCloud,
  Search,
  Info,
  Trash2,
  Star,
  Truck,
} from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  MeliReadyProductItem,
  MeliCategoryPrediction,
  MeliCategorySearchResult,
  MeliCategoryAttribute,
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
  const [price, setPrice] = useState<string>('1200');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [quantity, setQuantity] = useState<string>('10');
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [listingType, setListingType] = useState<'gold_special' | 'gold_pro' | 'bronze'>('gold_special');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Subida de múltiples imágenes a MeLi CDN (hasta 12 fotos)
  const [uploadedPictures, setUploadedPictures] = useState<Array<{ id: string; url: string; name?: string }>>([]);
  const [isUploadingPicture, setIsUploadingPicture] = useState<boolean>(false);
  const [uploadPictureError, setUploadPictureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opciones de Envío (Mercado Envíos ME2, Costos Propios/Personalizados o A Convenir)
  const [shippingMode, setShippingMode] = useState<'me2' | 'custom' | 'not_specified'>('not_specified');
  const [freeShipping, setFreeShipping] = useState<boolean>(false);
  const [customCostMvd, setCustomCostMvd] = useState<string>('180');
  const [customCostInterior, setCustomCostInterior] = useState<string>('250');
  const [localPickUp, setLocalPickUp] = useState<boolean>(true);

  // Búsqueda interactiva y predictiva de categorías
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [categorySearchResults, setCategorySearchResults] = useState<MeliCategorySearchResult[]>([]);
  const [isSearchingCategory, setIsSearchingCategory] = useState<boolean>(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<MeliCategoryPrediction[]>([]);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);

  // Atributos dinámicos requeridos por la categoría
  const [categoryAttributes, setCategoryAttributes] = useState<MeliCategoryAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [isLoadingAttributes, setIsLoadingAttributes] = useState<boolean>(false);

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

  // Búsqueda en vivo de categorías con debounce al escribir 3 o más caracteres
  useEffect(() => {
    if (!categorySearchQuery || categorySearchQuery.trim().length < 2) {
      setCategorySearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingCategory(true);
      apiService
        .searchMeliCategories(categorySearchQuery.trim())
        .then((res) => {
          setCategorySearchResults(res);
          setShowCategoryDropdown(true);
        })
        .catch((err) => {
          console.warn('Error buscando categorías MeLi:', err);
        })
        .finally(() => {
          setIsSearchingCategory(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [categorySearchQuery]);

  // Cargar atributos obligatorios cuando cambia la categoría seleccionada
  const loadCategoryAttributes = async (catId: string) => {
    if (!catId) return;
    setIsLoadingAttributes(true);
    try {
      const attrs = await apiService.getMeliCategoryAttributes(catId);
      setCategoryAttributes(attrs);
      // Pre-cargar valores por defecto
      const initial: Record<string, string> = {};
      attrs.forEach((a) => {
        if (a.id === 'BRAND') initial['BRAND'] = 'Calcu';
        if (a.id === 'MODEL') initial['MODEL'] = title.slice(0, 30) || 'Estándar';
        if (a.id === 'ITEM_CONDITION') initial['ITEM_CONDITION'] = condition === 'new' ? 'Nuevo' : 'Usado';
        if (a.values && a.values.length > 0 && !initial[a.id]) {
          initial[a.id] = a.values[0].name;
        }
      });
      setAttributeValues((prev) => ({ ...initial, ...prev }));
    } catch (err) {
      console.warn('No se pudieron cargar los atributos de categoría:', err);
    } finally {
      setIsLoadingAttributes(false);
    }
  };

  const handleSelectProduct = (p: MeliReadyProductItem) => {
    setSelectedProduct(p);
    const safeTitle = (p.nombre || '').slice(0, 60);
    setTitle(safeTitle);
    setPrice(String(p.precio_lista || 1200));
    setQuantity(String(Math.max(1, p.deposito_central || 5)));
    setImageUrl(p.image_url || '');
    setUploadedPictures([]);
    setShippingMode('not_specified');
    setFreeShipping(false);
    setLocalPickUp(true);
    setDescription(
      `Producto oficial: ${p.nombre}. SKU: ${p.sku}. Stock verificado en Depósito Central de Calcu con entrega inmediata o envío por Mercado Envíos.`
    );
    setPredictions([]);
    setCategoryId('');
    setCategorySearchQuery('');
    setCategoryAttributes([]);
    setAttributeValues({});
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
        handleCategorySelect(preds[0].category_id, preds[0].category_name || preds[0].domain_name || preds[0].category_id);
      }
    } catch (err) {
      console.warn('No se pudo predecir categoría de MeLi:', err);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleCategorySelect = (catId: string, name: string) => {
    setCategoryId(catId);
    setCategorySearchQuery(`${name} (${catId})`);
    setShowCategoryDropdown(false);
    loadCategoryAttributes(catId);
  };

  // Subida de múltiples imágenes nativas a MeLi CDN (hasta 12 fotos)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedPictures.length + files.length > 12) {
      setUploadPictureError(`Mercado Libre permite hasta 12 fotos por publicación. Actualmente tienes ${uploadedPictures.length}.`);
      return;
    }

    setUploadPictureError(null);
    setIsUploadingPicture(true);
    try {
      const newPics: Array<{ id: string; url: string; name?: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`El archivo ${file.name} excede el tamaño máximo permitido de 10 MB.`);
        }
        const res = await apiService.uploadMeliPicture(file);
        newPics.push({
          id: res.id,
          url: res.secure_url || res.url || URL.createObjectURL(file),
          name: file.name,
        });
      }
      setUploadedPictures((prev) => [...prev, ...newPics]);
      setImageUrl(''); // Se priorizan las fotos nativas subidas a MeLi
    } catch (err: any) {
      setUploadPictureError(
        err.response?.data?.detail || err.message || 'Error al subir imagen directamente a la CDN de Mercado Libre.'
      );
    } finally {
      setIsUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePicture = (idxToRemove: number) => {
    setUploadedPictures((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSetCoverPicture = (idxToCover: number) => {
    setUploadedPictures((prev) => {
      const item = prev[idxToCover];
      const rest = prev.filter((_, idx) => idx !== idxToCover);
      return [item, ...rest];
    });
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
      setErrorMsg('Debe seleccionar o buscar una categoría oficial de Mercado Libre.');
      return;
    }
    if (activeViolation) {
      setErrorMsg(activeViolation);
      return;
    }

    // Mapeo de atributos a enviar
    const formattedAttributes = Object.entries(attributeValues)
      .filter(([_, val]) => val && val.trim().length > 0)
      .map(([attrId, val]) => ({
        id: attrId,
        value_name: val.trim(),
      }));

    // Mapeo de imágenes múltiples
    let picturesPayload: any[] = [];
    if (uploadedPictures.length > 0) {
      picturesPayload = uploadedPictures.map((pic) => ({ id: pic.id }));
    } else if (imageUrl.trim()) {
      picturesPayload = [{ source: imageUrl.trim() }];
    }

    setIsPublishing(true);
    try {
      const res = await apiService.publishMeliItem({
        product_id: selectedProduct?.id,
        sku: selectedProduct?.sku,
        title: title.trim(),
        family_name: title.trim(),
        category_id: categoryId.trim(),
        price: numPrice,
        currency_id: currency,
        available_quantity: parseInt(quantity, 10) || 1,
        condition,
        listing_type_id: listingType,
        pictures: picturesPayload.length > 0 ? picturesPayload : undefined,
        picture_id: uploadedPictures.length > 0 ? uploadedPictures[0].id : undefined,
        image_url: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
        attributes: formattedAttributes.length > 0 ? formattedAttributes : undefined,
        shipping: {
          mode: shippingMode,
          free_shipping: shippingMode === 'me2' ? freeShipping : false,
          local_pick_up: localPickUp,
          costs:
            shippingMode === 'custom'
              ? [
                  ...(parseFloat(customCostMvd) >= 0
                    ? [{ description: 'Montevideo / Área Metropolitana', cost: parseFloat(customCostMvd) || 0 }]
                    : []),
                  ...(parseFloat(customCostInterior) >= 0
                    ? [{ description: 'Interior del País', cost: parseFloat(customCostInterior) || 0 }]
                    : []),
                ]
              : undefined,
        },
        shipping_mode: shippingMode,
        shipping_costs:
          shippingMode === 'custom'
            ? [
                ...(parseFloat(customCostMvd) >= 0
                  ? [{ description: 'Montevideo / Área Metropolitana', cost: parseFloat(customCostMvd) || 0 }]
                  : []),
                ...(parseFloat(customCostInterior) >= 0
                  ? [{ description: 'Interior del País', cost: parseFloat(customCostInterior) || 0 }]
                  : []),
              ]
            : undefined,
        enable_me2: shippingMode === 'me2',
        free_shipping: shippingMode === 'me2' ? freeShipping : false,
        local_pick_up: localPickUp,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Cabecera del Modal (Fija) */}
        <div className="shrink-0 p-5 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-indigo-500/10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
                Sincronización 1-clic con soporte nativo de User Products, subida directa de fotos y categorías oficiales.
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
          <div className="flex-1 overflow-y-auto p-8 text-center space-y-5">
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
                <span className="text-slate-500">Título / Familia:</span>
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
          <form onSubmit={handlePublishSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs flex flex-col justify-between">
            <div className="space-y-4 flex-1">
            {/* Alerta de Infracción Anti-Penalización en Vivo */}
            {activeViolation && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Alerta de Seguridad &amp; Políticas MeLi</h4>
                  <p className="mt-0.5 leading-relaxed">{activeViolation}</p>
                </div>
              </div>
            )}

            {/* Error retornado por la API */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Error al procesar publicación</h4>
                  <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Selector de Producto de Inventario */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package size={14} className="text-amber-500" />
                  <span>Seleccionar Producto de Inventario Calcu</span>
                </span>
                {isLoadingProducts && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-normal">
                    <Loader2 size={12} className="animate-spin" /> Cargando catálogo...
                  </span>
                )}
              </label>
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const p = products.find((item) => item.id === parseInt(e.target.value, 10));
                  if (p) handleSelectProduct(p);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-400 outline-hidden"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
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
                placeholder="ej. Tubo LED T8 Vidrio 60cm 9W 6500K"
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-medium outline-hidden ${
                  title.length > 60
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-400'
                }`}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Consejo SEO MeLi: En cuentas User Products se utiliza como identificador de familia de producto (family_name).
              </p>
            </div>

            {/* Categoría Oficial con Búsqueda en Vivo (3+ letras o código MLU) */}
            <div className="space-y-2 relative">
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

              {/* Input con Autocomplete */}
              <div className="relative">
                <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                  <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => {
                      setCategorySearchQuery(e.target.value);
                      setShowCategoryDropdown(true);
                    }}
                    onFocus={() => {
                      if (categorySearchResults.length > 0) setShowCategoryDropdown(true);
                    }}
                    placeholder="Escriba 3 letras para buscar (ej. 'tubo', 'led', 'ilum') o código (ej. 'MLU1590')..."
                    className="w-full bg-transparent text-slate-900 dark:text-white font-medium outline-hidden"
                  />
                  {isSearchingCategory && <Loader2 size={14} className="animate-spin text-amber-500 ml-2" />}
                </div>

                {/* Dropdown de Resultados de Búsqueda */}
                {showCategoryDropdown && categorySearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 space-y-1">
                    {categorySearchResults.map((cat) => (
                      <button
                        key={cat.category_id}
                        type="button"
                        onClick={() => handleCategorySelect(cat.category_id, cat.category_name)}
                        className={`w-full text-left p-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors flex items-center justify-between cursor-pointer ${
                          categoryId === cat.category_id ? 'bg-amber-50 dark:bg-amber-950/60 font-bold' : ''
                        }`}
                      >
                        <div className="max-w-[85%]">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                            {cat.category_name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {cat.path_from_root || cat.domain_name}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-500">
                          {cat.category_id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Píldoras de sugerencias rápidas */}
              {predictions.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Sugerencias IA:</span>
                  {predictions.map((pred) => (
                    <button
                      key={pred.category_id}
                      type="button"
                      onClick={() => handleCategorySelect(pred.category_id, pred.category_name || pred.domain_name || pred.category_id)}
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

            {/* Atributos Obligatorios Requeridos por la Categoría MeLi */}
            {categoryAttributes.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Info size={14} className="text-indigo-500" />
                    <span>Atributos Requeridos por Mercado Libre para esta Categoría</span>
                  </label>
                  {isLoadingAttributes && <Loader2 size={12} className="animate-spin text-slate-400" />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categoryAttributes.map((attr) => (
                    <div key={attr.id}>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {attr.name} ({attr.id}) <span className="text-rose-500">*</span>
                      </label>
                      {attr.values && attr.values.length > 0 ? (
                        <select
                          value={attributeValues[attr.id] || ''}
                          onChange={(e) => setAttributeValues((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                        >
                          <option value="">Seleccione {attr.name}...</option>
                          {attr.values.map((v) => (
                            <option key={v.id || v.name} value={v.name}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={attributeValues[attr.id] || ''}
                          onChange={(e) => setAttributeValues((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                          placeholder={attr.hint || `Ingrese ${attr.name}`}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Fotos del Producto (Hasta 12 imágenes MeLi CDN) + URL opcional */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                  <UploadCloud size={15} className="text-amber-500" />
                  <span>Fotos del Producto (Hasta 12 fotos oficiales MeLi CDN) *</span>
                </label>
                <span className="text-[11px] font-mono font-semibold text-slate-500">
                  {uploadedPictures.length}/12 fotos
                </span>
              </div>

              {/* Input file oculto */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPicture || uploadedPictures.length >= 12}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-700 text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploadingPicture ? (
                    <Loader2 size={15} className="animate-spin text-amber-500" />
                  ) : (
                    <UploadCloud size={15} className="text-indigo-500" />
                  )}
                  <span>{isUploadingPicture ? 'Subiendo fotos a MeLi...' : 'Subir Fotos (JPG / PNG)'}</span>
                </button>

                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                    }}
                    placeholder="o agregar URL externa adicional..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {uploadPictureError && (
                <p className="text-[11px] text-rose-500">{uploadPictureError}</p>
              )}

              {/* Galería de imágenes cargadas */}
              {uploadedPictures.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
                  {uploadedPictures.map((pic, idx) => (
                    <div
                      key={pic.id || idx}
                      className="group relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 flex flex-col items-center overflow-hidden shadow-xs"
                    >
                      <div className="w-full h-16 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                        <img src={pic.url} alt={`Foto ${idx + 1}`} className="object-contain w-full h-full" />
                      </div>
                      {idx === 0 ? (
                        <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Portada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetCoverPicture(idx)}
                          className="mt-1 text-[9px] text-slate-500 hover:text-amber-500 flex items-center gap-0.5 cursor-pointer"
                          title="Fijar como foto principal"
                        >
                          <Star size={10} /> Portada
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePicture(idx)}
                        className="absolute top-1 right-1 p-1 rounded-md bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Eliminar foto"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Si solo hay imagen externa por URL */}
              {uploadedPictures.length === 0 && imageUrl && (
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 border border-slate-200">
                    <img src={imageUrl} alt="Preview" className="object-contain w-full h-full" />
                  </div>
                  <div className="text-[11px] truncate">
                    <span className="text-slate-500 truncate block">URL externa configurada como imagen</span>
                  </div>
                </div>
              )}
            </div>

            {/* Configuración de Envíos & Retiro en Persona */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                  <Truck size={15} className="text-indigo-500" />
                  <span>Logística, Métodos y Costos de Entrega</span>
                </label>
              </div>

              {/* Selector de Modalidad de Envío */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Mercado Envíos (ME2) */}
                <button
                  type="button"
                  onClick={() => setShippingMode('me2')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    shippingMode === 'me2'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block">Mercado Envíos (ME2)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Etiqueta oficial y logística integrada de MeLi.
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold mt-2 inline-block ${shippingMode === 'me2' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                    {shippingMode === 'me2' ? '● Seleccionado' : '○ Seleccionar'}
                  </span>
                </button>

                {/* 2. Costos Personalizados (custom) */}
                <button
                  type="button"
                  onClick={() => setShippingMode('custom')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    shippingMode === 'custom'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block">Costos Personalizados</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Flete propio o agencia con costo fijo al comprador.
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold mt-2 inline-block ${shippingMode === 'custom' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                    {shippingMode === 'custom' ? '● Seleccionado' : '○ Seleccionar'}
                  </span>
                </button>

                {/* 3. A Convenir (not_specified) */}
                <button
                  type="button"
                  onClick={() => setShippingMode('not_specified')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    shippingMode === 'not_specified'
                      ? 'bg-slate-200/70 dark:bg-slate-700/60 border-slate-400 text-slate-900 dark:text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block">A Convenir</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Coordinar entrega y flete con el cliente por chat.
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold mt-2 inline-block ${shippingMode === 'not_specified' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                    {shippingMode === 'not_specified' ? '● Seleccionado' : '○ Seleccionar'}
                  </span>
                </button>
              </div>

              {/* Contenido condicional según la modalidad seleccionada */}
              {shippingMode === 'me2' && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/60 dark:border-amber-900/40 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeShipping}
                      onChange={(e) => setFreeShipping(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="font-semibold">Ofrecer <b>Envío Gratis</b> a cargo de Calcu (el vendedor asume el costo de la etiqueta)</span>
                  </label>
                  {!freeShipping && (
                    <div className="text-[11px] p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 flex items-start gap-1.5 border border-amber-200/50">
                      <Info size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>
                        <b>Costo a cargo del comprador:</b> Mercado Libre calculará automáticamente el costo de flete en tiempo real según el código postal del comprador y se lo sumará al total en el checkout.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {shippingMode === 'custom' && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200/60 dark:border-indigo-900/40 space-y-3">
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                    <Info size={14} className="shrink-0 mt-0.5 text-indigo-500" />
                    <span>
                      Define las tarifas de flete que el comprador podrá seleccionar y abonar directamente al comprar:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Costo Montevideo / Local ({currency}) *
                      </label>
                      <div className="flex items-center">
                        <span className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 border border-r-0 border-slate-200 dark:border-slate-600 rounded-l-lg text-slate-500 font-bold text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={customCostMvd}
                          onChange={(e) => setCustomCostMvd(e.target.value)}
                          placeholder="180"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-r-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Costo Interior del País ({currency}) *
                      </label>
                      <div className="flex items-center">
                        <span className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 border border-r-0 border-slate-200 dark:border-slate-600 rounded-l-lg text-slate-500 font-bold text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={customCostInterior}
                          onChange={(e) => setCustomCostInterior(e.target.value)}
                          placeholder="250"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-r-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Retiro en persona */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                <input
                  type="checkbox"
                  checked={localPickUp}
                  onChange={(e) => setLocalPickUp(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-400 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                    Permitir Retiro en Depósito Central / En Persona (local_pick_up)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    El comprador puede retirar directamente en las instalaciones centrales de Calcu.
                  </span>
                </div>
              </label>
            </div>

            {/* Descripción */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                Descripción Oficial (/description)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles técnicos, garantía, compatibilidad..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Aviso de Gobernanza de Stock Central vs 3PL */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Warehouse size={14} className="shrink-0 text-slate-400" />
              <span>
                <b>Aislamiento de Inventario:</b> Las ventas en Mercado Libre descuentan únicamente existencias de <code>deposito_central</code>. Los depósitos aduaneros y depósitos logísticos 3PL de terceros permanecen protegidos e inmutables.
              </span>
            </div>
            </div>

            {/* Botón de Publicación Oficial (Fijo al pie del modal) */}
            <div className="shrink-0 pt-3 pb-1 mt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 z-10">
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
