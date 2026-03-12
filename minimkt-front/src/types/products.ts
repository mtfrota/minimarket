export interface ProductImage {
  id?: string;
  url: string;
  is_primary?: boolean;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category_id?: string;
  category_name?: string;
  status?: "active" | "inactive";
  image_url?: string | null;
  images?: ProductImage[];
}
