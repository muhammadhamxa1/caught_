// Shared by the server pages and the client form. Kept out of the "use client"
// file so server components get the real object, not a client reference.

export const CATEGORIES = ["beauty", "skincare", "hair", "body", "home", "kitchen", "gadgets", "fashion", "accessories", "other"];

export type ProductValues = {
  id?: string;
  accountId?: string;
  catalogId: string;
  name: string;
  imageUrl: string;
  category: string;
  keywords: string;
  price: string;
  salePrice: string;
  tiktokUrl: string;
  tiktokRate: string;
  tierRate: string;
  tierUnits: string;
  amazonUrl: string;
  amazonRate: string;
  brandName: string;
  brandUrl: string;
  brandRate: string;
};

export const emptyProduct: ProductValues = {
  catalogId: "",
  name: "",
  imageUrl: "",
  category: "beauty",
  keywords: "",
  price: "",
  salePrice: "",
  tiktokUrl: "",
  tiktokRate: "",
  tierRate: "",
  tierUnits: "",
  amazonUrl: "",
  amazonRate: "3",
  brandName: "",
  brandUrl: "",
  brandRate: "",
};
